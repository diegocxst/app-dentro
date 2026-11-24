-- =============================================================================
-- 0019 · Título en el perfil (E3 · Ajustes-D)
--
-- Reglas (aprobadas por Diego el 2026-11-24):
--   * Cada persona elige en «Mi perfil» su título: «Dr.», «Dra.» o sin título ('').
--     Va antes de su nombre en el encabezado del menú (con su rol y su correo).
--   * Es de la cuenta (profiles), no de una clínica: la acompaña en todas sus clínicas.
--     Lo ven sus compañeros de clínica (misma RLS de profiles); lo cambia solo ella.
--   * Para un doctor sin acceso, la gerencia lo escribe en su «Nombre en tu clínica».
--   * Escritura solo por la RPC update_my_profile (security definer); sin auditoría,
--     como el resto del perfil propio.
-- Rollback: supabase/rollback/20261124000100_profile_title.down.sql
-- =============================================================================

alter table public.profiles
  add column title text not null default '' check (title in ('', 'Dr.', 'Dra.'));

-- Perfil propio. NULL = no cambiar; '' en el teléfono lo borra; '' en el título lo quita.
drop function if exists public.update_my_profile(text, text);
create function public.update_my_profile(
  p_full_name text default null,
  p_phone_e164 text default null,
  p_title text default null
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
  if p_title is not null and btrim(p_title) not in ('', 'Dr.', 'Dra.') then
    raise exception 'Título inválido' using errcode = '22023';
  end if;

  update public.profiles set
    full_name = coalesce(left(btrim(p_full_name), 120), full_name),
    phone_e164 = case when p_phone_e164 is null then phone_e164
                      else nullif(btrim(p_phone_e164), '') end,
    title = coalesce(btrim(p_title), title)
  where id = v_uid
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Perfil no encontrado' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

revoke all on function public.update_my_profile(text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
