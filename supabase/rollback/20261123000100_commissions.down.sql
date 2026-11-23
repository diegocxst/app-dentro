-- =============================================================================
-- ROLLBACK de 20261123000100_commissions.sql
-- DESTRUCTIVO: borra esquemas, comisiones y pagos a doctores. SOLO en desarrollo con
-- datos ficticios y con aprobación explícita de Diego. NUNCA en producción.
-- Los pagos (payments) se quedan como están.
-- =============================================================================
begin;

drop trigger if exists payments_commission_after_void on public.payments;
drop trigger if exists payments_commission_after_insert on public.payments;
drop function if exists public.pay_commissions(uuid, date, date, text);
drop function if exists public.commission_lines(uuid, date, date, integer, integer);
drop function if exists public.commission_summary(uuid, date, date);
drop function if exists public.set_commission_scheme(uuid, public.commission_kind, numeric, numeric);
drop function if exists public.set_commission_period(uuid, text);
drop table if exists public.commission_entries;
drop table if exists public.commission_payouts;
drop table if exists public.commission_schemes;
drop function if exists private.commission_on_void();
drop function if exists private.commission_on_payment();
drop function if exists private.can_see_commissions(uuid, uuid);
drop function if exists private.tenant_tz(uuid);
drop type if exists public.commission_entry_kind;
drop type if exists public.commission_kind;
alter table public.tenants drop column if exists commission_period;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261123000100';
  end if;
end $$;

commit;
