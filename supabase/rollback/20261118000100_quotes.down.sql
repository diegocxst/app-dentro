-- =============================================================================
-- ROLLBACK de 20261118000100_quotes.sql
-- DESTRUCTIVO: borra todos los presupuestos. SOLO en desarrollo con datos ficticios y
-- con aprobación explícita de Diego. NUNCA en producción.
-- =============================================================================
begin;

drop function if exists public.quote_stats(uuid, timestamptz, uuid);
drop function if exists public.mark_quote_followup(uuid);
drop function if exists public.set_quote_status(uuid, public.quote_status, text);
drop function if exists public.save_quote(uuid, uuid, uuid, jsonb, text, numeric, integer, date, text);
drop function if exists private.require_quote_writer(uuid);
drop table if exists public.quote_items;
drop table if exists public.quotes;
drop type if exists public.quote_status;
alter table public.tenants drop column if exists quote_seq;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261118000100';
  end if;
end $$;

commit;
