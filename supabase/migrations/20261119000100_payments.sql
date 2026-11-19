-- =============================================================================
-- 0016 · Pagos y abonos (E3 · M5-A)
--
-- Reglas (aprobadas por Diego el 2026-11-19):
--   * Registro MANUAL (el link de pago llega en E6). El dinero nunca pasa por dentro.
--   * Registran la dueña, la administración y recepción. Un doctor VE los pagos de sus
--     pacientes (seguimiento y comisiones) pero no registra ni ve los totales de la clínica.
--   * No se borran: la gerencia los ANULA con motivo (dejan de contar en saldos).
--   * El primer pago de un presupuesto presentado o en duda lo pasa a «Aceptado».
--   * Un pago a un presupuesto no puede superar su saldo.
--   * Cada pago se atribuye a un doctor (el del presupuesto o el tratante): base de
--     las comisiones de M6. Folio por clínica (R-0001…) para el comprobante (M5-B).
--   * Auditoría sin montos ni datos del paciente. El superadmin no ve pagos.
-- Rollback: supabase/rollback/20261119000100_payments.down.sql
-- =============================================================================

create type public.payment_method as enum ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito', 'otro');

alter table public.tenants add column payment_seq integer not null default 0 check (payment_seq >= 0);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  folio integer not null check (folio > 0),
  patient_id uuid not null,
  quote_id uuid,
  doctor_id uuid,
  amount numeric(12, 2) not null check (amount > 0 and amount <= 10000000),
  method public.payment_method not null,
  paid_at timestamptz not null default now(),
  reference text check (char_length(reference) <= 80),
  notes text check (char_length(notes) <= 300),
  registered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (char_length(void_reason) <= 300),
  unique (tenant_id, id),
  unique (tenant_id, folio),
  foreign key (tenant_id, patient_id) references public.patients (tenant_id, id) on delete cascade,
  foreign key (tenant_id, quote_id) references public.quotes (tenant_id, id),
  foreign key (tenant_id, doctor_id) references public.memberships (tenant_id, id),
  check ((voided_at is null) = (void_reason is null))
);
create index payments_tenant_paid_idx on public.payments (tenant_id, paid_at desc);
create index payments_patient_idx on public.payments (tenant_id, patient_id, paid_at desc);
create index payments_quote_idx on public.payments (tenant_id, quote_id) where quote_id is not null;
create index payments_doctor_idx on public.payments (tenant_id, doctor_id, paid_at desc);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Lo pagado (sin anulados) de un presupuesto.
create or replace function private.quote_paid(p_quote uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0) from public.payments where quote_id = p_quote and voided_at is null;
$$;

revoke all on function private.quote_paid(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

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

-- Anular (no se borra). Solo gerencia, con motivo.
create or replace function public.void_payment(p_payment uuid, p_reason text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
begin
  perform private.require_uid();
  select * into v_pay from public.payments where id = p_payment;
  if v_pay.id is null or not private.has_role(v_pay.tenant_id, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'Pago no encontrado' using errcode = 'P0002';
  end if;
  if not private.can_write(v_pay.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Solo la dueña o la administración anulan pagos' using errcode = '42501';
  end if;
  if v_pay.voided_at is not null then
    raise exception 'El pago ya está anulado' using errcode = '22023';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Escribe por qué se anula' using errcode = '22023';
  end if;

  update public.payments set voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
  where id = p_payment returning * into v_pay;
  perform private.write_audit(v_pay.tenant_id, 'payment.voided', 'payment', v_pay.id::text);
  return v_pay;
end;
$$;

-- Cuenta del paciente: presupuestos con lo pagado y el saldo. Quien ve al paciente.
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

-- Indicadores y saldos de la clínica (P21). Solo gerencia y recepción.
create or replace function public.payment_stats(p_tenant uuid, p_day_start timestamptz, p_month_start timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_uid();
  if not private.has_role(p_tenant, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'today', (select coalesce(sum(amount), 0) from public.payments where tenant_id = p_tenant and voided_at is null and paid_at >= p_day_start),
    'month', (select coalesce(sum(amount), 0) from public.payments where tenant_id = p_tenant and voided_at is null and paid_at >= p_month_start),
    'month_count', (select count(*) from public.payments where tenant_id = p_tenant and voided_at is null and paid_at >= p_month_start),
    'receivable', (select coalesce(sum(q.total - private.quote_paid(q.id)), 0) from public.quotes q
                   where q.tenant_id = p_tenant and q.status in ('aceptado', 'en_tratamiento', 'terminado'))
  );
end;
$$;

-- Pacientes con saldo (P21 › Saldos). Solo gerencia y recepción.
create or replace function public.receivables(p_tenant uuid)
returns table (patient_id uuid, full_name text, phone_e164 text, balance numeric, quotes integer, last_payment_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_uid();
  if not private.has_role(p_tenant, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.phone_e164, sum(q.total - private.quote_paid(q.id))::numeric, count(*)::integer,
      (select max(x.paid_at) from public.payments x where x.tenant_id = p_tenant and x.patient_id = p.id and x.voided_at is null)
    from public.quotes q
    join public.patients p on p.tenant_id = q.tenant_id and p.id = q.patient_id
    where q.tenant_id = p_tenant and q.status in ('aceptado', 'en_tratamiento', 'terminado')
    group by p.id, p.full_name, p.phone_e164
    having sum(q.total - private.quote_paid(q.id)) > 0
    order by 4 desc
    limit 200;
end;
$$;

-- quote_stats ahora incluye lo cobrado del mes en presupuestos (maqueta P18: «Anticipos cobrados»).
create or replace function public.quote_stats(p_tenant uuid, p_since timestamptz, p_doctor uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  perform private.require_uid();
  if not private.is_member(p_tenant) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  with mine as (
    select q.* from public.quotes q
    join public.patients p on p.tenant_id = q.tenant_id and p.id = q.patient_id
    where q.tenant_id = p_tenant
      and private.can_see_patient(p.tenant_id, p.primary_doctor_id)
      and (p_doctor is null or q.doctor_id = p_doctor)
  )
  select jsonb_build_object(
    'won', count(*) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado')),
    'decided', count(*) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado', 'perdido')),
    'in_doubt_total', coalesce(sum(total) filter (where status = 'en_duda'), 0),
    'avg_ticket', round(coalesce(avg(total) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado')), 0)),
    'collected', (select coalesce(sum(pay.amount), 0) from public.payments pay
                  where pay.voided_at is null and pay.paid_at >= p_since and pay.quote_id in (select id from mine))
  ) into v_out
  from mine;
  return v_out;
end;
$$;

revoke all on function public.register_payment(uuid, numeric, public.payment_method, timestamptz, uuid, text, text) from public, anon;
grant execute on function public.register_payment(uuid, numeric, public.payment_method, timestamptz, uuid, text, text) to authenticated;
revoke all on function public.void_payment(uuid, text) from public, anon;
grant execute on function public.void_payment(uuid, text) to authenticated;
revoke all on function public.patient_account(uuid) from public, anon;
grant execute on function public.patient_account(uuid) to authenticated;
revoke all on function public.payment_stats(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.payment_stats(uuid, timestamptz, timestamptz) to authenticated;
revoke all on function public.receivables(uuid) from public, anon;
grant execute on function public.receivables(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: los ve quien ve al paciente (gerencia y recepción todos; el doctor, los de sus
-- pacientes). Escritura solo por RPC.
-- -----------------------------------------------------------------------------
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

create policy payments_select on public.payments
  for select to authenticated
  using ((select private.can_see_patient_id(patient_id)));
