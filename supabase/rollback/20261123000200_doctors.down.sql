-- =============================================================================
-- ROLLBACK de 20261123000200_doctors.sql
-- SOLO en desarrollo con datos ficticios y con aprobación explícita de Diego. NUNCA en
-- producción. Se niega si hay doctores sin acceso (tienen pacientes, citas o comisiones
-- ligados): primero hay que archivarlos y reasignar sus datos.
-- Se pierden los nombres en la clínica y los perfiles (especialidad, color, teléfono).
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.memberships where user_id is null) then
    raise exception 'Hay doctores sin acceso; reasigna sus datos antes del rollback';
  end if;
end $$;

drop function if exists public.update_doctor_profile(uuid, text, text, text, text);
drop function if exists public.create_doctor(uuid, text, public.tenant_role, text, text, text);
drop function if exists public.create_invitation(uuid, text, public.tenant_role, uuid[], uuid);
drop function if exists private.check_doctor_fields(text, text, text);

-- Versiones anteriores (0005, 0006, 0012, 0017).
create or replace function public.create_invitation(
  p_tenant uuid,
  p_email text,
  p_role public.tenant_role,
  p_branch_ids uuid[] default '{}'
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

  -- Si ya había una pendiente, se renueva (rol, sucursales y vigencia).
  update public.invitations set
    role = p_role,
    branch_ids = coalesce(p_branch_ids, '{}'),
    invited_by = (select auth.uid()),
    expires_at = now() + interval '7 days'
  where tenant_id = p_tenant and email = v_email and status = 'pending'
  returning * into v_inv;

  if v_inv.id is null then
    insert into public.invitations (tenant_id, email, role, branch_ids, invited_by)
    values (p_tenant, v_email, p_role, coalesce(p_branch_ids, '{}'), (select auth.uid()))
    returning * into v_inv;
  end if;

  -- Sin el correo en la auditoría (dato personal): solo id y rol.
  perform private.write_audit(p_tenant, 'invitation.created', 'invitation', v_inv.id::text,
    jsonb_build_object('role', p_role, 'branches', cardinality(v_inv.branch_ids)));
  return v_inv;
end;
$$;

revoke all on function public.create_invitation(uuid, text, public.tenant_role, uuid[]) from public, anon;
grant execute on function public.create_invitation(uuid, text, public.tenant_role, uuid[]) to authenticated;

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
    -- Nueva membresía o reactivación (si fue revocada antes). Nunca toca a la propietaria.
    insert into public.memberships (tenant_id, user_id, role, status)
    values (v_inv.tenant_id, v_uid, v_inv.role, 'active')
    on conflict (tenant_id, user_id) do update
      set role = excluded.role, status = 'active'
      where public.memberships.role <> 'owner'
    returning id into v_membership;

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

  update public.memberships set role = p_role where id = p_membership returning * into v_m;
  perform private.write_audit(v_m.tenant_id, 'membership.role_changed', 'membership', v_m.id::text,
    jsonb_build_object('role', p_role));
  return v_m;
end;
$$;

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
      select m.id, m.role, coalesce(nullif(btrim(pr.full_name), ''), 'Sin nombre') as name
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

drop index if exists public.invitations_membership_idx;
alter table public.invitations drop constraint if exists invitations_membership_fk;
alter table public.invitations drop column if exists membership_id;
drop table if exists public.doctor_settings;
alter table public.memberships drop constraint if exists memberships_offline_doctor;
alter table public.memberships drop column if exists display_name;
alter table public.memberships alter column user_id set not null;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261123000200';
  end if;
end $$;

commit;
