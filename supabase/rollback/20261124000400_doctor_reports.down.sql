-- =============================================================================
-- ROLLBACK de 20261124000400_doctor_reports.sql
-- SOLO en desarrollo con datos ficticios y con aprobación explícita de Diego. NUNCA en
-- producción. Son funciones de solo lectura: no se pierde ningún dato.
-- =============================================================================
begin;

drop function if exists public.doctor_history(uuid, date, date);
drop function if exists public.doctor_quote_report(uuid, date, date);
drop function if exists private.quote_groups(uuid, uuid, boolean, date, date);

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261124000400';
  end if;
end $$;

commit;
