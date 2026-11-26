-- =============================================================================
-- ROLLBACK de 20261126000200_patient_credit.sql
-- SOLO en desarrollo con datos ficticios y con aprobación explícita de Diego. NUNCA en
-- producción. Se niega si ya se aplicó saldo a favor (el modelo anterior no lo puede
-- expresar). Los abonos sin presupuesto vuelven a ser «sueltos».
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.payment_allocations where source = 'saldo_a_favor') then
    raise exception 'Ya hay saldo a favor aplicado: no se puede revertir';
  end if;
end $$;

drop trigger if exists quotes_credit_after_status on public.quotes;
drop trigger if exists payments_allocations_after_void on public.payments;
drop trigger if exists payments_allocate_after_insert on public.payments;
drop trigger if exists payment_allocations_commission_after_void on public.payment_allocations;
drop trigger if exists payment_allocations_commission_after_insert on public.payment_allocations;
drop trigger if exists payment_allocations_check_before_insert on public.payment_allocations;

drop index if exists public.commission_entries_part_uidx;
drop index if exists public.commission_entries_allocation_idx;
alter table public.commission_entries drop constraint commission_entries_allocation_fk, drop column allocation_id;
create unique index commission_entries_part_uidx on public.commission_entries
  (payment_id, kind, coalesce(treatment_id, '00000000-0000-0000-0000-000000000000'::uuid));

drop function if exists private.credit_on_quote_status();
drop function if exists private.allocations_on_payment_void();
drop function if exists private.allocate_new_payment();
drop function if exists private.commission_on_allocation_void();
drop function if exists private.commission_on_allocation();
drop function if exists private.apply_patient_credit(uuid, uuid);
drop function if exists private.check_allocation();
drop function if exists private.patient_credit(uuid, uuid);
drop table public.payment_allocations;


-- Funciones como estaban (0016, 0018, 0021, 0022 y 0023).

create or replace function private.quote_paid(p_quote uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0) from public.payments where quote_id = p_quote and voided_at is null;
$$;

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

create trigger payments_commission_after_insert
  after insert on public.payments
  for each row execute function private.commission_on_payment();

create trigger payments_commission_after_void
  after update of voided_at on public.payments
  for each row when (old.voided_at is null and new.voided_at is not null)
  execute function private.commission_on_void();

create or replace function public.register_payment(
  p_patient uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_paid_at timestamptz default null,
  p_quote uuid default null,
  p_reference text default null,
  p_notes text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.patients;
  v_q public.quotes;
  v_pay public.payments;
  v_folio integer;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
begin
  perform private.require_uid();
  select * into v_p from public.patients where id = p_patient;
  if v_p.id is null or not private.can_see_patient(v_p.tenant_id, v_p.primary_doctor_id) then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;
  if not private.can_write(v_p.tenant_id, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'Solo la dueña, la administración o recepción registran pagos' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Escribe el monto' using errcode = '22023';
  end if;
  if v_paid_at > now() + interval '1 hour' or v_paid_at < now() - interval '365 days' then
    raise exception 'Revisa la fecha del pago' using errcode = '22023';
  end if;

  if p_quote is not null then
    select * into v_q from public.quotes where id = p_quote and tenant_id = v_p.tenant_id and patient_id = v_p.id;
    if v_q.id is null then
      raise exception 'Ese presupuesto no es de este paciente' using errcode = '22023';
    end if;
    if v_q.status in ('borrador', 'perdido') then
      raise exception 'Presenta el presupuesto antes de cobrarlo' using errcode = '22023';
    end if;
    if p_amount > v_q.total - private.quote_paid(v_q.id) then
      raise exception 'El pago supera el saldo del presupuesto' using errcode = '22023';
    end if;
  end if;

  update public.tenants set payment_seq = payment_seq + 1 where id = v_p.tenant_id returning payment_seq into v_folio;
  insert into public.payments (tenant_id, folio, patient_id, quote_id, doctor_id, amount, method, paid_at, reference, notes, registered_by)
  values (v_p.tenant_id, v_folio, v_p.id, v_q.id, coalesce(v_q.doctor_id, v_p.primary_doctor_id), round(p_amount, 2), p_method, v_paid_at,
    nullif(btrim(p_reference), ''), nullif(btrim(p_notes), ''), (select auth.uid()))
  returning * into v_pay;

  -- Pagar el anticipo es aceptar el presupuesto.
  if v_q.id is not null and v_q.status in ('presentado', 'en_duda') then
    update public.quotes set status = 'aceptado', status_changed_at = now() where id = v_q.id;
    perform private.write_audit(v_q.tenant_id, 'quote.status', 'quote', v_q.id::text, jsonb_build_object('status', 'aceptado'));
  end if;

  perform private.write_audit(v_pay.tenant_id, 'payment.registered', 'payment', v_pay.id::text, jsonb_build_object('method', v_pay.method));
  return v_pay;
end;
$$;

create or replace function public.patient_account(p_patient uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_p public.patients;
begin
  perform private.require_uid();
  select * into v_p from public.patients where id = p_patient;
  if v_p.id is null or not private.can_see_patient(v_p.tenant_id, v_p.primary_doctor_id) then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;
  if not private.sees_money(v_p.tenant_id) then
    raise exception 'Sin acceso a montos' using errcode = '42501';
  end if;
  return (
    with q as (
      select q.id, q.folio, q.title, q.status, q.total, q.down_payment, q.installments, private.quote_paid(q.id) as paid
      from public.quotes q
      where q.tenant_id = v_p.tenant_id and q.patient_id = v_p.id and q.status in ('presentado', 'en_duda', 'aceptado', 'en_tratamiento', 'terminado')
    )
    select jsonb_build_object(
      'quotes', coalesce((select jsonb_agg(jsonb_build_object(
          'id', id, 'folio', folio, 'title', title, 'status', status, 'total', total, 'down_payment', down_payment,
          'installments', installments, 'paid', paid, 'balance', total - paid) order by folio desc) from q), '[]'::jsonb),
      'paid_total', (select coalesce(sum(amount), 0) from public.payments where tenant_id = v_p.tenant_id and patient_id = v_p.id and voided_at is null),
      'balance', (select coalesce(sum(total - paid), 0) from q where status in ('aceptado', 'en_tratamiento', 'terminado')),
      'last_payment_at', (select max(paid_at) from public.payments where tenant_id = v_p.tenant_id and patient_id = v_p.id and voided_at is null)
    )
  );
end;
$$;

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
      select m.id, m.role, coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(pr.full_name), ''), 'Sin nombre') as name
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
    order by coalesce(pay.collected, 0) desc, d.name
    limit 200;
end;
$$;

create or replace function public.doctor_history(p_doctor uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
  v_tz text;
begin
  perform private.require_uid();
  select * into v_m from public.memberships where id = p_doctor;
  if v_m.id is null or not private.has_role(v_m.tenant_id, array['owner']::public.tenant_role[]) then
    raise exception 'Doctor no encontrado' using errcode = 'P0002';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Revisa el periodo' using errcode = '22023';
  end if;
  v_tz := private.tenant_tz(v_m.tenant_id);
  return (
    with a as (
      select ap.id, ap.starts_at, ap.ends_at, ap.status, ap.kind, ap.patient_id, pt.full_name as patient, t.name as treatment
      from public.appointments ap
      join public.patients pt on pt.tenant_id = ap.tenant_id and pt.id = ap.patient_id
      left join public.treatments t on t.tenant_id = ap.tenant_id and t.id = ap.treatment_id
      where ap.tenant_id = v_m.tenant_id and ap.doctor_id = v_m.id
    ),
    ap as (select * from a where (a.starts_at at time zone v_tz)::date between p_from and p_to),
    qg as (select * from private.quote_groups(v_m.tenant_id, v_m.id, false, p_from, p_to))
    select jsonb_build_object(
      'appointments', jsonb_build_object(
        'attended', (select count(*) from ap where ap.status = 'llego'),
        'no_show', (select count(*) from ap where ap.status = 'no_asistio'),
        'cancelled', (select count(*) from ap where ap.status = 'cancelada'),
        'total', (select count(*) from ap)
      ),
      'patients', (select count(distinct ap.patient_id) from ap where ap.status = 'llego'),
      'collected', coalesce((
        select sum(x.amount) from public.payments x
        where x.tenant_id = v_m.tenant_id and x.doctor_id = v_m.id and x.voided_at is null
          and (x.paid_at at time zone v_tz)::date between p_from and p_to), 0),
      'commission', coalesce((
        select sum(e.amount) from public.commission_entries e
        where e.tenant_id = v_m.tenant_id and e.doctor_id = v_m.id and e.voided_at is null
          and e.period_date between p_from and p_to), 0),
      'quotes', coalesce((select to_jsonb(qg) - 'doctor_id' from qg limit 1), jsonb_build_object(
        'presented', 0, 'presented_amount', 0, 'accepted', 0, 'accepted_amount', 0, 'waiting', 0, 'waiting_amount', 0,
        'unfinished', 0, 'unfinished_amount', 0, 'lost', 0, 'lost_amount', 0)),
      'upcoming', coalesce((
        select jsonb_agg(jsonb_build_object('id', u.id, 'starts_at', u.starts_at, 'status', u.status, 'kind', u.kind,
          'patient', u.patient, 'treatment', u.treatment) order by u.starts_at)
        from (select * from a where a.starts_at >= now() and a.status in ('programada', 'confirmada')
              order by a.starts_at limit 10) u), '[]'::jsonb),
      'recent', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'starts_at', r.starts_at, 'status', r.status, 'kind', r.kind,
          'patient', r.patient, 'treatment', r.treatment) order by r.starts_at desc)
        from (select * from ap where ap.starts_at < now() order by ap.starts_at desc limit 10) r), '[]'::jsonb)
    )
  );
end;
$$;

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

revoke all on function private.quote_paid(uuid) from public, anon, authenticated;
revoke all on function private.commission_on_payment() from public, anon, authenticated;
revoke all on function private.commission_on_void() from public, anon, authenticated;

commit;
