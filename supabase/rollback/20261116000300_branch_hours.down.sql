-- =============================================================================
-- ROLLBACK de 20261116000300_branch_hours.sql
-- DESTRUCTIVO: borra los horarios guardados. Solo con aprobación de Diego.
-- =============================================================================
begin;

drop function if exists public.set_branch_hours(uuid, jsonb);
alter table public.branches drop column if exists opening_hours;
drop function if exists private.valid_opening_hours(jsonb);

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116000300';
  end if;
end $$;

commit;
