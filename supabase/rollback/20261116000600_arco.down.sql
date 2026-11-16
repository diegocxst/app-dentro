-- =============================================================================
-- ROLLBACK de 20261116000600_arco.sql
-- DESTRUCTIVO: borra las solicitudes ARCO y las entradas «export» de la bitácora.
-- SOLO en desarrollo con datos ficticios y con aprobación explícita de Diego.
-- =============================================================================
begin;

drop function if exists public.export_patient_data(uuid);
drop function if exists public.update_arco_request(uuid, public.arco_status, text);
drop function if exists public.create_arco_request(uuid, public.arco_right, text, date, text);
drop table if exists public.arco_requests;
drop function if exists private.add_business_days(date, integer);
drop type if exists public.arco_status;
drop type if exists public.arco_right;

delete from public.patient_access_log where action = 'export';
alter table public.patient_access_log drop constraint if exists patient_access_log_action_check;
alter table public.patient_access_log add constraint patient_access_log_action_check
  check (action in ('create', 'view', 'update', 'archive', 'unarchive', 'note'));

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116000600';
  end if;
end $$;

commit;
