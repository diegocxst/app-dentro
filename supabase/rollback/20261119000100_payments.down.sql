-- =============================================================================
-- ROLLBACK de 20261119000100_payments.sql
-- DESTRUCTIVO: borra todos los pagos. SOLO en desarrollo con datos ficticios y con
-- aprobación explícita de Diego. NUNCA en producción. Las etapas de presupuestos que
-- un pago movió a «Aceptado» se quedan así.
-- =============================================================================
begin;

drop function if exists public.receivables(uuid);
drop function if exists public.payment_stats(uuid, timestamptz, timestamptz);
drop function if exists public.patient_account(uuid);
drop function if exists public.void_payment(uuid, text);
drop function if exists public.register_payment(uuid, numeric, public.payment_method, timestamptz, uuid, text, text);
drop table if exists public.payments;
drop function if exists private.quote_paid(uuid);
drop type if exists public.payment_method;
alter table public.tenants drop column if exists payment_seq;

-- quote_stats de 0015 (sin «collected»).
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
    'avg_ticket', round(coalesce(avg(total) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado')), 0))
  ) into v_out
  from mine;
  return v_out;
end;
$$;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261119000100';
  end if;
end $$;

commit;
