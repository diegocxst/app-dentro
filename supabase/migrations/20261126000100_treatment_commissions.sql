-- =============================================================================
-- 0023 · Comisión por tratamiento (E3 · M6-C1, obs. 14)
--
-- Reglas (aprobadas por Diego el 2026-11-26):
--   * Excepciones por doctor y tratamiento (commission_treatment_rules): un % (0.01–100)
--     o un monto fijo por unidad (hasta 10,000,000). Una por doctor y tratamiento.
--     Solo la gerencia las pone o quita (set_treatment_commission); se ven como el
--     esquema: la gerencia todas, cada doctor las suyas; el superadmin no.
--   * Aplican solo si el esquema vigente del doctor es de % (con renta el doctor ya se
--     queda con lo cobrado): set_treatment_commission lo exige (22023) y el cálculo las
--     ignora con otro esquema.
--   * Un abono ligado a un presupuesto se reparte en proporción a las partidas positivas
--     (el descuento se reparte igual). Lo de un tratamiento con excepción de % usa ese %;
--     con monto fijo gana monto × unidades × abono ÷ total del presupuesto (conforme se
--     cobra). El resto usa el % general. Sin presupuesto o sin excepciones: como antes,
--     un solo movimiento con el % general.
--   * Cada parte es un movimiento propio con su tratamiento (treatment_id) y, si es monto
--     fijo, fixed_amount (rate = 0). Lo ya generado no cambia (obs. 18).
--   * Al anular el pago se anulan (o compensan con un ajuste, si ya se pagaron) TODAS sus
--     partes.
--   * Auditoría sin montos: commission.treatment_rule_set con el tipo (percent, amount o
--     ninguno).
-- Rollback: supabase/rollback/20261126000100_treatment_commissions.down.sql
-- =============================================================================

create table public.commission_treatment_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  membership_id uuid not null,
  treatment_id uuid not null,
  percent numeric(5, 2) check (percent is null or (percent > 0 and percent <= 100)),
  amount numeric(12, 2) check (amount is null or (amount > 0 and amount <= 10000000)),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (membership_id, treatment_id),
  foreign key (tenant_id, membership_id) references public.memberships (tenant_id, id) on delete cascade,
  foreign key (tenant_id, treatment_id) references public.treatments (tenant_id, id) on delete cascade,
  check ((percent is null) <> (amount is null))
);
create index commission_treatment_rules_doctor_idx on public.commission_treatment_rules (tenant_id, membership_id);

alter table public.commission_treatment_rules enable row level security;
revoke all on public.commission_treatment_rules from anon, authenticated;
grant select on public.commission_treatment_rules to authenticated;
create policy commission_treatment_rules_select on public.commission_treatment_rules
  for select to authenticated
  using ((select private.can_see_commissions(tenant_id, membership_id)));

-- Movimientos por partes: tratamiento y monto fijo; varias partes por pago.
alter table public.commission_entries
  add column treatment_id uuid,
  add column fixed_amount numeric(12, 2) check (fixed_amount is null or fixed_amount > 0),
  add constraint commission_entries_treatment_fk foreign key (tenant_id, treatment_id) references public.treatments (tenant_id, id),
  drop constraint commission_entries_payment_id_kind_key,
  drop constraint commission_entries_rate_check,
  add constraint commission_entries_rate_check check (
    (fixed_amount is null and rate > 0 and rate <= 100) or (fixed_amount is not null and treatment_id is not null and rate = 0));
create unique index commission_entries_part_uidx on public.commission_entries
  (payment_id, kind, coalesce(treatment_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- -----------------------------------------------------------------------------
-- Cálculo al registrar un pago.
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
  v_day date;
  v_total numeric;
  v_pos numeric;
  v_ruled numeric;
  v_n integer;
  v_i integer := 0;
  v_left numeric;
  v_part numeric;
  r record;
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
  v_day := (new.paid_at at time zone private.tenant_tz(new.tenant_id))::date;

  if v_s.kind = 'percent_collected' and new.quote_id is not null then
    select q.total into v_total from public.quotes q where q.tenant_id = new.tenant_id and q.id = new.quote_id;
    select coalesce(sum(qi.quantity * qi.unit_price), 0) into v_pos
    from public.quote_items qi
    where qi.tenant_id = new.tenant_id and qi.quote_id = new.quote_id and qi.quantity * qi.unit_price > 0;
    select coalesce(sum(qi.quantity * qi.unit_price), 0), count(distinct qi.treatment_id) into v_ruled, v_n
    from public.quote_items qi
    join public.commission_treatment_rules rl
      on rl.tenant_id = qi.tenant_id and rl.membership_id = new.doctor_id and rl.treatment_id = qi.treatment_id
    where qi.tenant_id = new.tenant_id and qi.quote_id = new.quote_id and qi.quantity * qi.unit_price > 0;
  end if;

  if coalesce(v_n, 0) = 0 or coalesce(v_total, 0) <= 0 or coalesce(v_pos, 0) <= 0 then
    insert into public.commission_entries (tenant_id, doctor_id, payment_id, scheme_id, kind, base, rate, amount, period_date)
    values (new.tenant_id, new.doctor_id, new.id, v_s.id, 'comision', new.amount, v_rate, round(new.amount * v_rate / 100, 2), v_day);
    return null;
  end if;

  v_left := new.amount;
  for r in
    select qi.treatment_id, sum(qi.quantity * qi.unit_price) as line, sum(qi.quantity) as qty, rl.percent, rl.amount as fixed
    from public.quote_items qi
    join public.commission_treatment_rules rl
      on rl.tenant_id = qi.tenant_id and rl.membership_id = new.doctor_id and rl.treatment_id = qi.treatment_id
    where qi.tenant_id = new.tenant_id and qi.quote_id = new.quote_id and qi.quantity * qi.unit_price > 0
    group by qi.treatment_id, rl.percent, rl.amount
    order by qi.treatment_id
  loop
    v_i := v_i + 1;
    -- Si todo el presupuesto tiene excepción, la última parte se queda con el redondeo.
    v_part := case when v_i = v_n and v_ruled >= v_pos then v_left else round(new.amount * r.line / v_pos, 2) end;
    v_part := least(v_part, v_left);
    continue when v_part <= 0;
    v_left := v_left - v_part;
    if r.percent is not null then
      insert into public.commission_entries (tenant_id, doctor_id, payment_id, scheme_id, kind, base, rate, amount, period_date, treatment_id)
      values (new.tenant_id, new.doctor_id, new.id, v_s.id, 'comision', v_part, r.percent, round(v_part * r.percent / 100, 2), v_day, r.treatment_id);
    else
      insert into public.commission_entries (tenant_id, doctor_id, payment_id, scheme_id, kind, base, rate, amount, period_date, treatment_id, fixed_amount)
      values (new.tenant_id, new.doctor_id, new.id, v_s.id, 'comision', v_part, 0,
        round(r.fixed * r.qty * new.amount / v_total, 2), v_day, r.treatment_id, r.fixed);
    end if;
  end loop;

  if v_left > 0 then
    insert into public.commission_entries (tenant_id, doctor_id, payment_id, scheme_id, kind, base, rate, amount, period_date)
    values (new.tenant_id, new.doctor_id, new.id, v_s.id, 'comision', v_left, v_rate, round(v_left * v_rate / 100, 2), v_day);
  end if;
  return null;
end;
$$;

-- Al anular el pago: todas sus partes.
create or replace function private.commission_on_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.commission_entries;
begin
  for v_e in
    select * from public.commission_entries where payment_id = new.id and kind = 'comision' and voided_at is null
  loop
    if v_e.payout_id is null then
      update public.commission_entries set voided_at = now() where id = v_e.id;
    else
      insert into public.commission_entries (tenant_id, doctor_id, payment_id, scheme_id, kind, base, rate, amount, period_date, treatment_id, fixed_amount)
      values (v_e.tenant_id, v_e.doctor_id, v_e.payment_id, v_e.scheme_id, 'ajuste', -v_e.base, v_e.rate, -v_e.amount,
        (now() at time zone private.tenant_tz(v_e.tenant_id))::date, v_e.treatment_id, v_e.fixed_amount);
    end if;
  end loop;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: poner o quitar la excepción de un tratamiento. Ambos valores null = quitar.
-- -----------------------------------------------------------------------------
create or replace function public.set_treatment_commission(
  p_membership uuid,
  p_treatment uuid,
  p_percent numeric default null,
  p_amount numeric default null
)
returns public.commission_treatment_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
  v_r public.commission_treatment_rules;
begin
  perform private.require_uid();
  select * into v_m from public.memberships where id = p_membership;
  if v_m.id is null or not private.has_role(v_m.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Doctor no encontrado' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_m.tenant_id);
  if not exists (select 1 from public.treatments t where t.tenant_id = v_m.tenant_id and t.id = p_treatment) then
    raise exception 'Tratamiento no encontrado' using errcode = 'P0002';
  end if;
  if p_percent is not null and p_amount is not null then
    raise exception 'Elige un porcentaje o un monto, no los dos' using errcode = '22023';
  end if;
  if p_percent is not null and (p_percent <= 0 or p_percent > 100) then
    raise exception 'El porcentaje va de 0.01 a 100' using errcode = '22023';
  end if;
  if p_amount is not null and (p_amount <= 0 or p_amount > 10000000) then
    raise exception 'Escribe el monto por tratamiento' using errcode = '22023';
  end if;

  if p_percent is null and p_amount is null then
    delete from public.commission_treatment_rules
    where tenant_id = v_m.tenant_id and membership_id = v_m.id and treatment_id = p_treatment
    returning * into v_r;
  else
    if not exists (select 1 from public.commission_schemes s
                   where s.tenant_id = v_m.tenant_id and s.membership_id = v_m.id and s.ended_at is null and s.kind = 'percent_collected') then
      raise exception 'Las comisiones por tratamiento son para doctores con esquema de porcentaje' using errcode = '22023';
    end if;
    insert into public.commission_treatment_rules (tenant_id, membership_id, treatment_id, percent, amount, created_by)
    values (v_m.tenant_id, v_m.id, p_treatment, round(p_percent, 2), round(p_amount, 2), (select auth.uid()))
    on conflict (membership_id, treatment_id) do update
      set percent = excluded.percent, amount = excluded.amount, updated_at = now()
    returning * into v_r;
  end if;
  perform private.write_audit(v_m.tenant_id, 'commission.treatment_rule_set', 'membership', v_m.id::text,
    jsonb_build_object('kind', case when p_percent is not null then 'percent' when p_amount is not null then 'amount' else 'ninguno' end));
  return v_r;
end;
$$;

-- Movimientos con su tratamiento y monto fijo.
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
      select e.id, e.kind, e.base, e.rate, e.amount, e.period_date, e.payout_id is not null as paid, s.kind as scheme_kind,
        e.fixed_amount, t.name as treatment,
        x.folio, x.method, pt.full_name as patient, q.title as quote_title, q.folio as quote_folio
      from public.commission_entries e
      join public.payments x on x.tenant_id = e.tenant_id and x.id = e.payment_id
      join public.patients pt on pt.tenant_id = x.tenant_id and pt.id = x.patient_id
      left join public.quotes q on q.tenant_id = x.tenant_id and q.id = x.quote_id
      left join public.commission_schemes s on s.tenant_id = e.tenant_id and s.id = e.scheme_id
      left join public.treatments t on t.tenant_id = e.tenant_id and t.id = e.treatment_id
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

revoke all on function private.commission_on_payment() from public, anon, authenticated;
revoke all on function private.commission_on_void() from public, anon, authenticated;
revoke all on function public.set_treatment_commission(uuid, uuid, numeric, numeric) from public, anon;
grant execute on function public.set_treatment_commission(uuid, uuid, numeric, numeric) to authenticated;
