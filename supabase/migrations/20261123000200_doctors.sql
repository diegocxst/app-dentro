-- =============================================================================
-- 0018 · Equipo de doctores (E3 · M6-B1)
--
-- Reglas (aprobadas por Diego el 2026-11-23):
--   * Nombre dentro de la clínica: la gerencia le pone a cada miembro el nombre con el
--     que aparece en SU clínica (agenda, presupuestos, PDF, comisiones). No toca la
--     cuenta (profiles.full_name), que puede estar en otras clínicas. Si está vacío, se
--     usa el nombre de la cuenta.
--   * Perfil del doctor (doctor_settings): especialidad, color en la agenda (tokens del
--     sistema «dentro») y teléfono. Lo ven los miembros de la clínica; lo edita la gerencia.
--   * Doctor sin acceso: una membresía SIN cuenta (user_id nulo), solo doctor o
--     colaborador. Se le asignan pacientes, citas, presupuestos y comisiones, pero no
--     entra a la app (los helpers de RLS comparan con auth.uid(), que nunca es nulo).
--   * Si después tiene correo, se le invita desde su perfil (invitations.membership_id):
--     al aceptar, su cuenta se liga a ese mismo registro y conserva todo. Si ya tenía un
--     lugar en la clínica, se sigue el camino normal y queda en la auditoría.
--   * Nada se borra: un doctor sin acceso se archiva como cualquier miembro (revoke_member).
--   * Escrituras solo por RPC security definer; auditoría sin nombres ni teléfonos.
-- Rollback: supabase/rollback/20261123000200_doctors.down.sql
-- =============================================================================

-- --------------------------------------------------------------- memberships --
alter table public.memberships alter column user_id drop not null;
alter table public.memberships
  add column display_name text not null default '' check (char_length(display_name) <= 120);
-- Sin cuenta solo puede haber doctores (nunca la propietaria, administración ni recepción).
alter table public.memberships
  add constraint memberships_offline_doctor check (user_id is not null or role in ('doctor', 'doctor_collab'));

-- ------------------------------------------------------------ doctor_settings --
create table public.doctor_settings (
  membership_id uuid primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  specialty text not null default '' check (char_length(specialty) <= 80),
  calendar_color text check (calendar_color in ('violet', 'turquoise', 'orange', 'info', 'success', 'warning')),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, membership_id) references public.memberships (tenant_id, id) on delete cascade
);
create index doctor_settings_tenant_idx on public.doctor_settings (tenant_id);
create trigger doctor_settings_set_updated_at before update on public.doctor_settings
  for each row execute function private.set_updated_at();

alter table public.doctor_settings enable row level security;
revoke all on public.doctor_settings from public, anon, authenticated;
grant select on public.doctor_settings to authenticated;
create policy doctor_settings_select on public.doctor_settings
  for select to authenticated
  using ((select private.is_member(tenant_id)) or (select private.is_platform_admin()));

-- ---------------------------------------------------------------- invitations --
alter table public.invitations add column membership_id uuid;
alter table public.invitations
  add constraint invitations_membership_fk foreign key (tenant_id, membership_id) references public.memberships (tenant_id, id);
create index invitations_membership_idx on public.invitations (membership_id) where membership_id is not null;

-- ----------------------------------------------------------------- helpers ----
create or replace function private.check_doctor_fields(p_specialty text, p_color text, p_phone text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if char_length(coalesce(p_specialty, '')) > 80 then
    raise exception 'La especialidad es muy larga' using errcode = '22023';
  end if;
  if p_color is not null and p_color not in ('violet', 'turquoise', 'orange', 'info', 'success', 'warning') then
    raise exception 'Color no válido' using errcode = '22023';
  end if;
  if p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Revisa el teléfono' using errcode = '22023';
  end if;
end;
$$;

-- --------------------------------------------------------------------- RPC ----

-- Da de alta a un doctor sin acceso (sin correo). Solo la gerencia de una clínica activa.
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

-- Edita el perfil de un miembro en la clínica: nombre en la clínica, especialidad,
-- color y teléfono. Solo la gerencia. Nombre vacío = el de su cuenta (si tiene).
create or replace function public.update_doctor_profile(
  p_membership uuid,
  p_name text,
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
  select * into v_m from public.memberships where id = p_membership;
  if v_m.id is null or not private.is_member(v_m.tenant_id) then
    raise exception 'Miembro no encontrado' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_m.tenant_id);
  if v_m.status <> 'active' then
    raise exception 'Ese miembro ya no está en el equipo' using errcode = '22023';
  end if;
  if char_length(v_name) > 120 or (char_length(v_name) < 2 and (v_m.user_id is null or v_name <> '')) then
    raise exception 'Escribe el nombre del doctor' using errcode = '22023';
  end if;
  perform private.check_doctor_fields(p_specialty, p_color, p_phone);

  update public.memberships set display_name = v_name where id = p_membership returning * into v_m;
  insert into public.doctor_settings (membership_id, tenant_id, specialty, calendar_color, phone_e164)
  values (v_m.id, v_m.tenant_id, btrim(coalesce(p_specialty, '')), p_color, p_phone)
  on conflict (membership_id) do update
    set specialty = excluded.specialty, calendar_color = excluded.calendar_color, phone_e164 = excluded.phone_e164;

  perform private.write_audit(v_m.tenant_id, 'membership.profile_updated', 'membership', v_m.id::text,
    jsonb_build_object('access', v_m.user_id is not null));
  return v_m;
end;
$$;

-- Invitaciones: ahora pueden ligarse a un doctor sin acceso.
drop function public.create_invitation(uuid, text, public.tenant_role, uuid[]);
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
    membership_id = p_membership,
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

-- Al aceptar, la cuenta se liga al doctor sin acceso de la invitación.
create or replace function public.accept_my_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_email text;
  v_inv public.invitations;
  v_membership uuid;
  v_count integer := 0;
begin
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then
    return 0; -- Sin correo confirmado no se acepta nada.
  end if;

  for v_inv in
    select i.* from public.invitations i
    join public.tenants t on t.id = i.tenant_id
    where i.email = v_email and i.status = 'pending' and i.expires_at > now() and t.status = 'active'
    for update of i
  loop
    v_membership := null;
    -- Invitación de un doctor sin acceso: su cuenta se liga a ese mismo registro y
    -- conserva todo (pacientes, citas, presupuestos y comisiones). Si la persona ya
    -- tenía un lugar en la clínica, se sigue el camino normal y se deja constancia.
    if v_inv.membership_id is not null then
      if not exists (select 1 from public.memberships x where x.tenant_id = v_inv.tenant_id and x.user_id = v_uid) then
        update public.memberships set user_id = v_uid, role = v_inv.role
        where id = v_inv.membership_id and tenant_id = v_inv.tenant_id and user_id is null and status = 'active'
        returning id into v_membership;
      end if;
      if v_membership is null then
        perform private.write_audit(v_inv.tenant_id, 'invitation.link_skipped', 'invitation', v_inv.id::text);
      end if;
    end if;

    if v_membership is null then
      -- Nueva membresía o reactivación (si fue revocada antes). Nunca toca a la propietaria.
      insert into public.memberships (tenant_id, user_id, role, status)
      values (v_inv.tenant_id, v_uid, v_inv.role, 'active')
      on conflict (tenant_id, user_id) do update
        set role = excluded.role, status = 'active'
        where public.memberships.role <> 'owner'
      returning id into v_membership;
    end if;

    if v_membership is not null then
      delete from public.membership_branches where membership_id = v_membership;
      insert into public.membership_branches (tenant_id, membership_id, branch_id)
      select distinct v_inv.tenant_id, v_membership, b.id
      from unnest(v_inv.branch_ids) as b(id)
      join public.branches br on br.id = b.id and br.tenant_id = v_inv.tenant_id;
    end if;

    update public.invitations set status = 'accepted', accepted_by = v_uid, accepted_at = now()
    where id = v_inv.id;
    perform private.write_audit(v_inv.tenant_id, 'invitation.accepted', 'invitation', v_inv.id::text);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Un doctor sin acceso solo puede ser doctor o colaborador.
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

-- Nombres en la clínica: agenda, exportación ARCO y comisiones.
create or replace function public.list_appointments(
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
      coalesce(p.full_name, l.full_name), coalesce(p.phone_e164, l.phone_e164), coalesce(nullif(btrim(m.display_name), ''), pr.full_name, ''), c.name, b.name, t.name
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
        select coalesce(nullif(btrim(m.display_name), ''), pr.full_name) from public.memberships m
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

create or replace function public.commission_summary(p_tenant uuid, p_from date, p_to date)
returns table (
  doctor_id uuid, full_name text, role public.tenant_role,
  scheme_kind public.commission_kind, percent numeric, rent_amount numeric,
  patients integer, collected numeric, commission numeric, pending numeric, paid numeric,
  rent_due numeric, last_paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text := private.tenant_tz(p_tenant);
begin
  perform private.require_uid();
  if not private.is_member(p_tenant) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Revisa el periodo' using errcode = '22023';
  end if;
  return query
    with docs as (
      select m.id, m.role, coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(pr.full_name), ''), 'Sin nombre') as name
      from public.memberships m
      left join public.profiles pr on pr.id = m.user_id
      where m.tenant_id = p_tenant and m.status = 'active' and m.role in ('owner', 'admin', 'doctor', 'doctor_collab')
        and private.can_see_commissions(p_tenant, m.id)
    ),
    pay as (
      select x.doctor_id, count(distinct x.patient_id)::integer as patients, sum(x.amount) as collected
      from public.payments x
      where x.tenant_id = p_tenant and x.voided_at is null and x.doctor_id in (select id from docs)
        and (x.paid_at at time zone v_tz)::date between p_from and p_to
      group by x.doctor_id
    ),
    ent as (
      select e.doctor_id,
        sum(e.amount) as commission,
        coalesce(sum(e.amount) filter (where e.payout_id is null), 0) as pending,
        coalesce(sum(e.amount) filter (where e.payout_id is not null), 0) as paid
      from public.commission_entries e
      where e.tenant_id = p_tenant and e.voided_at is null and e.doctor_id in (select id from docs)
        and e.period_date between p_from and p_to
      group by e.doctor_id
    )
    select d.id, d.name, d.role, s.kind, s.percent, s.rent_amount,
      coalesce(pay.patients, 0), coalesce(pay.collected, 0), coalesce(ent.commission, 0), coalesce(ent.pending, 0), coalesce(ent.paid, 0),
      case when s.kind = 'chair_rent' and not exists (
        select 1 from public.commission_payouts po
        where po.tenant_id = p_tenant and po.doctor_id = d.id and po.period_from = p_from and po.rent > 0)
      then s.rent_amount else 0 end,
      (select max(po.paid_at) from public.commission_payouts po where po.tenant_id = p_tenant and po.doctor_id = d.id and po.period_from = p_from)
    from docs d
    left join public.commission_schemes s on s.tenant_id = p_tenant and s.membership_id = d.id and s.ended_at is null
    left join pay on pay.doctor_id = d.id
    left join ent on ent.doctor_id = d.id
    order by coalesce(pay.collected, 0) desc, d.name
    limit 200;
end;
$$;

revoke all on function private.check_doctor_fields(text, text, text) from public, anon, authenticated;
revoke all on function public.create_doctor(uuid, text, public.tenant_role, text, text, text) from public, anon;
grant execute on function public.create_doctor(uuid, text, public.tenant_role, text, text, text) to authenticated;
revoke all on function public.update_doctor_profile(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_doctor_profile(uuid, text, text, text, text) to authenticated;
revoke all on function public.create_invitation(uuid, text, public.tenant_role, uuid[], uuid) from public, anon;
grant execute on function public.create_invitation(uuid, text, public.tenant_role, uuid[], uuid) to authenticated;
