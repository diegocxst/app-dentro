-- =============================================================================
-- 0008 · Horario de atención por sucursal (E3 · M10, base de la agenda M3)
-- branches.opening_hours = { "mon": [["09:00","14:00"],["16:00","20:00"]], … }
-- Días: mon tue wed thu fri sat sun. Sin el día = cerrado. Hasta 3 tramos por día,
-- en orden y sin encimarse. Hora local de la sucursal (la zona se agrega con la agenda).
-- Escritura solo por RPC (propietario o administración de una clínica activa).
-- Rollback: supabase/rollback/20261116000300_branch_hours.down.sql
-- =============================================================================

-- ¿El horario tiene la forma correcta?
create or replace function private.valid_opening_hours(p_hours jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day text;
  v_ranges jsonb;
  v_range jsonb;
  v_prev_end text;
  v_start text;
  v_end text;
begin
  if p_hours is null or jsonb_typeof(p_hours) <> 'object' then
    return false;
  end if;
  for v_day, v_ranges in select key, value from jsonb_each(p_hours) loop
    if v_day not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun') then return false; end if;
    if jsonb_typeof(v_ranges) <> 'array' or jsonb_array_length(v_ranges) > 3 then return false; end if;
    v_prev_end := null;
    for v_range in select value from jsonb_array_elements(v_ranges) loop
      if jsonb_typeof(v_range) <> 'array' or jsonb_array_length(v_range) <> 2 then return false; end if;
      v_start := v_range ->> 0;
      v_end := v_range ->> 1;
      if v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
      if v_start >= v_end then return false; end if;
      if v_prev_end is not null and v_start < v_prev_end then return false; end if;
      v_prev_end := v_end;
    end loop;
  end loop;
  return true;
end;
$$;

alter table public.branches
  add column opening_hours jsonb not null default '{}'::jsonb
  check (private.valid_opening_hours(opening_hours));

create or replace function public.set_branch_hours(p_branch uuid, p_hours jsonb)
returns public.branches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches;
begin
  select * into v_branch from public.branches where id = p_branch;
  if v_branch.id is null then
    raise exception 'Sucursal no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_branch.tenant_id);
  if not private.valid_opening_hours(p_hours) then
    raise exception 'Revisa el horario: cada tramo debe empezar antes de terminar y no encimarse' using errcode = '22023';
  end if;

  update public.branches set opening_hours = p_hours where id = p_branch returning * into v_branch;
  perform private.write_audit(v_branch.tenant_id, 'branch.hours_set', 'branch', v_branch.id::text);
  return v_branch;
end;
$$;

-- El CHECK de la tabla la usa: debe poder ejecutarla quien lea o escriba (como is_reserved_slug).
grant execute on function private.valid_opening_hours(jsonb) to authenticated;
revoke all on function public.set_branch_hours(uuid, jsonb) from public, anon;
grant execute on function public.set_branch_hours(uuid, jsonb) to authenticated;
