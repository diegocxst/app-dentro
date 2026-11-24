-- =============================================================================
-- ROLLBACK de 20261124000100_profile_title.sql
-- SOLO en desarrollo con datos ficticios y con aprobación explícita de Diego. NUNCA en
-- producción. Se pierde el título que cada persona eligió (no es dato clínico).
-- =============================================================================
begin;

drop function if exists public.update_my_profile(text, text, text);

-- Versión anterior (0001).
create function public.update_my_profile(
  p_full_name text default null,
  p_phone_e164 text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_profile public.profiles;
begin
  update public.profiles set
    full_name = coalesce(left(btrim(p_full_name), 120), full_name),
    phone_e164 = case when p_phone_e164 is null then phone_e164
                      else nullif(btrim(p_phone_e164), '') end
  where id = v_uid
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Perfil no encontrado' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;
revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;

alter table public.profiles drop column if exists title;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261124000100';
  end if;
end $$;

commit;
