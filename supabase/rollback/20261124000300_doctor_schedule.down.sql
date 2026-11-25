-- =============================================================================
-- ROLLBACK de 20261124000300_doctor_schedule.sql
-- SOLO en desarrollo con datos ficticios y con aprobación explícita de Diego. NUNCA en
-- producción. Se niega si hay pasantes (sus permisos desaparecerían). Se pierde el
-- horario de los doctores.
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.memberships where role::text = 'doctor_intern') then
    raise exception 'Hay pasantes: cámbialos de rol antes de revertir';
  end if;
end $$;

drop function if exists public.set_doctor_schedule(uuid, jsonb);
drop function if exists private.within_doctor_hours(uuid, uuid, timestamptz, timestamptz);
alter table public.doctor_settings drop column if exists schedule;
drop function if exists private.valid_doctor_schedule(jsonb);

alter table public.memberships drop constraint memberships_offline_doctor;
alter table public.memberships
  add constraint memberships_offline_doctor check (user_id is not null or role in ('doctor', 'doctor_collab'));

drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes
  for select to authenticated
  using ((select private.can_see_patient_id(patient_id)));
drop policy if exists quote_items_select on public.quote_items;
create policy quote_items_select on public.quote_items
  for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and (select private.can_see_patient_id(q.patient_id))));
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using ((select private.can_see_patient_id(patient_id)));

-- Versiones anteriores de las funciones.
create or replace function private.assignable_role(p_role public.tenant_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_role in ('admin', 'reception', 'doctor', 'doctor_collab');
$$;

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

create or replace function public.create_doctor(
  p_tenant uuid,
  p_name text,
  p_role public.tenant_role default 'doctor',
  p_specialty text default '',
  p_color text default null,
  p_phone text default null
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_m public.memberships;
begin
  perform private.require_manager(p_tenant);
  if p_role is null or p_role not in ('doctor', 'doctor_collab') then
    raise exception 'Un doctor sin acceso solo puede ser doctor o colaborador' using errcode = '22023';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Escribe el nombre del doctor' using errcode = '22023';
  end if;
  perform private.check_doctor_fields(p_specialty, p_color, p_phone);

  insert into public.memberships (tenant_id, user_id, role, status, display_name)
  values (p_tenant, null, p_role, 'active', v_name)
  returning * into v_m;
  insert into public.doctor_settings (membership_id, tenant_id, specialty, calendar_color, phone_e164)
  values (v_m.id, p_tenant, btrim(coalesce(p_specialty, '')), p_color, p_phone);

  perform private.write_audit(p_tenant, 'membership.doctor_created', 'membership', v_m.id::text,
    jsonb_build_object('role', p_role));
  return v_m;
end;
$$;

create or replace function public.create_invitation(
  p_tenant uuid,
  p_email text,
  p_role public.tenant_role,
  p_branch_ids uuid[] default '{}',
  p_membership uuid default null
)
returns public.invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_inv public.invitations;
begin
  perform private.require_manager(p_tenant);

  if not private.assignable_role(p_role) then
    raise exception 'Ese rol no se puede invitar' using errcode = '22023';
  end if;
  if not private.branches_belong(p_tenant, p_branch_ids) then
    raise exception 'Alguna sucursal no pertenece a tu clínica' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.tenant_id = p_tenant and m.status = 'active' and lower(u.email) = v_email
  ) then
    raise exception 'Esa persona ya es parte de tu equipo' using errcode = '23505';
  end if;
  -- Invitar a un doctor sin acceso: debe ser de la clínica, activo y sin cuenta.
  if p_membership is not null then
    if not exists (
      select 1 from public.memberships m
      where m.id = p_membership and m.tenant_id = p_tenant and m.status = 'active' and m.user_id is null
    ) then
      raise exception 'Doctor no encontrado' using errcode = 'P0002';
    end if;
    if p_role not in ('doctor', 'doctor_collab') then
      raise exception 'Un doctor sin acceso solo puede ser doctor o colaborador' using errcode = '22023';
    end if;
    -- Una sola invitación pendiente por doctor: la anterior (otro correo) se revoca.
    update public.invitations set status = 'revoked'
    where tenant_id = p_tenant and membership_id = p_membership and status = 'pending' and email <> v_email;
  end if;

  -- Si ya había una pendiente, se renueva (rol, sucursales y vigencia).
  update public.invitations set
    role = p_role,
    branch_ids = coalesce(p_branch_ids, '{}'),
    -- «Reenviar» sin doctor no rompe el vínculo que ya tenía.
    membership_id = coalesce(p_membership, membership_id),
    invited_by = (select auth.uid()),
    expires_at = now() + interval '7 days'
  where tenant_id = p_tenant and email = v_email and status = 'pending'
  returning * into v_inv;

  if v_inv.id is null then
    insert into public.invitations (tenant_id, email, role, branch_ids, invited_by, membership_id)
    values (p_tenant, v_email, p_role, coalesce(p_branch_ids, '{}'), (select auth.uid()), p_membership)
    returning * into v_inv;
  end if;

  -- Sin el correo en la auditoría (dato personal): solo id y rol.
  perform private.write_audit(p_tenant, 'invitation.created', 'invitation', v_inv.id::text,
    jsonb_build_object('role', p_role, 'branches', cardinality(v_inv.branch_ids), 'linked', p_membership is not null));
  return v_inv;
end;
$$;

create or replace function public.update_member_role(p_membership uuid, p_role public.tenant_role)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
begin
  select * into v_m from public.memberships where id = p_membership;
  if v_m.id is null then
    raise exception 'Membresía no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_m.tenant_id);
  if v_m.role = 'owner' then
    raise exception 'No se puede cambiar el rol de la propietaria o el propietario' using errcode = '42501';
  end if;
  if not private.assignable_role(p_role) then
    raise exception 'Ese rol no se puede asignar' using errcode = '22023';
  end if;
  if v_m.user_id is null and p_role not in ('doctor', 'doctor_collab') then
    raise exception 'Un doctor sin acceso solo puede ser doctor o colaborador' using errcode = '22023';
  end if;

  update public.memberships set role = p_role where id = p_membership returning * into v_m;
  perform private.write_audit(v_m.tenant_id, 'membership.role_changed', 'membership', v_m.id::text,
    jsonb_build_object('role', p_role));
  return v_m;
end;
$$;

create or replace function public.quote_stats(p_tenant uuid, p_since timestamptz, p_doctor uuid default null)
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
  if not private.is_member(p_tenant) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  with mine as (
    select q.* from public.quotes q
    join public.patients p on p.tenant_id = q.tenant_id and p.id = q.patient_id
    where q.tenant_id = p_tenant
      and private.can_see_patient(p.tenant_id, p.primary_doctor_id)
      and (p_doctor is null or q.doctor_id = p_doctor)
  )
  select jsonb_build_object(
    'won', count(*) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado')),
    'decided', count(*) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado', 'perdido')),
    'in_doubt_total', coalesce(sum(total) filter (where status = 'en_duda'), 0),
    'avg_ticket', round(coalesce(avg(total) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado')), 0)),
    'collected', (select coalesce(sum(pay.amount), 0) from public.payments pay
                  where pay.voided_at is null and pay.paid_at >= p_since and pay.quote_id in (select id from mine))
  ) into v_out
  from mine;
  return v_out;
end;
$$;

create or replace function public.patient_account(p_patient uuid)
returns jsonb
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
  return (
    with q as (
      select q.id, q.folio, q.title, q.status, q.total, q.down_payment, q.installments, private.quote_paid(q.id) as paid
      from public.quotes q
      where q.tenant_id = v_p.tenant_id and q.patient_id = v_p.id and q.status in ('presentado', 'en_duda', 'aceptado', 'en_tratamiento', 'terminado')
    )
    select jsonb_build_object(
      'quotes', coalesce((select jsonb_agg(jsonb_build_object(
          'id', id, 'folio', folio, 'title', title, 'status', status, 'total', total, 'down_payment', down_payment,
          'installments', installments, 'paid', paid, 'balance', total - paid) order by folio desc) from q), '[]'::jsonb),
      'paid_total', (select coalesce(sum(amount), 0) from public.payments where tenant_id = v_p.tenant_id and patient_id = v_p.id and voided_at is null),
      'balance', (select coalesce(sum(total - paid), 0) from q where status in ('aceptado', 'en_tratamiento', 'terminado')),
      'last_payment_at', (select max(paid_at) from public.payments where tenant_id = v_p.tenant_id and patient_id = v_p.id and voided_at is null)
    )
  );
end;
$$;

drop function if exists private.sees_money(uuid);

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261124000300';
  end if;
end $$;

commit;
