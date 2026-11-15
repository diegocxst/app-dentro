-- =============================================================================
-- 0005 · Invitaciones de equipo y gestión de miembros (E1-B5c)
-- Decisiones D4 (doctores y recepción entran por invitación) y E1-B1 #5.
--
-- Flujo: la dueña o un administrador crea la invitación (RPC) → la Edge Function
-- `invite-member` envía el correo con la clave de servicio (solo en el servidor) →
-- la persona activa su cuenta → al entrar, `accept_my_invitations()` convierte las
-- invitaciones vigentes de SU correo (verificado por Supabase Auth) en membresías.
--
-- Rollback: supabase/rollback/20261115000500_team_invitations.down.sql
-- =============================================================================

create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  role public.tenant_role not null check (role <> 'owner'),
  branch_ids uuid[] not null default '{}',
  status public.invitation_status not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
-- Una sola invitación pendiente por correo y clínica.
create unique index invitations_one_pending_idx on public.invitations (tenant_id, email) where status = 'pending';
create index invitations_email_pending_idx on public.invitations (email) where status = 'pending';
create index invitations_tenant_created_idx on public.invitations (tenant_id, created_at desc);

create trigger invitations_set_updated_at before update on public.invitations
  for each row execute function private.set_updated_at();

-- Roles que se pueden invitar o asignar (nunca `owner`: hay uno solo por clínica).
create or replace function private.assignable_role(p_role public.tenant_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_role in ('admin', 'reception', 'doctor', 'doctor_collab');
$$;

-- ¿Todas las sucursales son de la clínica?
create or replace function private.branches_belong(p_tenant uuid, p_branch_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from unnest(coalesce(p_branch_ids, '{}')) as b(id)
    where not exists (select 1 from public.branches br where br.id = b.id and br.tenant_id = p_tenant)
  );
$$;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Crea (o renueva) la invitación. Solo propietario o administrador de una clínica
-- activa. Devuelve la invitación; el correo lo envía la Edge Function.
-- Errores: 42501 sin permiso · 22023 rol o sucursal inválidos · 23505 ya es miembro.
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

create or replace function public.revoke_invitation(p_invitation uuid)
returns public.invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation;
  if v_inv.id is null then
    raise exception 'Invitación no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_inv.tenant_id);
  if v_inv.status <> 'pending' then
    raise exception 'La invitación ya no está pendiente' using errcode = '22023';
  end if;

  update public.invitations set status = 'revoked' where id = p_invitation returning * into v_inv;
  perform private.write_audit(v_inv.tenant_id, 'invitation.revoked', 'invitation', v_inv.id::text);
  return v_inv;
end;
$$;

-- Convierte en membresías las invitaciones vigentes del correo VERIFICADO de quien
-- llama. Idempotente. Devuelve cuántas aceptó.
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

-- Cambia el rol de un miembro. Nunca a ni desde `owner`.
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

-- Quita a alguien del equipo (conserva la fila como `revoked`). Nunca a la propietaria.
create or replace function public.revoke_member(p_membership uuid)
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
    raise exception 'No se puede quitar a la propietaria o el propietario' using errcode = '42501';
  end if;

  update public.memberships set status = 'revoked' where id = p_membership returning * into v_m;
  perform private.write_audit(v_m.tenant_id, 'membership.revoked', 'membership', v_m.id::text);
  return v_m;
end;
$$;

revoke all on function private.assignable_role(public.tenant_role) from public, anon, authenticated;
revoke all on function private.branches_belong(uuid, uuid[]) from public, anon, authenticated;

revoke all on function public.create_invitation(uuid, text, public.tenant_role, uuid[]) from public, anon;
grant execute on function public.create_invitation(uuid, text, public.tenant_role, uuid[]) to authenticated;
revoke all on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;
revoke all on function public.accept_my_invitations() from public, anon;
grant execute on function public.accept_my_invitations() to authenticated;
revoke all on function public.update_member_role(uuid, public.tenant_role) from public, anon;
grant execute on function public.update_member_role(uuid, public.tenant_role) to authenticated;
revoke all on function public.revoke_member(uuid) from public, anon;
grant execute on function public.revoke_member(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: invitaciones visibles para propietario/administrador y superadmin.
-- -----------------------------------------------------------------------------
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;

create policy invitations_select on public.invitations
  for select to authenticated
  using (
    (select private.has_role(tenant_id, array['owner', 'admin']::public.tenant_role[]))
    or (select private.is_platform_admin())
  );
