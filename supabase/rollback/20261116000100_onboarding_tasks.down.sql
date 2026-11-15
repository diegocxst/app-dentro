-- =============================================================================
-- ROLLBACK de 20261116000100_onboarding_tasks.sql
-- Quita la RPC y el valor por omisión. El avance guardado en onboarding_state se
-- conserva (no se pierde información). Solo con aprobación de Diego.
-- =============================================================================
begin;

drop function if exists public.set_onboarding_task(uuid, text, boolean);
drop function if exists private.is_onboarding_task(text);
alter table public.tenants alter column onboarding_state set default '{}'::jsonb;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116000100';
  end if;
end $$;

commit;
