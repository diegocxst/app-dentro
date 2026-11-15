-- =============================================================================
-- 0006 · Avance de la guía de inicio (E2-A)
-- Decisión 2026-11-10: guía de 7 tareas. El avance vive en
-- tenants.onboarding_state = { "tasks": { "<tarea>": true, … } } y solo se
-- cambia por esta RPC (propietario o administración de una clínica activa).
-- «identity» se da por hecha al crear la clínica.
-- Rollback: supabase/rollback/20261116000100_onboarding_tasks.down.sql
-- =============================================================================

create or replace function private.is_onboarding_task(p_task text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_task in ('identity', 'branches', 'team', 'treatments', 'whatsapp', 'first_patient', 'first_quote');
$$;

create or replace function public.set_onboarding_task(p_tenant uuid, p_task text, p_done boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state jsonb;
begin
  perform private.require_manager(p_tenant);
  if not private.is_onboarding_task(p_task) then
    raise exception 'Tarea de la guía desconocida' using errcode = '22023';
  end if;

  update public.tenants
  set onboarding_state = jsonb_set(
        case when jsonb_typeof(onboarding_state -> 'tasks') = 'object' then onboarding_state
             else onboarding_state || '{"tasks": {}}'::jsonb end,
        array['tasks', p_task],
        to_jsonb(coalesce(p_done, false)))
  where id = p_tenant
  returning onboarding_state into v_state;

  perform private.write_audit(p_tenant, 'onboarding.task_set', 'tenant', p_tenant::text,
    jsonb_build_object('task', p_task, 'done', coalesce(p_done, false)));
  return v_state;
end;
$$;

-- Las clínicas nuevas empiezan con la identidad hecha (P04 paso 1).
update public.tenants
set onboarding_state = jsonb_set(
      case when jsonb_typeof(onboarding_state -> 'tasks') = 'object' then onboarding_state
           else onboarding_state || '{"tasks": {}}'::jsonb end,
      '{tasks,identity}', 'true'::jsonb)
where coalesce(onboarding_state #>> '{tasks,identity}', '') <> 'true';

alter table public.tenants alter column onboarding_state set default '{"tasks": {"identity": true}}'::jsonb;

revoke all on function private.is_onboarding_task(text) from public, anon, authenticated;
revoke all on function public.set_onboarding_task(uuid, text, boolean) from public, anon;
grant execute on function public.set_onboarding_task(uuid, text, boolean) to authenticated;
