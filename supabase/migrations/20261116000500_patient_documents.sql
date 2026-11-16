-- =============================================================================
-- 0010 · Documentos del paciente (E3 · M7) — DATOS DE SALUD
--
-- Reglas (aprobadas por Diego el 2026-11-16):
--   * Bucket PRIVADO `patient-documents`: <tenant>/<paciente>/<uuid>.<ext>.
--     PDF, JPG, PNG, WebP y STL; hasta 25 MB.
--   * Sube quien puede ver al paciente y escribir en su clínica (activa).
--   * NADIE lee el bucket directo: no hay política SELECT. Ver o descargar pasa por
--     la Edge Function `document-url`, que llama a authorize_document_access()
--     (revisa permiso y REGISTRA el acceso) y firma un enlace de 60 s.
--   * No se borra: se archiva. Retención mínima de 5 años (NOM-004).
--   * El superadmin no ve documentos. Auditoría y bitácora sin datos en claro.
-- Rollback: supabase/rollback/20261116000500_patient_documents.down.sql
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents', 'patient-documents', false, 26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'model/stl', 'application/sla', 'application/vnd.ms-pki.stl', 'application/octet-stream']
);

create type public.document_kind as enum ('radiografia', 'foto', 'receta', 'consentimiento', 'presupuesto', 'formulario', 'modelo', 'otro');

create table public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  patient_id uuid not null,
  kind public.document_kind not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  storage_path text not null unique,
  mime text not null check (char_length(mime) <= 100),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  retain_until date not null default (current_date + interval '5 years'),
  archived_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients (tenant_id, id) on delete cascade
);
create index patient_documents_patient_idx on public.patient_documents (tenant_id, patient_id, created_at desc);

create table public.document_access_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  document_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('upload', 'view', 'download', 'archive', 'unarchive')),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, document_id) references public.patient_documents (tenant_id, id) on delete cascade
);
create index document_access_log_tenant_idx on public.document_access_log (tenant_id, created_at desc);
create index document_access_log_document_idx on public.document_access_log (tenant_id, document_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Rutas
-- -----------------------------------------------------------------------------

-- ¿La ruta es <tenant>/<paciente>/<uuid>.<ext> de ESTE paciente?
create or replace function private.is_document_path(p_tenant uuid, p_patient uuid, p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name ~ ('^' || p_tenant::text || '/' || p_patient::text || '/[0-9a-f-]{36}\.(pdf|jpg|png|webp|stl)$');
$$;

-- Paciente de un objeto del bucket (segundo segmento), o NULL.
create or replace function private.document_patient(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    then split_part(p_name, '/', 2)::uuid
  end;
$$;

-- ¿Quien llama puede subir un documento a esta ruta?
create or replace function private.can_upload_document(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patients p
    where p.id = private.document_patient(p_name)
      and private.is_document_path(p.tenant_id, p.id, p_name)
      and private.can_see_patient(p.tenant_id, p.primary_doctor_id)
      and private.can_write(p.tenant_id, array['owner', 'admin', 'reception', 'doctor', 'doctor_collab']::public.tenant_role[])
  );
$$;

grant execute on function private.is_document_path(uuid, uuid, text) to authenticated;
grant execute on function private.document_patient(text) to authenticated;
revoke all on function private.can_upload_document(text) from public, anon;
grant execute on function private.can_upload_document(text) to authenticated;

-- Storage: solo SUBIR (sin SELECT, UPDATE ni DELETE para la app).
create policy patient_documents_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'patient-documents' and (select private.can_upload_document(name)));

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Registra un archivo ya subido. Verifica que exista en el bucket y que la ruta
-- sea de ese paciente. Devuelve el documento.
create or replace function public.register_document(
  p_patient uuid,
  p_kind public.document_kind,
  p_name text,
  p_storage_path text
)
returns public.patient_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.patients := private.require_patient_writer(p_patient);
  v_obj record;
  v_doc public.patient_documents;
begin
  if not private.is_document_path(v_p.tenant_id, v_p.id, p_storage_path) then
    raise exception 'El archivo no corresponde a este paciente' using errcode = '22023';
  end if;
  select o.metadata into v_obj from storage.objects o
  where o.bucket_id = 'patient-documents' and o.name = p_storage_path;
  if not found then
    raise exception 'No encontramos el archivo subido' using errcode = 'P0002';
  end if;

  insert into public.patient_documents (tenant_id, patient_id, kind, name, storage_path, mime, size_bytes, uploaded_by)
  values (
    v_p.tenant_id, v_p.id, p_kind, btrim(p_name), p_storage_path,
    coalesce(v_obj.metadata ->> 'mimetype', 'application/octet-stream'),
    coalesce((v_obj.metadata ->> 'size')::bigint, 1),
    (select auth.uid())
  )
  returning * into v_doc;

  insert into public.document_access_log (tenant_id, document_id, actor_id, action)
  values (v_doc.tenant_id, v_doc.id, (select auth.uid()), 'upload');
  perform private.write_audit(v_doc.tenant_id, 'document.uploaded', 'document', v_doc.id::text,
    jsonb_build_object('kind', v_doc.kind));
  return v_doc;
end;
$$;

-- Autoriza ver o descargar: revisa permiso, REGISTRA el acceso y devuelve la ruta
-- (la Edge Function firma el enlace con ella). Nadie más obtiene la ruta firmable.
create or replace function public.authorize_document_access(p_document uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.patient_documents;
begin
  perform private.require_uid();
  if p_action not in ('view', 'download') then
    raise exception 'Acción inválida' using errcode = '22023';
  end if;
  select * into v_doc from public.patient_documents where id = p_document;
  if v_doc.id is null or not private.can_see_patient_id(v_doc.patient_id) then
    raise exception 'Documento no encontrado' using errcode = 'P0002';
  end if;

  insert into public.document_access_log (tenant_id, document_id, actor_id, action)
  values (v_doc.tenant_id, v_doc.id, (select auth.uid()), p_action);
  return jsonb_build_object('storage_path', v_doc.storage_path, 'name', v_doc.name, 'mime', v_doc.mime);
end;
$$;

-- Archivar o reactivar (no se borra). Propietario, administración o recepción.
create or replace function public.set_document_archived(p_document uuid, p_archived boolean)
returns public.patient_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.patient_documents;
  v_p public.patients;
begin
  select * into v_doc from public.patient_documents where id = p_document;
  if v_doc.id is null then
    raise exception 'Documento no encontrado' using errcode = 'P0002';
  end if;
  v_p := private.require_patient_writer(v_doc.patient_id);
  if (private.my_membership(v_p.tenant_id)).role not in ('owner', 'admin', 'reception') then
    raise exception 'Solo la dueña, la administración o recepción archivan documentos' using errcode = '42501';
  end if;

  update public.patient_documents set archived_at = case when p_archived then coalesce(archived_at, now()) end
  where id = p_document returning * into v_doc;
  insert into public.document_access_log (tenant_id, document_id, actor_id, action)
  values (v_doc.tenant_id, v_doc.id, (select auth.uid()), case when p_archived then 'archive' else 'unarchive' end);
  perform private.write_audit(v_doc.tenant_id, case when p_archived then 'document.archived' else 'document.unarchived' end, 'document', v_doc.id::text);
  return v_doc;
end;
$$;

revoke all on function public.register_document(uuid, public.document_kind, text, text) from public, anon;
grant execute on function public.register_document(uuid, public.document_kind, text, text) to authenticated;
revoke all on function public.authorize_document_access(uuid, text) from public, anon;
grant execute on function public.authorize_document_access(uuid, text) to authenticated;
revoke all on function public.set_document_archived(uuid, boolean) from public, anon;
grant execute on function public.set_document_archived(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: la lista de documentos (sin contenido) la ven quienes ven al paciente;
-- la bitácora, la gerencia. Escritura solo por RPC.
-- -----------------------------------------------------------------------------
alter table public.patient_documents enable row level security;
alter table public.document_access_log enable row level security;
revoke all on public.patient_documents, public.document_access_log from anon, authenticated;
grant select on public.patient_documents, public.document_access_log to authenticated;

create policy patient_documents_select on public.patient_documents
  for select to authenticated
  using ((select private.can_see_patient_id(patient_id)));

create policy document_access_log_select on public.document_access_log
  for select to authenticated
  using ((select private.has_role(tenant_id, array['owner', 'admin']::public.tenant_role[])));
