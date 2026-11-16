-- =============================================================================
-- ROLLBACK de 20261116000200_chairs_treatments.sql
-- DESTRUCTIVO: borra sillones y el catálogo de tratamientos. Solo con aprobación de Diego.
-- =============================================================================
begin;

drop function if exists public.create_chair(uuid, text);
drop function if exists public.update_chair(uuid, text, boolean);
drop function if exists public.save_treatments(uuid, jsonb);
drop table if exists public.treatments;
drop table if exists public.chairs;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116000200';
  end if;
end $$;

commit;
