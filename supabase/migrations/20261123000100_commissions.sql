-- =============================================================================
-- 0017 · Comisiones de doctores (E3 · M6-A)
--
-- Reglas (aprobadas por Diego el 2026-11-23):
--   * Una comisión solo nace de un pago registrado (sobre lo cobrado, nunca sobre lo
--     presupuestado). Se calcula al registrar el pago con el esquema VIGENTE del doctor
--     al que se atribuye. Los pagos anteriores al esquema no generan comisión.
--   * Esquemas: «% de lo cobrado» y «renta de unidad dental» (el doctor recibe el 100%
--     de lo cobrado menos una renta fija por periodo; puede quedar a favor de la clínica).
--     La dueña no lleva esquema; sí la administración, los doctores y los colaboradores.
--   * El periodo lo elige cada clínica: quincenal (1–15 y 16–fin de mes) o mensual.
--   * Pago anulado: si su comisión no se ha pagado, se anula; si ya se pagó, se crea un
--     ajuste negativo en el periodo actual.
--   * Ven las comisiones la gerencia (todas) y cada doctor (solo las suyas). Recepción no.
--     El superadmin no las ve. Marca «pagada» y define esquemas solo la gerencia.
--   * Nada se borra: los esquemas se cierran (ended_at) y los pagos a doctores quedan.
--   * Auditoría sin montos ni datos del paciente.
-- Rollback: supabase/rollback/20261123000100_commissions.down.sql
-- =============================================================================

create type public.commission_kind as enum ('percent_collected', 'chair_rent');
create type public.commission_entry_kind as enum ('comision', 'ajuste');

alter table public.tenants
  add column commission_period text not null default 'quincenal' check (commission_period in ('quincenal', 'mensual'));

create table public.commission_schemes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  membership_id uuid not null,
  kind public.commission_kind not null,
  percent numeric(5, 2),
  rent_amount numeric(12, 2),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  unique (tenant_id, id),
  foreign key (tenant_id, membership_id) references public.memberships (tenant_id, id) on delete cascade,
  check (
    (kind = 'percent_collected' and percent > 0 and percent <= 100 and rent_amount is null)
    or (kind = 'chair_rent' and rent_amount > 0 and rent_amount <= 10000000 and percent is null)
  ),
  check (ended_at is null or ended_at >= started_at)
);
-- Un solo esquema vigente por doctor.
create unique index commission_schemes_one_active_idx on public.commission_schemes (tenant_id, membership_id) where ended_at is null;
create index commission_schemes_tenant_idx on public.commission_schemes (tenant_id, membership_id, started_at desc);

create table public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doctor_id uuid not null,
  period_from date not null,
  period_to date not null,
  commissions numeric(12, 2) not null,
  rent numeric(12, 2) not null default 0 check (rent >= 0),
  total numeric(12, 2) not null,
  notes text check (char_length(notes) <= 300),
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users (id) on delete set null,
  unique (tenant_id, id),
  foreign key (tenant_id, doctor_id) references public.memberships (tenant_id, id) on delete cascade,
  check (period_to >= period_from),
  check (total = commissions - rent)
);
create index commission_payouts_tenant_idx on public.commission_payouts (tenant_id, doctor_id, period_from);

create table public.commission_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doctor_id uuid not null,
  payment_id uuid not null,
  scheme_id uuid,
  kind public.commission_entry_kind not null default 'comision',
  base numeric(12, 2) not null,
  rate numeric(5, 2) not null check (rate > 0 and rate <= 100),
  amount numeric(12, 2) not null,
  period_date date not null,
  payout_id uuid,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  unique (tenant_id, id),
  unique (payment_id, kind),
  foreign key (tenant_id, doctor_id) references public.memberships (tenant_id, id) on delete cascade,
  foreign key (tenant_id, payment_id) references public.payments (tenant_id, id) on delete cascade,
  foreign key (tenant_id, scheme_id) references public.commission_schemes (tenant_id, id),
  foreign key (tenant_id, payout_id) references public.commission_payouts (tenant_id, id),
  check ((kind = 'comision' and base > 0 and amount >= 0) or (kind = 'ajuste' and base < 0 and amount <= 0)),
  -- Una comisión ya pagada no se anula: se compensa con un ajuste.
  check (not (voided_at is not null and payout_id is not null))
);
create index commission_entries_period_idx on public.commission_entries (tenant_id, doctor_id, period_date);
create index commission_entries_pending_idx on public.commission_entries (tenant_id, doctor_id) where payout_id is null and voided_at is null;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Zona horaria de la clínica: la de su primera sucursal activa.
create or replace function private.tenant_tz(p_tenant uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select b.timezone from public.branches b where b.tenant_id = p_tenant and b.is_active order by b.created_at limit 1),
    'America/Mexico_City');
$$;

-- ¿Puede ver las comisiones de ese doctor? Gerencia: todas. Un doctor: las suyas.
create or replace function private.can_see_commissions(p_tenant uuid, p_doctor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_tenant, array['owner', 'admin']::public.tenant_role[])
    or exists (
      select 1 from public.memberships m
      where m.id = p_doctor and m.tenant_id = p_tenant and m.user_id = (select auth.uid())
        and m.status = 'active' and m.role in ('admin', 'doctor', 'doctor_collab'));
$$;

revoke all on function private.tenant_tz(uuid) from public, anon, authenticated;
revoke all on function private.can_see_commissions(uuid, uuid) from public, anon;
grant execute on function private.can_see_commissions(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Triggers sobre pagos: nacer la comisión y anularla o compensarla.
-- -----------------------------------------------------------------------------

create or replace function private.commission_on_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.commission_schemes;
  v_rate numeric;
begin
  if new.doctor_id is null or new.voided_at is not null then
    return null;
  end if;
  select * into v_s from public.commission_schemes
  where tenant_id = new.tenant_id and membership_id = new.doctor_id and ended_at is null;
  if v_s.id is null then
    return null;
  end if;
  v_rate := case when v_s.kind = 'percent_collected' then v_s.percent else 100 end;
  insert into public.commission_entries (tenant_id, doctor_id, payment_id, scheme_id, kind, base, rate, amount, period_date)
  values (new.tenant_id, new.doctor_id, new.id, v_s.id, 'comision', new.amount, v_rate, round(new.amount * v_rate / 100, 2),
    (new.paid_at at time zone private.tenant_tz(new.tenant_id))::date);
  return null;
end;
$$;

create or replace function private.commission_on_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.commission_entries;
begin
  select * into v_e from public.commission_entries where payment_id = new.id and kind = 'comision';
  if v_e.id is null or v_e.voided_at is not null then
    return null;
  end if;
  if v_e.payout_id is null then
    update public.commission_entries set voided_at = now() where id = v_e.id;
  else
    insert into public.commission_entries (tenant_id, doctor_id, payment_id, scheme_id, kind, base, rate, amount, period_date)
    values (v_e.tenant_id, v_e.doctor_id, v_e.payment_id, v_e.scheme_id, 'ajuste', -v_e.base, v_e.rate, -v_e.amount,
      (now() at time zone private.tenant_tz(v_e.tenant_id))::date);
  end if;
  return null;
end;
$$;

revoke all on function private.commission_on_payment() from public, anon, authenticated;
revoke all on function private.commission_on_void() from public, anon, authenticated;

create trigger payments_commission_after_insert
  after insert on public.payments
  for each row execute function private.commission_on_payment();

create trigger payments_commission_after_void
  after update of voided_at on public.payments
  for each row when (old.voided_at is null and new.voided_at is not null)
  execute function private.commission_on_void();

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Periodo de corte de la clínica. Solo gerencia.
create or replace function public.set_commission_period(p_tenant uuid, p_period text)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tenants;
begin
  perform private.require_manager(p_tenant);
  if p_period is null or p_period not in ('quincenal', 'mensual') then
    raise exception 'Elige quincenal o mensual' using errcode = '22023';
  end if;
  update public.tenants set commission_period = p_period where id = p_tenant returning * into v_t;
  perform private.write_audit(p_tenant, 'commission.period_set', 'tenant', p_tenant::text, jsonb_build_object('period', p_period));
  return v_t;
end;
$$;

-- Esquema del doctor: cierra el vigente y abre el nuevo. p_kind null = sin comisión.
create or replace function public.set_commission_scheme(
  p_membership uuid,
  p_kind public.commission_kind default null,
  p_percent numeric default null,
  p_rent numeric default null
)
returns public.commission_schemes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
  v_s public.commission_schemes;
begin
  perform private.require_uid();
  select * into v_m from public.memberships where id = p_membership;
  if v_m.id is null or not private.has_role(v_m.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Doctor no encontrado' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_m.tenant_id);
  if v_m.status <> 'active' or v_m.role not in ('admin', 'doctor', 'doctor_collab') then
    raise exception 'Solo la administración, los doctores y los colaboradores llevan comisión' using errcode = '22023';
  end if;
  if p_kind = 'percent_collected' and (p_percent is null or p_percent <= 0 or p_percent > 100) then
    raise exception 'El porcentaje va de 0.01 a 100' using errcode = '22023';
  end if;
  if p_kind = 'chair_rent' and (p_rent is null or p_rent <= 0 or p_rent > 10000000) then
    raise exception 'Escribe la renta por periodo' using errcode = '22023';
  end if;

  update public.commission_schemes set ended_at = now()
  where tenant_id = v_m.tenant_id and membership_id = v_m.id and ended_at is null;

  if p_kind is not null then
    insert into public.commission_schemes (tenant_id, membership_id, kind, percent, rent_amount, created_by)
    values (v_m.tenant_id, v_m.id, p_kind,
      case when p_kind = 'percent_collected' then round(p_percent, 2) end,
      case when p_kind = 'chair_rent' then round(p_rent, 2) end,
      (select auth.uid()))
    returning * into v_s;
  end if;
  perform private.write_audit(v_m.tenant_id, 'commission.scheme_set', 'membership', v_m.id::text,
    jsonb_build_object('kind', coalesce(p_kind::text, 'ninguno')));
  return v_s;
end;
$$;

-- Resumen del periodo (P28). Gerencia: todos los doctores. Un doctor: solo su fila.
-- «rent_due»: la renta del periodo si todavía no se cobró en un pago a ese doctor.
create or replace function public.commission_summary(p_tenant uuid, p_from date, p_to date)
returns table (
  doctor_id uuid, full_name text, role public.tenant_role,
  scheme_kind public.commission_kind, percent numeric, rent_amount numeric,
  patients integer, collected numeric, commission numeric, pending numeric, paid numeric,
  rent_due numeric, last_paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text := private.tenant_tz(p_tenant);
begin
  perform private.require_uid();
  if not private.is_member(p_tenant) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Revisa el periodo' using errcode = '22023';
  end if;
  return query
    with docs as (
      select m.id, m.role, coalesce(nullif(btrim(pr.full_name), ''), 'Sin nombre') as name
      from public.memberships m
      left join public.profiles pr on pr.id = m.user_id
      where m.tenant_id = p_tenant and m.status = 'active' and m.role in ('owner', 'admin', 'doctor', 'doctor_collab')
        and private.can_see_commissions(p_tenant, m.id)
    ),
    pay as (
      select x.doctor_id, count(distinct x.patient_id)::integer as patients, sum(x.amount) as collected
      from public.payments x
      where x.tenant_id = p_tenant and x.voided_at is null and x.doctor_id in (select id from docs)
        and (x.paid_at at time zone v_tz)::date between p_from and p_to
      group by x.doctor_id
    ),
    ent as (
      select e.doctor_id,
        sum(e.amount) as commission,
        coalesce(sum(e.amount) filter (where e.payout_id is null), 0) as pending,
        coalesce(sum(e.amount) filter (where e.payout_id is not null), 0) as paid
      from public.commission_entries e
      where e.tenant_id = p_tenant and e.voided_at is null and e.doctor_id in (select id from docs)
        and e.period_date between p_from and p_to
      group by e.doctor_id
    )
    select d.id, d.name, d.role, s.kind, s.percent, s.rent_amount,
      coalesce(pay.patients, 0), coalesce(pay.collected, 0), coalesce(ent.commission, 0), coalesce(ent.pending, 0), coalesce(ent.paid, 0),
      case when s.kind = 'chair_rent' and not exists (
        select 1 from public.commission_payouts po
        where po.tenant_id = p_tenant and po.doctor_id = d.id and po.period_from = p_from and po.rent > 0)
      then s.rent_amount else 0 end,
      (select max(po.paid_at) from public.commission_payouts po where po.tenant_id = p_tenant and po.doctor_id = d.id and po.period_from = p_from)
    from docs d
    left join public.commission_schemes s on s.tenant_id = p_tenant and s.membership_id = d.id and s.ended_at is null
    left join pay on pay.doctor_id = d.id
    left join ent on ent.doctor_id = d.id
    where s.id is not null or pay.doctor_id is not null or ent.doctor_id is not null
    order by coalesce(pay.collected, 0) desc, d.name
    limit 200;
end;
$$;

-- Movimientos de un doctor en el periodo (detalle de P28), con paginación.
create or replace function public.commission_lines(p_doctor uuid, p_from date, p_to date, p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
begin
  perform private.require_uid();
  select * into v_m from public.memberships where id = p_doctor;
  if v_m.id is null or not private.can_see_commissions(v_m.tenant_id, v_m.id) then
    raise exception 'Doctor no encontrado' using errcode = 'P0002';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Revisa el periodo' using errcode = '22023';
  end if;
  return (
    with l as (
      select e.id, e.kind, e.base, e.rate, e.amount, e.period_date, e.payout_id is not null as paid,
        x.folio, x.method, pt.full_name as patient, q.title as quote_title, q.folio as quote_folio
      from public.commission_entries e
      join public.payments x on x.tenant_id = e.tenant_id and x.id = e.payment_id
      join public.patients pt on pt.tenant_id = x.tenant_id and pt.id = x.patient_id
      left join public.quotes q on q.tenant_id = x.tenant_id and q.id = x.quote_id
      where e.tenant_id = v_m.tenant_id and e.doctor_id = v_m.id and e.voided_at is null
        and e.period_date between p_from and p_to
    )
    select jsonb_build_object(
      'total', (select count(*) from l),
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.period_date desc, r.folio desc)
        from (select * from l order by period_date desc, folio desc
              limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) r), '[]'::jsonb)
    )
  );
end;
$$;

-- Marcar como pagada: liga lo pendiente del periodo a un pago al doctor (y cobra la
-- renta una vez por periodo). Solo gerencia.
create or replace function public.pay_commissions(p_doctor uuid, p_from date, p_to date, p_notes text default null)
returns public.commission_payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
  v_s public.commission_schemes;
  v_sum numeric;
  v_rent numeric := 0;
  v_po public.commission_payouts;
begin
  perform private.require_uid();
  select * into v_m from public.memberships where id = p_doctor;
  if v_m.id is null or not private.has_role(v_m.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Doctor no encontrado' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_m.tenant_id);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Revisa el periodo' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_sum from public.commission_entries
  where tenant_id = v_m.tenant_id and doctor_id = v_m.id and payout_id is null and voided_at is null
    and period_date between p_from and p_to;
  select * into v_s from public.commission_schemes
  where tenant_id = v_m.tenant_id and membership_id = v_m.id and ended_at is null;
  if v_s.kind = 'chair_rent' and not exists (
    select 1 from public.commission_payouts
    where tenant_id = v_m.tenant_id and doctor_id = v_m.id and period_from = p_from and rent > 0) then
    v_rent := v_s.rent_amount;
  end if;
  if v_sum = 0 and v_rent = 0 and not exists (
    select 1 from public.commission_entries
    where tenant_id = v_m.tenant_id and doctor_id = v_m.id and payout_id is null and voided_at is null
      and period_date between p_from and p_to) then
    raise exception 'No hay nada por pagar en este periodo' using errcode = '22023';
  end if;

  insert into public.commission_payouts (tenant_id, doctor_id, period_from, period_to, commissions, rent, total, notes, paid_by)
  values (v_m.tenant_id, v_m.id, p_from, p_to, v_sum, v_rent, v_sum - v_rent, nullif(btrim(p_notes), ''), (select auth.uid()))
  returning * into v_po;
  update public.commission_entries set payout_id = v_po.id
  where tenant_id = v_m.tenant_id and doctor_id = v_m.id and payout_id is null and voided_at is null
    and period_date between p_from and p_to;
  perform private.write_audit(v_m.tenant_id, 'commission.paid', 'commission_payout', v_po.id::text);
  return v_po;
end;
$$;

revoke all on function public.set_commission_period(uuid, text) from public, anon;
grant execute on function public.set_commission_period(uuid, text) to authenticated;
revoke all on function public.set_commission_scheme(uuid, public.commission_kind, numeric, numeric) from public, anon;
grant execute on function public.set_commission_scheme(uuid, public.commission_kind, numeric, numeric) to authenticated;
revoke all on function public.commission_summary(uuid, date, date) from public, anon;
grant execute on function public.commission_summary(uuid, date, date) to authenticated;
revoke all on function public.commission_lines(uuid, date, date, integer, integer) from public, anon;
grant execute on function public.commission_lines(uuid, date, date, integer, integer) to authenticated;
revoke all on function public.pay_commissions(uuid, date, date, text) from public, anon;
grant execute on function public.pay_commissions(uuid, date, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: gerencia ve todo de su clínica; cada doctor, lo suyo. Escritura solo por RPC.
-- -----------------------------------------------------------------------------
alter table public.commission_schemes enable row level security;
alter table public.commission_entries enable row level security;
alter table public.commission_payouts enable row level security;
revoke all on public.commission_schemes, public.commission_entries, public.commission_payouts from anon, authenticated;
grant select on public.commission_schemes, public.commission_entries, public.commission_payouts to authenticated;

create policy commission_schemes_select on public.commission_schemes
  for select to authenticated
  using ((select private.can_see_commissions(tenant_id, membership_id)));

create policy commission_entries_select on public.commission_entries
  for select to authenticated
  using ((select private.can_see_commissions(tenant_id, doctor_id)));

create policy commission_payouts_select on public.commission_payouts
  for select to authenticated
  using ((select private.can_see_commissions(tenant_id, doctor_id)));
