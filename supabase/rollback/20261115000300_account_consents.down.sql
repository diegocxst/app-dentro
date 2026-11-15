-- =============================================================================
-- ROLLBACK de 20261115000300_account_consents.sql
-- DESTRUCTIVO: borra las versiones del aviso y la EVIDENCIA de consentimiento.
-- Solo con aprobación explícita de Diego y respaldo previo si hay datos.
-- =============================================================================
begin;

drop function if exists public.accept_privacy_notice(text, public.consent_source);
drop table if exists public.account_consents;
drop table if exists public.privacy_notices;
drop type if exists public.consent_source;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261115000300';
  end if;
end $$;

commit;
