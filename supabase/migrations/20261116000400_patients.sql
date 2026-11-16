-- =============================================================================
-- 0009 · Pacientes (E3 · M2-A) — DATOS DE SALUD (LFPDPPP 2025: sensibles)
--
-- Reglas (aprobadas por Diego el 2026-11-16):
--   * Propietario, administración y recepción ven a todos los pacientes de su clínica.
--   * Doctor y doctor colaborador ven SOLO a los pacientes de los que son doctor tratante.
--   * El superadmin de plataforma NO ve pacientes (no entra en ninguna política).
--   * No se da de alta un paciente sin consentimiento expreso (con la versión del
--     aviso de privacidad de la clínica).
--   * La ficha se abre con open_patient(), que registra el acceso en la bitácora.
--   * No se borran: se archivan (retención mínima de 5 años, NOM-004).
--   * La auditoría y la bitácora no guardan datos del paciente en claro (solo ids).
-- Rollback: supabase/rollback/20261116000400_patients.down.sql
-- =============================================================================

create type public.patient_source as enum ('meta', 'perfil', 'referido', 'whatsapp', 'manual', 'otro');
create type public.consent_method as enum ('papel', 'digital');

-- Versión del aviso de privacidad PARA PACIENTES que usa cada clínica (responsable).
-- Borrador hasta la revisión legal (P5).
alter table public.tenants
  add column patient_notice_version text not null default 'clinica-borrador-2026-11'
  check (patient_notice_version ~ '^[a-z0-9][a-z0-9.-]{2,40}$');

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  birth_date date check (birth_date > date '1900-01-01' and birth_date <= current_date),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  source public.patient_source not null default 'manual',
  -- Membresía del doctor tratante (de esta misma clínica: FK compuesta).
  primary_doctor_id uuid,
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, primary_doctor_id) references public.memberships (tenant_id, id)
);
create index patients_tenant_name_idx on public.patients (tenant_id, lower(full_name));
create index patients_tenant_phone_idx on public.patients (tenant_id, phone_e164);
create index patients_tenant_doctor_idx on public.patients (tenant_id, primary_doctor_id);
create index patients_tenant_created_idx on public.patients (tenant_id, created_at desc);

create table public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  patient_id uuid not null,
  method public.consent_method not null,
  notice_version text not null,
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients (tenant_id, id) on delete cascade
);
create index patient_consents_patient_idx on public.patient_consents (tenant_id, patient_id, recorded_at desc);

create table public.patient_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  patient_id uuid not null,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients (tenant_id, id) on delete cascade
);
create index patient_notes_patient_idx on public.patient_notes (tenant_id, patient_id, created_at desc);

-- Bitácora de accesos a datos de salud (quién, qué paciente, qué acción, cuándo).
create table public.patient_access_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  patient_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('create', 'view', 'update', 'archive', 'unarchive', 'note')),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, patient_id) references public.patients (tenant_id, id) on delete cascade
);
create index patient_access_log_tenant_idx on public.patient_access_log (tenant_id, created_at desc);
create index patient_access_log_patient_idx on public.patient_access_log (tenant_id, patient_id, created_at desc);

create trigger patients_set_updated_at before update on public.patients
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Autorización
-- -----------------------------------------------------------------------------

-- ¿Quien llama puede ver a un paciente de esta clínica con este doctor tratante?
create or replace function private.can_see_patient(p_tenant uuid, p_doctor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and t.status <> 'cancelled'
      and (m.role in ('owner', 'admin', 'reception') or m.id = p_doctor)
  );
$$;

-- Misma regla por id de paciente (para notas y consentimientos).
create or replace function private.can_see_patient_id(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patients p
    where p.id = p_patient and private.can_see_patient(p.tenant_id, p.primary_doctor_id)
  );
$$;

-- Membresía activa de quien llama en la clínica (o NULL).
create or replace function private.my_membership(p_tenant uuid)
returns public.memberships
language sql
stable
security definer
set search_path = ''
as $$
  select m.* from public.memberships m
  where m.tenant_id = p_tenant and m.user_id = (select auth.uid()) and m.status = 'active';
$$;

-- Exige ver al paciente Y poder escribir en su clínica (activa). Devuelve el paciente.
create or replace function private.require_patient_writer(p_patient uuid)
returns public.patients
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_p public.patients;
begin
  perform private.require_uid();
  select * into v_p from public.patients where id = p_patient;
  if v_p.id is null or not private.can_see_patient(v_p.tenant_id, v_p.primary_doctor_id) then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;
  if not private.can_write(v_p.tenant_id, array['owner', 'admin', 'reception', 'doctor', 'doctor_collab']::public.tenant_role[]) then
    raise exception 'Tu clínica está en solo lectura' using errcode = '42501';
  end if;
  return v_p;
end;
$$;

-- El doctor tratante debe ser una membresía ACTIVA de la clínica que atiende pacientes.
create or replace function private.valid_doctor(p_tenant uuid, p_membership uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_membership is null or exists (
    select 1 from public.memberships m
    where m.id = p_membership and m.tenant_id = p_tenant and m.status = 'active'
      and m.role in ('owner', 'admin', 'doctor', 'doctor_collab')
  );
$$;

create or replace function private.log_patient_access(p_tenant uuid, p_patient uuid, p_action text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.patient_access_log (tenant_id, patient_id, actor_id, action)
  values (p_tenant, p_patient, (select auth.uid()), p_action);
$$;

create or replace function private.clean_tags(p_tags text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct left(btrim(t), 30)) filter (where btrim(t) <> ''), '{}')
  from unnest(coalesce(p_tags, '{}')) as t;
$$;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Alta con consentimiento expreso (obligatorio). Un doctor o colaborador que da de
-- alta queda como doctor tratante (si no, no podría ver a su propio paciente).
create or replace function public.create_patient(
  p_tenant uuid,
  p_full_name text,
  p_consent_method public.consent_method,
  p_birth_date date default null,
  p_phone_e164 text default null,
  p_email text default null,
  p_source public.patient_source default 'manual',
  p_primary_doctor uuid default null,
  p_tags text[] default '{}'
)
returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public.memberships;
  v_doctor uuid := p_primary_doctor;
  v_patient public.patients;
begin
  perform private.require_uid();
  if not private.can_write(p_tenant, array['owner', 'admin', 'reception', 'doctor', 'doctor_collab']::public.tenant_role[]) then
    raise exception 'No tienes permiso para registrar pacientes' using errcode = '42501';
  end if;
  if p_consent_method is null then
    raise exception 'Registra el consentimiento del paciente' using errcode = '22023';
  end if;

  v_me := private.my_membership(p_tenant);
  if v_me.role in ('doctor', 'doctor_collab') then
    v_doctor := v_me.id;
  end if;
  if not private.valid_doctor(p_tenant, v_doctor) then
    raise exception 'El doctor tratante no es parte del equipo' using errcode = '22023';
  end if;

  insert into public.patients (tenant_id, full_name, birth_date, phone_e164, email, source, primary_doctor_id, tags, created_by)
  values (
    p_tenant,
    btrim(p_full_name),
    p_birth_date,
    nullif(btrim(coalesce(p_phone_e164, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    coalesce(p_source, 'manual'),
    v_doctor,
    private.clean_tags(p_tags),
    (select auth.uid())
  )
  returning * into v_patient;

  insert into public.patient_consents (tenant_id, patient_id, method, notice_version, recorded_by)
  select p_tenant, v_patient.id, p_consent_method, t.patient_notice_version, (select auth.uid())
  from public.tenants t where t.id = p_tenant;

  perform private.log_patient_access(p_tenant, v_patient.id, 'create');
  perform private.write_audit(p_tenant, 'patient.created', 'patient', v_patient.id::text,
    jsonb_build_object('source', v_patient.source));
  return v_patient;
end;
$$;

-- Edición. NULL = no cambiar; '' borra teléfono, correo o fecha de nacimiento.
-- Solo propietario, administración o recepción cambian el doctor tratante.
create or replace function public.update_patient(
  p_patient uuid,
  p_full_name text default null,
  p_birth_date text default null,
  p_phone_e164 text default null,
  p_email text default null,
  p_source public.patient_source default null,
  p_primary_doctor text default null,
  p_tags text[] default null
)
returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.patients := private.require_patient_writer(p_patient);
  v_me public.memberships := private.my_membership(v_old.tenant_id);
  v_doctor uuid := v_old.primary_doctor_id;
  v_new public.patients;
  v_changed text[] := '{}';
begin
  if p_primary_doctor is not null then
    if v_me.role not in ('owner', 'admin', 'reception') then
      raise exception 'Solo la dueña, la administración o recepción cambian el doctor tratante' using errcode = '42501';
    end if;
    v_doctor := nullif(p_primary_doctor, '')::uuid;
    if not private.valid_doctor(v_old.tenant_id, v_doctor) then
      raise exception 'El doctor tratante no es parte del equipo' using errcode = '22023';
    end if;
  end if;

  update public.patients set
    full_name = coalesce(btrim(p_full_name), full_name),
    birth_date = case when p_birth_date is null then birth_date else nullif(p_birth_date, '')::date end,
    phone_e164 = case when p_phone_e164 is null then phone_e164 else nullif(btrim(p_phone_e164), '') end,
    email = case when p_email is null then email else nullif(lower(btrim(p_email)), '') end,
    source = coalesce(p_source, source),
    primary_doctor_id = v_doctor,
    tags = case when p_tags is null then tags else private.clean_tags(p_tags) end
  where id = p_patient
  returning * into v_new;

  if v_new.full_name is distinct from v_old.full_name then v_changed := array_append(v_changed, 'full_name'); end if;
  if v_new.birth_date is distinct from v_old.birth_date then v_changed := array_append(v_changed, 'birth_date'); end if;
  if v_new.phone_e164 is distinct from v_old.phone_e164 then v_changed := array_append(v_changed, 'phone_e164'); end if;
  if v_new.email is distinct from v_old.email then v_changed := array_append(v_changed, 'email'); end if;
  if v_new.source is distinct from v_old.source then v_changed := array_append(v_changed, 'source'); end if;
  if v_new.primary_doctor_id is distinct from v_old.primary_doctor_id then v_changed := array_append(v_changed, 'primary_doctor_id'); end if;
  if v_new.tags is distinct from v_old.tags then v_changed := array_append(v_changed, 'tags'); end if;

  if cardinality(v_changed) > 0 then
    perform private.log_patient_access(v_new.tenant_id, v_new.id, 'update');
    perform private.write_audit(v_new.tenant_id, 'patient.updated', 'patient', v_new.id::text,
      jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;
  return v_new;
end;
$$;

-- Archivar o reactivar (no se borra). Propietario, administración o recepción.
create or replace function public.set_patient_archived(p_patient uuid, p_archived boolean)
returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.patients := private.require_patient_writer(p_patient);
begin
  if (private.my_membership(v_p.tenant_id)).role not in ('owner', 'admin', 'reception') then
    raise exception 'Solo la dueña, la administración o recepción archivan pacientes' using errcode = '42501';
  end if;
  update public.patients set archived_at = case when p_archived then coalesce(archived_at, now()) end
  where id = p_patient returning * into v_p;
  perform private.log_patient_access(v_p.tenant_id, v_p.id, case when p_archived then 'archive' else 'unarchive' end);
  perform private.write_audit(v_p.tenant_id, case when p_archived then 'patient.archived' else 'patient.unarchived' end, 'patient', v_p.id::text);
  return v_p;
end;
$$;

create or replace function public.add_patient_note(p_patient uuid, p_body text)
returns public.patient_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.patients := private.require_patient_writer(p_patient);
  v_note public.patient_notes;
begin
  insert into public.patient_notes (tenant_id, patient_id, author_id, body)
  values (v_p.tenant_id, v_p.id, (select auth.uid()), btrim(p_body))
  returning * into v_note;
  perform private.log_patient_access(v_p.tenant_id, v_p.id, 'note');
  return v_note;
end;
$$;

-- Abre la ficha: devuelve paciente, consentimiento vigente y notas, y REGISTRA el acceso.
create or replace function public.open_patient(p_patient uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.patients;
begin
  perform private.require_uid();
  select * into v_p from public.patients where id = p_patient;
  if v_p.id is null or not private.can_see_patient(v_p.tenant_id, v_p.primary_doctor_id) then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;

  perform private.log_patient_access(v_p.tenant_id, v_p.id, 'view');

  return jsonb_build_object(
    'patient', to_jsonb(v_p),
    'consent', (
      select to_jsonb(c) from public.patient_consents c
      where c.tenant_id = v_p.tenant_id and c.patient_id = v_p.id
      order by c.recorded_at desc limit 1
    ),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'body', n.body, 'created_at', n.created_at, 'author_id', n.author_id,
        'author_name', coalesce(pr.full_name, '')
      ) order by n.created_at desc)
      from public.patient_notes n
      left join public.profiles pr on pr.id = n.author_id
      where n.tenant_id = v_p.tenant_id and n.patient_id = v_p.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function private.can_see_patient(uuid, uuid) from public, anon;
grant execute on function private.can_see_patient(uuid, uuid) to authenticated;
revoke all on function private.can_see_patient_id(uuid) from public, anon;
grant execute on function private.can_see_patient_id(uuid) to authenticated;
revoke all on function private.my_membership(uuid) from public, anon, authenticated;
revoke all on function private.require_patient_writer(uuid) from public, anon, authenticated;
revoke all on function private.valid_doctor(uuid, uuid) from public, anon, authenticated;
revoke all on function private.log_patient_access(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.clean_tags(text[]) from public, anon, authenticated;

revoke all on function public.create_patient(uuid, text, public.consent_method, date, text, text, public.patient_source, uuid, text[]) from public, anon;
grant execute on function public.create_patient(uuid, text, public.consent_method, date, text, text, public.patient_source, uuid, text[]) to authenticated;
revoke all on function public.update_patient(uuid, text, text, text, text, public.patient_source, text, text[]) from public, anon;
grant execute on function public.update_patient(uuid, text, text, text, text, public.patient_source, text, text[]) to authenticated;
revoke all on function public.set_patient_archived(uuid, boolean) from public, anon;
grant execute on function public.set_patient_archived(uuid, boolean) to authenticated;
revoke all on function public.add_patient_note(uuid, text) from public, anon;
grant execute on function public.add_patient_note(uuid, text) to authenticated;
revoke all on function public.open_patient(uuid) from public, anon;
grant execute on function public.open_patient(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: lectura de la lista (datos de contacto, sin notas) y bitácora para gerencia.
-- Notas y consentimientos solo se leen con open_patient() (que registra el acceso).
-- -----------------------------------------------------------------------------
alter table public.patients enable row level security;
alter table public.patient_consents enable row level security;
alter table public.patient_notes enable row level security;
alter table public.patient_access_log enable row level security;

revoke all on public.patients, public.patient_consents, public.patient_notes, public.patient_access_log from anon, authenticated;
grant select on public.patients, public.patient_access_log to authenticated;

create policy patients_select on public.patients
  for select to authenticated
  using ((select private.can_see_patient(tenant_id, primary_doctor_id)));

create policy patient_access_log_select on public.patient_access_log
  for select to authenticated
  using ((select private.has_role(tenant_id, array['owner', 'admin']::public.tenant_role[])));
