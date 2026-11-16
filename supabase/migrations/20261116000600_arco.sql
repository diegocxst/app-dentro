-- =============================================================================
-- 0011 · Derechos ARCO del paciente (E3 · M2-B) — DATOS DE SALUD
--
-- Reglas (aprobadas por Diego el 2026-11-16):
--   * Solicitudes ARCO (acceso, rectificación, cancelación, oposición): las REGISTRA
--     la dueña, la administración o recepción; las VE y RESUELVE solo la gerencia.
--   * Cancelación: solo se registra la solicitud y su respuesta (la clínica decide;
--     el expediente se conserva 5 años por NOM-004). Sin borrado automático.
--   * Plazo de respuesta: 20 días hábiles (lun–vie, sin feriados) desde la recepción.
--     Sujeto a la revisión legal (P5).
--   * Exportar los datos del paciente (acceso / portabilidad): solo gerencia, aunque
--     la clínica esté suspendida; REGISTRA el acceso. Incluye datos, consentimientos,
--     notas, lista de documentos (sin archivos ni rutas), accesos y solicitudes.
--   * El superadmin no ve solicitudes ni exporta. Auditoría sin datos en claro.
-- Rollback: supabase/rollback/20261116000600_arco.down.sql
-- =============================================================================

create type public.arco_right as enum ('acceso', 'rectificacion', 'cancelacion', 'oposicion');
create type public.arco_status as enum ('recibida', 'en_proceso', 'atendida', 'improcedente');

create table public.arco_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  patient_id uuid not null,
  "right" public.arco_right not null,
  channel text not null check (channel in ('presencial', 'correo', 'telefono', 'whatsapp', 'otro')),
  received_on date not null,
  due_on date not null,
  details text check (char_length(details) <= 1000),
  status public.arco_status not null default 'recibida',
  response text check (char_length(response) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients (tenant_id, id) on delete cascade,
  check (due_on >= received_on),
  -- Resuelta ⇔ con fecha y respuesta.
  check ((status in ('atendida', 'improcedente')) = (resolved_at is not null)),
  check (status not in ('atendida', 'improcedente') or char_length(btrim(response)) > 0)
);
create index arco_requests_tenant_idx on public.arco_requests (tenant_id, status, due_on);
create index arco_requests_patient_idx on public.arco_requests (tenant_id, patient_id, created_at desc);

-- La bitácora de pacientes registra también la exportación.
alter table public.patient_access_log drop constraint patient_access_log_action_check;
alter table public.patient_access_log add constraint patient_access_log_action_check
  check (action in ('create', 'view', 'update', 'archive', 'unarchive', 'note', 'export'));

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Suma días hábiles (lunes a viernes). Los feriados se ajustan cuando haya calendario.
create or replace function private.add_business_days(p_from date, p_days integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day date := p_from;
  v_left integer := p_days;
begin
  while v_left > 0 loop
    v_day := v_day + 1;
    if extract(isodow from v_day) < 6 then
      v_left := v_left - 1;
    end if;
  end loop;
  return v_day;
end;
$$;

revoke all on function private.add_business_days(date, integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Registra una solicitud ARCO. Devuelve solo el id (recepción no las lee).
create or replace function public.create_arco_request(
  p_patient uuid,
  p_right public.arco_right,
  p_channel text,
  p_received_on date,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.patients;
  v_id uuid;
begin
  perform private.require_uid();
  select * into v_p from public.patients where id = p_patient;
  if v_p.id is null or not private.can_see_patient(v_p.tenant_id, v_p.primary_doctor_id) then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;
  if not private.can_write(v_p.tenant_id, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'Solo la dueña, la administración o recepción registran solicitudes' using errcode = '42501';
  end if;
  if p_received_on is null or p_received_on > current_date or p_received_on < current_date - 365 then
    raise exception 'Revisa la fecha en que llegó la solicitud' using errcode = '22023';
  end if;

  insert into public.arco_requests (tenant_id, patient_id, "right", channel, received_on, due_on, details, created_by)
  values (
    v_p.tenant_id, v_p.id, p_right, p_channel, p_received_on,
    private.add_business_days(p_received_on, 20),
    nullif(btrim(p_details), ''),
    (select auth.uid())
  )
  returning id into v_id;

  perform private.write_audit(v_p.tenant_id, 'arco.created', 'arco_request', v_id::text,
    jsonb_build_object('right', p_right));
  return v_id;
end;
$$;

-- Cambia el estado de una solicitud. Solo gerencia. Una solicitud resuelta no se reabre.
create or replace function public.update_arco_request(
  p_request uuid,
  p_status public.arco_status,
  p_response text default null
)
returns public.arco_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.arco_requests;
  v_done boolean := p_status in ('atendida', 'improcedente');
begin
  perform private.require_uid();
  select * into v_r from public.arco_requests where id = p_request;
  if v_r.id is null or not private.has_role(v_r.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;
  if not private.can_write(v_r.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Tu clínica está en solo lectura' using errcode = '42501';
  end if;
  if v_r.status in ('atendida', 'improcedente') then
    raise exception 'La solicitud ya está resuelta' using errcode = '22023';
  end if;
  if p_status = 'recibida' then
    raise exception 'Estado inválido' using errcode = '22023';
  end if;
  if v_done and coalesce(btrim(p_response), '') = '' then
    raise exception 'Escribe la respuesta que diste al paciente' using errcode = '22023';
  end if;

  update public.arco_requests set
    status = p_status,
    response = coalesce(nullif(btrim(p_response), ''), response),
    resolved_at = case when v_done then now() end,
    resolved_by = case when v_done then (select auth.uid()) end
  where id = p_request
  returning * into v_r;

  perform private.write_audit(v_r.tenant_id, 'arco.updated', 'arco_request', v_r.id::text,
    jsonb_build_object('status', v_r.status));
  return v_r;
end;
$$;

-- Exporta todo lo que la clínica guarda del paciente. Solo gerencia; registra el acceso.
create or replace function public.export_patient_data(p_patient uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.patients;
  v_t public.tenants;
begin
  perform private.require_uid();
  select * into v_p from public.patients where id = p_patient;
  if v_p.id is null or not private.has_role(v_p.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;
  select * into v_t from public.tenants where id = v_p.tenant_id;

  perform private.log_patient_access(v_p.tenant_id, v_p.id, 'export');
  perform private.write_audit(v_p.tenant_id, 'patient.exported', 'patient', v_p.id::text);

  return jsonb_build_object(
    'format', 'dentro.patient-export.v1',
    'generated_at', now(),
    'clinic', jsonb_build_object('name', v_t.display_name, 'city', v_t.city, 'notice_version', v_t.patient_notice_version),
    'patient', jsonb_build_object(
      'id', v_p.id,
      'full_name', v_p.full_name,
      'birth_date', v_p.birth_date,
      'phone_e164', v_p.phone_e164,
      'email', v_p.email,
      'source', v_p.source,
      'tags', to_jsonb(v_p.tags),
      'primary_doctor', (
        select pr.full_name from public.memberships m
        left join public.profiles pr on pr.id = m.user_id
        where m.id = v_p.primary_doctor_id
      ),
      'archived_at', v_p.archived_at,
      'created_at', v_p.created_at,
      'updated_at', v_p.updated_at
    ),
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object('method', c.method, 'notice_version', c.notice_version, 'recorded_at', c.recorded_at)
        order by c.recorded_at)
      from public.patient_consents c where c.tenant_id = v_p.tenant_id and c.patient_id = v_p.id
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('body', n.body, 'created_at', n.created_at, 'author', coalesce(pr.full_name, ''))
        order by n.created_at)
      from public.patient_notes n
      left join public.profiles pr on pr.id = n.author_id
      where n.tenant_id = v_p.tenant_id and n.patient_id = v_p.id
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
          'name', d.name, 'kind', d.kind, 'mime', d.mime, 'size_bytes', d.size_bytes,
          'created_at', d.created_at, 'archived_at', d.archived_at)
        order by d.created_at)
      from public.patient_documents d where d.tenant_id = v_p.tenant_id and d.patient_id = v_p.id
    ), '[]'::jsonb),
    'access_log', coalesce((
      select jsonb_agg(x.e order by x.at)
      from (
        select l.created_at as at, jsonb_build_object('at', l.created_at, 'action', l.action, 'target', 'ficha', 'by', coalesce(pr.full_name, '')) as e
        from public.patient_access_log l
        left join public.profiles pr on pr.id = l.actor_id
        where l.tenant_id = v_p.tenant_id and l.patient_id = v_p.id
        union all
        select dl.created_at, jsonb_build_object('at', dl.created_at, 'action', dl.action, 'target', d.name, 'by', coalesce(pr.full_name, ''))
        from public.document_access_log dl
        join public.patient_documents d on d.tenant_id = dl.tenant_id and d.id = dl.document_id
        left join public.profiles pr on pr.id = dl.actor_id
        where d.tenant_id = v_p.tenant_id and d.patient_id = v_p.id
      ) x
    ), '[]'::jsonb),
    'arco_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
          'right', r."right", 'channel', r.channel, 'received_on', r.received_on, 'due_on', r.due_on,
          'status', r.status, 'response', r.response, 'resolved_at', r.resolved_at)
        order by r.received_on)
      from public.arco_requests r where r.tenant_id = v_p.tenant_id and r.patient_id = v_p.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_arco_request(uuid, public.arco_right, text, date, text) from public, anon;
grant execute on function public.create_arco_request(uuid, public.arco_right, text, date, text) to authenticated;
revoke all on function public.update_arco_request(uuid, public.arco_status, text) from public, anon;
grant execute on function public.update_arco_request(uuid, public.arco_status, text) to authenticated;
revoke all on function public.export_patient_data(uuid) from public, anon;
grant execute on function public.export_patient_data(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: solo gerencia lee las solicitudes. Escritura solo por RPC.
-- -----------------------------------------------------------------------------
alter table public.arco_requests enable row level security;
revoke all on public.arco_requests from anon, authenticated;
grant select on public.arco_requests to authenticated;

create policy arco_requests_select on public.arco_requests
  for select to authenticated
  using ((select private.has_role(tenant_id, array['owner', 'admin']::public.tenant_role[])));
