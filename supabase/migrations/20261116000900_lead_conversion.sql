-- =============================================================================
-- 0014 · Valoración del lead y conversión a paciente (E3 · M1-B)
--
-- Reglas (aprobadas por Diego el 2026-11-16):
--   * La valoración se agenda AL LEAD, sin crearlo como paciente: una cita es de un
--     paciente o de un lead (exactamente uno). Las citas de lead son de valoración.
--   * Solo gerencia y recepción agendan valoraciones de leads. El doctor de la cita
--     la ve en su agenda (nombre y teléfono del lead), aunque no vea el Kanban.
--   * Agendar la valoración pasa el lead a «Valoración agendada».
--   * Convertir: crea el paciente CON su consentimiento (como el alta normal) o lo
--     vincula con un paciente que ya existe; las citas del lead pasan al paciente y el
--     lead queda «Convertido» con el enlace a su ficha.
-- Rollback: supabase/rollback/20261116000900_lead_conversion.down.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Citas de lead
-- -----------------------------------------------------------------------------
alter table public.appointments alter column patient_id drop not null;
alter table public.appointments add column lead_id uuid;
alter table public.appointments
  add constraint appointments_lead_fk foreign key (tenant_id, lead_id) references public.leads (tenant_id, id),
  add constraint appointments_one_person check (num_nonnulls(patient_id, lead_id) = 1),
  add constraint appointments_lead_is_valoracion check (lead_id is null or kind = 'valoracion');
create index appointments_lead_idx on public.appointments (tenant_id, lead_id) where lead_id is not null;

alter table public.lead_activity drop constraint lead_activity_kind_check;
alter table public.lead_activity add constraint lead_activity_kind_check
  check (kind in ('created', 'status', 'note', 'assigned', 'updated', 'appointment', 'converted'));

-- check_appointment: el paciente es opcional (las citas de lead se validan aparte).
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
  if v_me.role in ('doctor', 'doctor_collab') and p_doctor <> v_me.id then
    raise exception 'Solo puedes agendar citas en tu agenda' using errcode = '42501';
  end if;
  if p_patient is not null then
    select * into v_p from public.patients where id = p_patient and tenant_id = p_tenant;
    if v_p.id is null or not private.can_see_patient(v_p.tenant_id, v_p.primary_doctor_id) then
      raise exception 'Paciente no encontrado' using errcode = 'P0002';
    end if;
    if v_p.archived_at is not null then
      raise exception 'El paciente está archivado' using errcode = '22023';
    end if;
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

-- Valoración de un lead. Gerencia y recepción. Pasa el lead a «Valoración agendada».
create or replace function public.create_lead_appointment(
  p_lead uuid,
  p_doctor uuid,
  p_branch uuid,
  p_chair uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_treatment uuid default null,
  p_notes text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.leads := private.require_lead_worker(p_lead);
  v_a public.appointments;
begin
  if v_l.status in ('convertido', 'perdido') then
    raise exception 'Este lead ya no está activo' using errcode = '22023';
  end if;
  perform private.check_appointment(v_l.tenant_id, p_branch, p_chair, p_doctor, null, p_treatment, p_starts_at, p_ends_at);

  insert into public.appointments (tenant_id, branch_id, chair_id, doctor_id, lead_id, treatment_id, kind, starts_at, ends_at, notes, created_by)
  values (v_l.tenant_id, p_branch, p_chair, p_doctor, v_l.id, p_treatment, 'valoracion', p_starts_at, p_ends_at,
    nullif(btrim(p_notes), ''), (select auth.uid()))
  returning * into v_a;

  update public.leads set
    status = 'valoracion',
    status_changed_at = case when status <> 'valoracion' then now() else status_changed_at end,
    first_response_at = coalesce(first_response_at, now())
  where id = v_l.id;
  perform private.log_lead(v_l.tenant_id, v_l.id, 'appointment', v_l.status, 'valoracion');
  perform private.write_audit(v_l.tenant_id, 'appointment.created', 'appointment', v_a.id::text, jsonb_build_object('kind', 'valoracion'));
  return v_a;
end;
$$;

-- Convertir en paciente. Sin p_patient: crea el paciente con su consentimiento
-- (mismas reglas que create_patient). Con p_patient: lo vincula con uno existente.
create or replace function public.convert_lead(
  p_lead uuid,
  p_consent_method public.consent_method default null,
  p_birth_date date default null,
  p_primary_doctor uuid default null,
  p_patient uuid default null
)
returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.leads := private.require_lead_worker(p_lead);
  v_p public.patients;
begin
  if v_l.status = 'convertido' then
    raise exception 'Este lead ya es paciente' using errcode = '22023';
  end if;

  if p_patient is not null then
    select * into v_p from public.patients where id = p_patient and tenant_id = v_l.tenant_id;
    if v_p.id is null or not private.can_see_patient(v_p.tenant_id, v_p.primary_doctor_id) then
      raise exception 'Paciente no encontrado' using errcode = 'P0002';
    end if;
  else
    v_p := public.create_patient(v_l.tenant_id, v_l.full_name, p_consent_method, p_birth_date,
      v_l.phone_e164, v_l.email, v_l.source, p_primary_doctor);
  end if;

  -- Sus citas pasan a la ficha del paciente.
  update public.appointments set patient_id = v_p.id, lead_id = null
  where tenant_id = v_l.tenant_id and lead_id = v_l.id;

  update public.leads set status = 'convertido', converted_patient_id = v_p.id, lost_reason = null,
    status_changed_at = now(), first_response_at = coalesce(first_response_at, now())
  where id = v_l.id;
  perform private.log_lead(v_l.tenant_id, v_l.id, 'converted', v_l.status, 'convertido');
  perform private.write_audit(v_l.tenant_id, 'lead.converted', 'lead', v_l.id::text,
    jsonb_build_object('linked_existing', p_patient is not null));
  return v_p;
end;
$$;

-- Pacientes con el mismo teléfono o correo (para no duplicar al convertir).
create or replace function public.lead_patient_matches(p_lead uuid)
returns table (id uuid, full_name text, phone_e164 text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_l public.leads;
begin
  perform private.require_uid();
  select * into v_l from public.leads where leads.id = p_lead;
  if v_l.id is null or not private.has_role(v_l.tenant_id, array['owner', 'admin', 'reception']::public.tenant_role[]) then
    raise exception 'Lead no encontrado' using errcode = 'P0002';
  end if;
  return query
    select p.id, p.full_name, p.phone_e164, p.email from public.patients p
    where p.tenant_id = v_l.tenant_id and p.archived_at is null
      and ((v_l.phone_e164 is not null and p.phone_e164 = v_l.phone_e164) or (v_l.email is not null and p.email = v_l.email))
    order by p.created_at
    limit 5;
end;
$$;

-- list_appointments con citas de lead (nombre y teléfono del lead) y filtro por lead.
drop function public.list_appointments(timestamptz, timestamptz, uuid, uuid);
create function public.list_appointments(
  p_from timestamptz,
  p_to timestamptz,
  p_branch uuid default null,
  p_patient uuid default null,
  p_lead uuid default null
)
returns table (
  id uuid, tenant_id uuid, branch_id uuid, chair_id uuid, doctor_id uuid, patient_id uuid, lead_id uuid, treatment_id uuid,
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
  if p_branch is null and p_patient is null and p_lead is null then
    raise exception 'Indica la sucursal, el paciente o el lead' using errcode = '22023';
  end if;
  return query
    select a.id, a.tenant_id, a.branch_id, a.chair_id, a.doctor_id, a.patient_id, a.lead_id, a.treatment_id,
      a.kind, a.status, a.starts_at, a.ends_at, a.notes, a.cancel_reason,
      coalesce(p.full_name, l.full_name), coalesce(p.phone_e164, l.phone_e164), coalesce(pr.full_name, ''), c.name, b.name, t.name
    from public.appointments a
    left join public.patients p on p.tenant_id = a.tenant_id and p.id = a.patient_id
    left join public.leads l on l.tenant_id = a.tenant_id and l.id = a.lead_id
    join public.chairs c on c.id = a.chair_id
    join public.branches b on b.id = a.branch_id
    join public.memberships m on m.id = a.doctor_id
    left join public.profiles pr on pr.id = m.user_id
    left join public.treatments t on t.id = a.treatment_id
    where a.starts_at < p_to and a.ends_at > p_from
      and (p_branch is null or a.branch_id = p_branch)
      and (p_patient is null or a.patient_id = p_patient)
      and (p_lead is null or a.lead_id = p_lead)
      and private.can_see_appointment(a.tenant_id, a.branch_id, a.doctor_id)
    order by a.starts_at
    limit 500;
end;
$$;

revoke all on function public.create_lead_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid, text) from public, anon;
grant execute on function public.create_lead_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid, text) to authenticated;
revoke all on function public.convert_lead(uuid, public.consent_method, date, uuid, uuid) from public, anon;
grant execute on function public.convert_lead(uuid, public.consent_method, date, uuid, uuid) to authenticated;
revoke all on function public.lead_patient_matches(uuid) from public, anon;
grant execute on function public.lead_patient_matches(uuid) to authenticated;
revoke all on function public.list_appointments(timestamptz, timestamptz, uuid, uuid, uuid) from public, anon;
grant execute on function public.list_appointments(timestamptz, timestamptz, uuid, uuid, uuid) to authenticated;
