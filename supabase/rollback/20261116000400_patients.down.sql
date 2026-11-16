-- =============================================================================
-- ROLLBACK de 20261116000400_patients.sql
-- DESTRUCTIVO: borra pacientes, consentimientos, notas y la bitácora de accesos
-- (datos de salud con retención legal). SOLO en desarrollo con datos ficticios y
-- con aprobación explícita de Diego. NUNCA en producción.
-- =============================================================================
begin;

drop function if exists public.open_patient(uuid);
drop function if exists public.add_patient_note(uuid, text);
drop function if exists public.set_patient_archived(uuid, boolean);
drop function if exists public.update_patient(uuid, text, text, text, text, public.patient_source, text, text[]);
drop function if exists public.create_patient(uuid, text, public.consent_method, date, text, text, public.patient_source, uuid, text[]);
-- Orden: funciones que devuelven filas de estas tablas → tablas (con sus políticas) →
-- helpers que usaban las políticas.
drop function if exists private.require_patient_writer(uuid);
drop table if exists public.patient_access_log;
drop table if exists public.patient_notes;
drop table if exists public.patient_consents;
drop table if exists public.patients;
drop function if exists private.clean_tags(text[]);
drop function if exists private.log_patient_access(uuid, uuid, text);
drop function if exists private.valid_doctor(uuid, uuid);
drop function if exists private.my_membership(uuid);
drop function if exists private.can_see_patient_id(uuid);
drop function if exists private.can_see_patient(uuid, uuid);
alter table public.tenants drop column if exists patient_notice_version;
drop type if exists public.consent_method;
drop type if exists public.patient_source;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116000400';
  end if;
end $$;

commit;
