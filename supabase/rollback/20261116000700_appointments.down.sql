-- =============================================================================
-- ROLLBACK de 20261116000700_appointments.sql
-- DESTRUCTIVO: borra todas las citas. SOLO en desarrollo con datos ficticios y con
-- aprobación explícita de Diego. NUNCA en producción.
-- =============================================================================
begin;

drop function if exists public.list_appointments(timestamptz, timestamptz, uuid, uuid);
drop function if exists public.set_appointment_status(uuid, public.appointment_status, text);
drop function if exists public.update_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, public.appointment_kind, uuid, text);
drop function if exists public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, public.appointment_kind, uuid, text);
drop function if exists private.check_appointment(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz);
drop table if exists public.appointments;
drop function if exists private.within_branch_hours(uuid, timestamptz, timestamptz);
drop function if exists private.can_see_appointment(uuid, uuid, uuid);
drop function if exists private.membership_in_branch(uuid, uuid);
drop type if exists public.appointment_status;
drop type if exists public.appointment_kind;
alter table public.chairs drop constraint if exists chairs_tenant_branch_id_key;
drop function if exists public.set_branch_timezone(uuid, text);
alter table public.branches drop column if exists timezone;
-- btree_gist se deja instalada (puede usarla otra migración).

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116000700';
  end if;
end $$;

commit;
