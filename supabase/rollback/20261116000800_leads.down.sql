-- =============================================================================
-- ROLLBACK de 20261116000800_leads.sql
-- DESTRUCTIVO: borra leads e historial. SOLO en desarrollo con datos ficticios y con
-- aprobación explícita de Diego. NUNCA en producción.
-- =============================================================================
begin;

drop function if exists public.lead_stats(uuid, timestamptz);
drop function if exists public.add_lead_note(uuid, text);
drop function if exists public.set_lead_status(uuid, public.lead_status, text);
drop function if exists public.update_lead(uuid, text, text, text, text, public.patient_source, text);
drop function if exists public.create_lead(uuid, text, boolean, text, text, text, public.patient_source, uuid);
drop function if exists private.require_lead_worker(uuid);
drop table if exists public.lead_activity;
drop table if exists public.leads;
drop function if exists private.log_lead(uuid, uuid, text, public.lead_status, public.lead_status, text);
drop function if exists private.valid_lead_owner(uuid, uuid);
drop type if exists public.lead_status;
alter table public.arco_requests drop constraint if exists arco_requests_resolved_response_check;
alter table public.arco_requests add check (status not in ('atendida', 'improcedente') or char_length(btrim(response)) > 0);

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116000800';
  end if;
end $$;

commit;
