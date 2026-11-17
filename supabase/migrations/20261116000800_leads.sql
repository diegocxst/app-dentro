-- =============================================================================
-- 0013 · Leads (E3 · M1-A)
--
-- Reglas (aprobadas por Diego el 2026-11-16):
--   * Un lead es una persona interesada que todavía no es paciente.
--   * Los ven y trabajan la dueña, la administración y recepción. Los doctores no
--     (hasta que el lead tenga cita con ellos o sea su paciente, en M1-B).
--   * Alta manual: es obligatorio confirmar que se le dio a conocer el aviso de
--     privacidad; se guarda la versión vigente del aviso de la clínica.
--   * Estados: nuevo → contactado → valoración → convertido / perdido. «Convertido»
--     solo lo pone la conversión a paciente (M1-B). «Perdido» exige motivo.
--   * Tiempo de respuesta: primera vez que el lead sale de «nuevo».
--   * Historial de actividad (alta, cambios de estado, notas, asignación).
--   * Sin borrado. Auditoría sin datos personales. El superadmin no ve leads.
-- Rollback: supabase/rollback/20261116000800_leads.down.sql
-- =============================================================================

-- Corrección de 0011: el CHECK de la respuesta ARCO dejaba pasar NULL (una solicitud
-- resuelta sin respuesta escrita directo en la tabla). La RPC ya lo exigía.
do $$
declare
  v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid = 'public.arco_requests'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%btrim(response)%';
  if v_name is not null then
    execute format('alter table public.arco_requests drop constraint %I', v_name);
  end if;
end $$;
alter table public.arco_requests add constraint arco_requests_resolved_response_check
  check (status not in ('atendida', 'improcedente') or coalesce(char_length(btrim(response)), 0) > 0);

create type public.lead_status as enum ('nuevo', 'contactado', 'valoracion', 'convertido', 'perdido');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  interest text not null default '' check (char_length(interest) <= 300),
  source public.patient_source not null default 'manual',
  status public.lead_status not null default 'nuevo',
  lost_reason text check (char_length(lost_reason) <= 300),
  assigned_to uuid,
  notice_version text not null,
  converted_patient_id uuid,
  first_response_at timestamptz,
  status_changed_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, assigned_to) references public.memberships (tenant_id, id),
  foreign key (tenant_id, converted_patient_id) references public.patients (tenant_id, id),
  check (phone_e164 is not null or email is not null),
  -- coalesce: con NULL, «char_length(...) > 0» da «desconocido» y el CHECK lo dejaría pasar.
  check (status <> 'perdido' or coalesce(char_length(btrim(lost_reason)), 0) > 0),
  check ((status = 'convertido') = (converted_patient_id is not null))
);
create index leads_tenant_status_idx on public.leads (tenant_id, status, created_at desc);
create index leads_tenant_created_idx on public.leads (tenant_id, created_at desc);
create index leads_tenant_phone_idx on public.leads (tenant_id, phone_e164);

create trigger leads_set_updated_at before update on public.leads
  for each row execute function private.set_updated_at();

-- Historial del lead: quién hizo qué y cuándo.
create table public.lead_activity (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  lead_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('created', 'status', 'note', 'assigned', 'updated')),
  from_status public.lead_status,
  to_status public.lead_status,
  body text check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, lead_id) references public.leads (tenant_id, id) on delete cascade
);
create index lead_activity_lead_idx on public.lead_activity (tenant_id, lead_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Quien trabaja leads (gerencia y recepción) en una clínica activa. Devuelve el lead.
create or replace function private.require_lead_worker(p_lead uuid)
returns public.leads
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_l public.leads;
begin
  perform private.require_uid();
  select * into v_l from public.leads where id = p_lead;
  if v_l.id is null or not private.has_role(v_l.tenant_id, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'Lead no encontrado' using errcode = 'P0002';
  end if;
  if not private.can_write(v_l.tenant_id, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'Tu clínica está en solo lectura' using errcode = '42501';
  end if;
  return v_l;
end;
$$;

-- El responsable de un lead: miembro activo de gerencia o recepción.
create or replace function private.valid_lead_owner(p_tenant uuid, p_membership uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_membership is null or exists (
    select 1 from public.memberships m
    where m.id = p_membership and m.tenant_id = p_tenant and m.status = 'active'
      and m.role in ('owner', 'admin', 'reception')
  );
$$;

create or replace function private.log_lead(p_tenant uuid, p_lead uuid, p_kind text, p_from public.lead_status default null, p_to public.lead_status default null, p_body text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.lead_activity (tenant_id, lead_id, actor_id, kind, from_status, to_status, body)
  values (p_tenant, p_lead, (select auth.uid()), p_kind, p_from, p_to, p_body);
$$;

revoke all on function private.require_lead_worker(uuid) from public, anon, authenticated;
revoke all on function private.valid_lead_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function private.log_lead(uuid, uuid, text, public.lead_status, public.lead_status, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Alta manual. Exige confirmar que se le dio a conocer el aviso de privacidad.
create or replace function public.create_lead(
  p_tenant uuid,
  p_full_name text,
  p_notice_shared boolean,
  p_phone_e164 text default null,
  p_email text default null,
  p_interest text default '',
  p_source public.patient_source default 'manual',
  p_assigned_to uuid default null
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.leads;
begin
  perform private.require_uid();
  if not private.can_write(p_tenant, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'No tienes permiso para registrar leads' using errcode = '42501';
  end if;
  if p_notice_shared is not true then
    raise exception 'Confirma que le compartiste el aviso de privacidad' using errcode = '22023';
  end if;
  if not private.valid_lead_owner(p_tenant, p_assigned_to) then
    raise exception 'El responsable debe ser de gerencia o recepción' using errcode = '22023';
  end if;

  insert into public.leads (tenant_id, full_name, phone_e164, email, interest, source, assigned_to, notice_version, created_by)
  values (
    p_tenant, btrim(p_full_name),
    nullif(btrim(coalesce(p_phone_e164, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    btrim(coalesce(p_interest, '')),
    coalesce(p_source, 'manual'),
    p_assigned_to,
    (select t.patient_notice_version from public.tenants t where t.id = p_tenant),
    (select auth.uid())
  )
  returning * into v_l;

  perform private.log_lead(v_l.tenant_id, v_l.id, 'created', null, 'nuevo');
  perform private.write_audit(v_l.tenant_id, 'lead.created', 'lead', v_l.id::text, jsonb_build_object('source', v_l.source));
  return v_l;
end;
$$;

-- Editar datos (NULL = no cambiar; '' borra teléfono, correo o responsable).
create or replace function public.update_lead(
  p_lead uuid,
  p_full_name text default null,
  p_phone_e164 text default null,
  p_email text default null,
  p_interest text default null,
  p_source public.patient_source default null,
  p_assigned_to text default null
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.leads := private.require_lead_worker(p_lead);
  v_assigned uuid := case when p_assigned_to is null then v_l.assigned_to else nullif(p_assigned_to, '')::uuid end;
begin
  if not private.valid_lead_owner(v_l.tenant_id, v_assigned) then
    raise exception 'El responsable debe ser de gerencia o recepción' using errcode = '22023';
  end if;

  update public.leads set
    full_name = coalesce(btrim(p_full_name), full_name),
    phone_e164 = case when p_phone_e164 is null then phone_e164 else nullif(btrim(p_phone_e164), '') end,
    email = case when p_email is null then email else nullif(lower(btrim(p_email)), '') end,
    interest = coalesce(btrim(p_interest), interest),
    source = coalesce(p_source, source),
    assigned_to = v_assigned
  where id = p_lead
  returning * into v_l;

  perform private.log_lead(v_l.tenant_id, v_l.id, case when p_assigned_to is not null then 'assigned' else 'updated' end);
  perform private.write_audit(v_l.tenant_id, 'lead.updated', 'lead', v_l.id::text);
  return v_l;
end;
$$;

-- Mover en el embudo. «Convertido» solo por la conversión a paciente (M1-B).
create or replace function public.set_lead_status(p_lead uuid, p_status public.lead_status, p_reason text default null)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.leads := private.require_lead_worker(p_lead);
  v_from public.lead_status := v_l.status;
begin
  if p_status = 'convertido' or v_from = 'convertido' then
    raise exception 'La conversión a paciente se hace desde «Convertir en paciente»' using errcode = '22023';
  end if;
  if p_status = 'perdido' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Escribe por qué se perdió el lead' using errcode = '22023';
  end if;
  if p_status = v_from then
    return v_l;
  end if;

  update public.leads set
    status = p_status,
    lost_reason = case when p_status = 'perdido' then btrim(p_reason) end,
    status_changed_at = now(),
    first_response_at = coalesce(first_response_at, case when v_from = 'nuevo' then now() end)
  where id = p_lead
  returning * into v_l;

  perform private.log_lead(v_l.tenant_id, v_l.id, 'status', v_from, p_status, case when p_status = 'perdido' then btrim(p_reason) end);
  perform private.write_audit(v_l.tenant_id, 'lead.status', 'lead', v_l.id::text, jsonb_build_object('status', p_status));
  return v_l;
end;
$$;

create or replace function public.add_lead_note(p_lead uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.leads := private.require_lead_worker(p_lead);
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'Escribe la nota' using errcode = '22023';
  end if;
  perform private.log_lead(v_l.tenant_id, v_l.id, 'note', null, null, btrim(p_body));
  -- Escribir una nota también cuenta como primera respuesta.
  update public.leads set first_response_at = coalesce(first_response_at, now()) where id = p_lead;
  perform private.write_audit(v_l.tenant_id, 'lead.note', 'lead', v_l.id::text);
end;
$$;

-- Indicadores del tablero (maqueta P11), desde p_since (inicio del mes en la zona de la clínica).
create or replace function public.lead_stats(p_tenant uuid, p_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  perform private.require_uid();
  if not private.has_role(p_tenant, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'leads', count(*) filter (where l.created_at >= p_since),
    'reached_valoracion', count(*) filter (where l.created_at >= p_since and (l.status in ('valoracion', 'convertido')
      or exists (select 1 from public.lead_activity a where a.lead_id = l.id and a.to_status = 'valoracion'))),
    'median_response_minutes', (
      select round(extract(epoch from percentile_cont(0.5) within group (order by x.first_response_at - x.created_at)) / 60)
      from public.leads x
      where x.tenant_id = p_tenant and x.created_at >= p_since and x.first_response_at is not null
    ),
    'unanswered_24h', count(*) filter (where l.status = 'nuevo' and l.first_response_at is null and l.created_at < now() - interval '24 hours')
  ) into v_out
  from public.leads l
  where l.tenant_id = p_tenant;
  return v_out;
end;
$$;

revoke all on function public.create_lead(uuid, text, boolean, text, text, text, public.patient_source, uuid) from public, anon;
grant execute on function public.create_lead(uuid, text, boolean, text, text, text, public.patient_source, uuid) to authenticated;
revoke all on function public.update_lead(uuid, text, text, text, text, public.patient_source, text) from public, anon;
grant execute on function public.update_lead(uuid, text, text, text, text, public.patient_source, text) to authenticated;
revoke all on function public.set_lead_status(uuid, public.lead_status, text) from public, anon;
grant execute on function public.set_lead_status(uuid, public.lead_status, text) to authenticated;
revoke all on function public.add_lead_note(uuid, text) from public, anon;
grant execute on function public.add_lead_note(uuid, text) to authenticated;
revoke all on function public.lead_stats(uuid, timestamptz) from public, anon;
grant execute on function public.lead_stats(uuid, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: solo gerencia y recepción leen leads e historial. Escritura solo por RPC.
-- -----------------------------------------------------------------------------
alter table public.leads enable row level security;
alter table public.lead_activity enable row level security;
revoke all on public.leads, public.lead_activity from anon, authenticated;
grant select on public.leads, public.lead_activity to authenticated;

create policy leads_select on public.leads
  for select to authenticated
  using ((select private.has_role(tenant_id, array['owner', 'admin', 'reception']::public.tenant_role[])));

create policy lead_activity_select on public.lead_activity
  for select to authenticated
  using ((select private.has_role(tenant_id, array['owner', 'admin', 'reception']::public.tenant_role[])));
