-- =============================================================================
-- 0012 · Agenda: citas (E3 · M3-A)
--
-- Reglas (aprobadas por Diego el 2026-11-16):
--   * Cada sucursal tiene su zona horaria (por defecto Ciudad de México). El horario
--     de atención (0008) se interpreta en esa zona.
--   * NO se agenda fuera del horario de la sucursal ni en un día cerrado: la app
--     manda a escribirle a la clínica o al doctor para revisar ese caso.
--   * Nunca se traslapan citas del mismo sillón ni del mismo doctor (EXCLUDE con
--     tstzrange; las canceladas no ocupan lugar).
--   * Gerencia y recepción agendan para cualquier doctor; un doctor ve y agenda solo
--     sus citas, con sus pacientes. Se respetan las sucursales de cada membresía.
--   * Estados: programada → confirmada → llegó / no asistió; cancelada es final.
--     Reagendar = mover la cita (vuelve a «programada» para confirmarla de nuevo).
--   * Sin borrado. Auditoría sin datos del paciente. El superadmin no ve citas.
-- Rollback: supabase/rollback/20261116000700_appointments.down.sql
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Zona horaria por sucursal
-- -----------------------------------------------------------------------------
alter table public.branches
  add column timezone text not null default 'America/Mexico_City'
  check (timezone in (
    'America/Mexico_City', 'America/Monterrey', 'America/Merida', 'America/Cancun',
    'America/Matamoros', 'America/Chihuahua', 'America/Ciudad_Juarez', 'America/Ojinaga',
    'America/Mazatlan', 'America/Bahia_Banderas', 'America/Hermosillo', 'America/Tijuana'
  ));

create or replace function public.set_branch_timezone(p_branch uuid, p_timezone text)
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
  update public.branches set timezone = p_timezone where id = p_branch returning * into v_branch;
  perform private.write_audit(v_branch.tenant_id, 'branch.timezone_set', 'branch', v_branch.id::text,
    jsonb_build_object('timezone', p_timezone));
  return v_branch;
end;
$$;

-- Para la FK compuesta sillón ↔ sucursal de la cita.
alter table public.chairs add constraint chairs_tenant_branch_id_key unique (tenant_id, branch_id, id);

-- -----------------------------------------------------------------------------
-- Citas
-- -----------------------------------------------------------------------------
create type public.appointment_kind as enum ('valoracion', 'tratamiento', 'revision');
create type public.appointment_status as enum ('programada', 'confirmada', 'llego', 'no_asistio', 'cancelada');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  branch_id uuid not null,
  chair_id uuid not null,
  doctor_id uuid not null,
  patient_id uuid not null,
  treatment_id uuid,
  kind public.appointment_kind not null default 'tratamiento',
  status public.appointment_status not null default 'programada',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text check (char_length(notes) <= 1000),
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id),
  foreign key (tenant_id, branch_id, chair_id) references public.chairs (tenant_id, branch_id, id),
  foreign key (tenant_id, doctor_id) references public.memberships (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients (tenant_id, id) on delete cascade,
  foreign key (tenant_id, treatment_id) references public.treatments (tenant_id, id),
  check (ends_at > starts_at and ends_at - starts_at <= interval '8 hours'),
  check (starts_at = date_trunc('minute', starts_at) and ends_at = date_trunc('minute', ends_at)),
  constraint appointments_no_chair_overlap exclude using gist (
    tenant_id with =, chair_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelada'),
  constraint appointments_no_doctor_overlap exclude using gist (
    tenant_id with =, doctor_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelada')
);
create index appointments_branch_time_idx on public.appointments (tenant_id, branch_id, starts_at);
create index appointments_doctor_time_idx on public.appointments (tenant_id, doctor_id, starts_at);
create index appointments_patient_time_idx on public.appointments (tenant_id, patient_id, starts_at desc);

create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- ¿La membresía puede trabajar en la sucursal? (sin filas en membership_branches = todas)
create or replace function private.membership_in_branch(p_membership uuid, p_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.membership_branches mb where mb.membership_id = p_membership)
      or exists (select 1 from public.membership_branches mb where mb.membership_id = p_membership and mb.branch_id = p_branch);
$$;

-- ¿Quien llama ve esta cita? Gerencia y recepción: las de sus sucursales. Doctores: las suyas.
create or replace function private.can_see_appointment(p_tenant uuid, p_branch uuid, p_doctor uuid)
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
      and (
        (m.role in ('owner', 'admin', 'reception') and private.membership_in_branch(m.id, p_branch))
        or m.id = p_doctor
      )
  );
$$;

-- ¿La cita cabe en el horario de la sucursal (en su zona) y en un solo día?
create or replace function private.within_branch_hours(p_branch uuid, p_start timestamptz, p_end timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_b public.branches;
  v_ls timestamp;
  v_le timestamp;
  v_from text;
  v_to text;
  v_range jsonb;
begin
  select * into v_b from public.branches where id = p_branch;
  if v_b.id is null then return false; end if;
  v_ls := p_start at time zone v_b.timezone;
  v_le := p_end at time zone v_b.timezone;
  if v_ls::date <> v_le::date then return false; end if;
  v_from := to_char(v_ls, 'HH24:MI');
  v_to := to_char(v_le, 'HH24:MI');
  for v_range in
    select value from jsonb_array_elements(
      coalesce(v_b.opening_hours -> ((array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])[extract(isodow from v_ls)::int]), '[]'::jsonb))
  loop
    if v_from >= v_range ->> 0 and v_to <= v_range ->> 1 then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- Valida todo lo de una cita nueva o movida y devuelve la membresía de quien llama.
create or replace function private.check_appointment(
  p_tenant uuid, p_branch uuid, p_chair uuid, p_doctor uuid, p_patient uuid,
  p_treatment uuid, p_starts_at timestamptz, p_ends_at timestamptz
)
returns public.memberships
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me public.memberships := private.my_membership(p_tenant);
  v_p public.patients;
begin
  if v_me.id is null or not private.can_write(p_tenant, array['owner', 'admin', 'reception', 'doctor', 'doctor_collab']::public.tenant_role[]) then
    raise exception 'No tienes permiso para agendar en esta clínica' using errcode = '42501';
  end if;
  -- Un doctor solo agenda en su propia agenda.
  if v_me.role in ('doctor', 'doctor_collab') and p_doctor <> v_me.id then
    raise exception 'Solo puedes agendar citas en tu agenda' using errcode = '42501';
  end if;
  select * into v_p from public.patients where id = p_patient and tenant_id = p_tenant;
  if v_p.id is null or not private.can_see_patient(v_p.tenant_id, v_p.primary_doctor_id) then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;
  if v_p.archived_at is not null then
    raise exception 'El paciente está archivado' using errcode = '22023';
  end if;
  if not exists (select 1 from public.branches b where b.id = p_branch and b.tenant_id = p_tenant and b.is_active) then
    raise exception 'Sucursal no encontrada' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.chairs c where c.id = p_chair and c.branch_id = p_branch and c.is_active) then
    raise exception 'Ese sillón no está disponible en la sucursal' using errcode = '22023';
  end if;
  if not private.valid_doctor(p_tenant, p_doctor) or p_doctor is null then
    raise exception 'Elige un doctor activo de la clínica' using errcode = '22023';
  end if;
  if not private.membership_in_branch(v_me.id, p_branch) or not private.membership_in_branch(p_doctor, p_branch) then
    raise exception 'Esa sucursal no está asignada a ti o al doctor' using errcode = '42501';
  end if;
  if p_treatment is not null and not exists (select 1 from public.treatments t where t.id = p_treatment and t.tenant_id = p_tenant and t.is_active) then
    raise exception 'Tratamiento no encontrado' using errcode = 'P0002';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Revisa la hora de la cita' using errcode = '22023';
  end if;
  if p_starts_at < now() - interval '1 day' then
    raise exception 'No se agendan citas en el pasado' using errcode = '22023';
  end if;
  if not private.within_branch_hours(p_branch, p_starts_at, p_ends_at) then
    raise exception 'Fuera del horario de la sucursal' using errcode = 'DH001',
      hint = 'Escribe a la clínica o al doctor para revisar este caso.';
  end if;
  return v_me;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

create or replace function public.create_appointment(
  p_patient uuid,
  p_doctor uuid,
  p_branch uuid,
  p_chair uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_kind public.appointment_kind default 'tratamiento',
  p_treatment uuid default null,
  p_notes text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_a public.appointments;
begin
  perform private.require_uid();
  select tenant_id into v_tenant from public.branches where id = p_branch;
  if v_tenant is null then
    raise exception 'Sucursal no encontrada' using errcode = 'P0002';
  end if;
  perform private.check_appointment(v_tenant, p_branch, p_chair, p_doctor, p_patient, p_treatment, p_starts_at, p_ends_at);

  insert into public.appointments (tenant_id, branch_id, chair_id, doctor_id, patient_id, treatment_id, kind, starts_at, ends_at, notes, created_by)
  values (v_tenant, p_branch, p_chair, p_doctor, p_patient, p_treatment, coalesce(p_kind, 'tratamiento'),
    p_starts_at, p_ends_at, nullif(btrim(p_notes), ''), (select auth.uid()))
  returning * into v_a;

  perform private.write_audit(v_tenant, 'appointment.created', 'appointment', v_a.id::text,
    jsonb_build_object('kind', v_a.kind));
  return v_a;
end;
$$;

-- Mover o editar (reagendar). Solo citas programadas o confirmadas. Si cambia la hora,
-- el doctor o el sillón, vuelve a «programada» para confirmarla de nuevo.
create or replace function public.update_appointment(
  p_appointment uuid,
  p_doctor uuid,
  p_branch uuid,
  p_chair uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_kind public.appointment_kind,
  p_treatment uuid default null,
  p_notes text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
  v_moved boolean;
begin
  perform private.require_uid();
  select * into v_a from public.appointments where id = p_appointment;
  if v_a.id is null or not private.can_see_appointment(v_a.tenant_id, v_a.branch_id, v_a.doctor_id) then
    raise exception 'Cita no encontrada' using errcode = 'P0002';
  end if;
  if v_a.status not in ('programada', 'confirmada') then
    raise exception 'Solo se mueven citas programadas o confirmadas' using errcode = '22023';
  end if;
  perform private.check_appointment(v_a.tenant_id, p_branch, p_chair, p_doctor, v_a.patient_id, p_treatment, p_starts_at, p_ends_at);
  v_moved := (p_starts_at, p_ends_at, p_doctor, p_chair, p_branch) is distinct from (v_a.starts_at, v_a.ends_at, v_a.doctor_id, v_a.chair_id, v_a.branch_id);

  update public.appointments set
    doctor_id = p_doctor, branch_id = p_branch, chair_id = p_chair,
    starts_at = p_starts_at, ends_at = p_ends_at,
    kind = coalesce(p_kind, kind), treatment_id = p_treatment,
    notes = nullif(btrim(p_notes), ''),
    status = case when v_moved then 'programada' else status end
  where id = p_appointment
  returning * into v_a;

  perform private.write_audit(v_a.tenant_id, case when v_moved then 'appointment.rescheduled' else 'appointment.updated' end,
    'appointment', v_a.id::text);
  return v_a;
end;
$$;

-- Cambia el estado. Cancelada es final. «No asistió» y «Llegó» solo desde 2 h antes.
create or replace function public.set_appointment_status(
  p_appointment uuid,
  p_status public.appointment_status,
  p_reason text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
begin
  perform private.require_uid();
  select * into v_a from public.appointments where id = p_appointment;
  if v_a.id is null or not private.can_see_appointment(v_a.tenant_id, v_a.branch_id, v_a.doctor_id) then
    raise exception 'Cita no encontrada' using errcode = 'P0002';
  end if;
  if not private.can_write(v_a.tenant_id, array['owner', 'admin', 'reception', 'doctor', 'doctor_collab']::public.tenant_role[]) then
    raise exception 'Tu clínica está en solo lectura' using errcode = '42501';
  end if;
  if v_a.status = 'cancelada' then
    raise exception 'La cita está cancelada' using errcode = '22023';
  end if;
  if p_status = v_a.status then
    return v_a;
  end if;
  if p_status in ('llego', 'no_asistio') and v_a.starts_at > now() + interval '2 hours' then
    raise exception 'Todavía no es la hora de la cita' using errcode = '22023';
  end if;
  if p_status in ('programada', 'confirmada') and v_a.ends_at < now() - interval '1 day' then
    raise exception 'La cita ya pasó' using errcode = '22023';
  end if;

  update public.appointments set
    status = p_status,
    cancel_reason = case when p_status = 'cancelada' then nullif(btrim(p_reason), '') end
  where id = p_appointment
  returning * into v_a;

  perform private.write_audit(v_a.tenant_id, 'appointment.status', 'appointment', v_a.id::text,
    jsonb_build_object('status', p_status));
  return v_a;
end;
$$;

-- Citas visibles de una sucursal o de un paciente, con nombres para pintar la agenda.
create or replace function public.list_appointments(
  p_from timestamptz,
  p_to timestamptz,
  p_branch uuid default null,
  p_patient uuid default null
)
returns table (
  id uuid, tenant_id uuid, branch_id uuid, chair_id uuid, doctor_id uuid, patient_id uuid, treatment_id uuid,
  kind public.appointment_kind, status public.appointment_status, starts_at timestamptz, ends_at timestamptz,
  notes text, cancel_reason text,
  patient_name text, patient_phone text, doctor_name text, chair_name text, branch_name text, treatment_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_uid();
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'Rango de fechas inválido' using errcode = '22023';
  end if;
  if p_branch is null and p_patient is null then
    raise exception 'Indica la sucursal o el paciente' using errcode = '22023';
  end if;
  return query
    select a.id, a.tenant_id, a.branch_id, a.chair_id, a.doctor_id, a.patient_id, a.treatment_id,
      a.kind, a.status, a.starts_at, a.ends_at, a.notes, a.cancel_reason,
      p.full_name, p.phone_e164, coalesce(pr.full_name, ''), c.name, b.name, t.name
    from public.appointments a
    join public.patients p on p.tenant_id = a.tenant_id and p.id = a.patient_id
    join public.chairs c on c.id = a.chair_id
    join public.branches b on b.id = a.branch_id
    join public.memberships m on m.id = a.doctor_id
    left join public.profiles pr on pr.id = m.user_id
    left join public.treatments t on t.id = a.treatment_id
    where a.starts_at < p_to and a.ends_at > p_from
      and (p_branch is null or a.branch_id = p_branch)
      and (p_patient is null or a.patient_id = p_patient)
      and private.can_see_appointment(a.tenant_id, a.branch_id, a.doctor_id)
    order by a.starts_at
    limit 500;
end;
$$;

revoke all on function private.membership_in_branch(uuid, uuid) from public, anon;
grant execute on function private.membership_in_branch(uuid, uuid) to authenticated;
revoke all on function private.can_see_appointment(uuid, uuid, uuid) from public, anon;
grant execute on function private.can_see_appointment(uuid, uuid, uuid) to authenticated;
revoke all on function private.within_branch_hours(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function private.check_appointment(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;

revoke all on function public.set_branch_timezone(uuid, text) from public, anon;
grant execute on function public.set_branch_timezone(uuid, text) to authenticated;
revoke all on function public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, public.appointment_kind, uuid, text) from public, anon;
grant execute on function public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, public.appointment_kind, uuid, text) to authenticated;
revoke all on function public.update_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, public.appointment_kind, uuid, text) from public, anon;
grant execute on function public.update_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, public.appointment_kind, uuid, text) to authenticated;
revoke all on function public.set_appointment_status(uuid, public.appointment_status, text) from public, anon;
grant execute on function public.set_appointment_status(uuid, public.appointment_status, text) to authenticated;
revoke all on function public.list_appointments(timestamptz, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.list_appointments(timestamptz, timestamptz, uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: lectura según quién ve la cita; escritura solo por RPC.
-- -----------------------------------------------------------------------------
alter table public.appointments enable row level security;
revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;

create policy appointments_select on public.appointments
  for select to authenticated
  using ((select private.can_see_appointment(tenant_id, branch_id, doctor_id)));
