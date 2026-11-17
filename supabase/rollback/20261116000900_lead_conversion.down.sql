-- =============================================================================
-- ROLLBACK de 20261116000900_lead_conversion.sql
-- DESTRUCTIVO: borra las citas de leads (no las convertidas). SOLO en desarrollo con
-- datos ficticios y con aprobación explícita de Diego. NUNCA en producción.
-- Las conversiones ya hechas se quedan (el paciente y sus citas existen).
-- =============================================================================
begin;

drop function if exists public.lead_patient_matches(uuid);
drop function if exists public.convert_lead(uuid, public.consent_method, date, uuid, uuid);
drop function if exists public.create_lead_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid, text);
drop function if exists public.list_appointments(timestamptz, timestamptz, uuid, uuid, uuid);

delete from public.appointments where lead_id is not null;
drop index if exists public.appointments_lead_idx;
alter table public.appointments drop constraint if exists appointments_lead_is_valoracion;
alter table public.appointments drop constraint if exists appointments_one_person;
alter table public.appointments drop constraint if exists appointments_lead_fk;
alter table public.appointments drop column if exists lead_id;
alter table public.appointments alter column patient_id set not null;

delete from public.lead_activity where kind in ('appointment', 'converted');
alter table public.lead_activity drop constraint if exists lead_activity_kind_check;
alter table public.lead_activity add constraint lead_activity_kind_check
  check (kind in ('created', 'status', 'note', 'assigned', 'updated'));

-- Versiones de 0012.
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

revoke all on function public.list_appointments(timestamptz, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.list_appointments(timestamptz, timestamptz, uuid, uuid) to authenticated;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116000900';
  end if;
end $$;

commit;
