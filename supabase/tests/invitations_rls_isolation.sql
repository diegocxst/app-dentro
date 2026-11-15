-- =============================================================================
-- PRUEBAS · 20261115000500_team_invitations (invitaciones y gestión de miembros)
-- Local: `npm run test:db`. Dev: pegar en el SQL Editor. Termina en ROLLBACK.
-- =============================================================================
begin;

create function pg_temp.assert_true(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FALLO: %', p_msg; end if;
end $$;

create function pg_temp.expect_error(p_sql text, p_state text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then return; end if;
    raise exception 'FALLO: % (sqlstate % en vez de %: %)', p_msg, sqlstate, p_state, sqlerrm;
  end;
  raise exception 'FALLO: % (se esperaba error %)', p_msg, p_state;
end $$;

create function pg_temp.uid(k text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000000' || case k
    when 'owner_a' then '71' when 'admin_a' then '72' when 'doctor_a' then '73'
    when 'nuevo' then '74' when 'owner_b' then '75' when 'sin_confirmar' then '76' when 'super' then '77' end)::uuid;
$$;

create function pg_temp.login_as(k text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(k), 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.t(k text) returns uuid language sql stable as $$ select current_setting('inv.' || k)::uuid $$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.invitations'::regclass),
  'RLS habilitada en invitations');
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'private.assignable_role(public.tenant_role)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.branches_belong(uuid,uuid[])', 'EXECUTE'),
  'los helpers nuevos de private no se ejecutan desde la API');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.inv@example.test', '',
  case when k = 'sin_confirmar' then null else now() end,
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'admin_a', 'doctor_a', 'nuevo', 'owner_b', 'sin_confirmar', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba invitaciones');

select pg_temp.login_as('owner_a');
select set_config('inv.a', (public.create_tenant('Clínica Invita A', 'clinic', 'inv-test-a')).id::text, true);
select set_config('inv.branch_a', (select id::text from public.branches where tenant_id = pg_temp.t('a')), true);
select pg_temp.login_as('owner_b');
select set_config('inv.b', (public.create_tenant('Clínica Invita B', 'clinic', 'inv-test-b')).id::text, true);
select set_config('inv.branch_b', (select id::text from public.branches where tenant_id = pg_temp.t('b')), true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.t('a'), pg_temp.uid('admin_a'), 'admin'),
  (pg_temp.t('a'), pg_temp.uid('doctor_a'), 'doctor');

-- ---------------------------------------------------------- crear invitaciones -
select pg_temp.login_as('owner_a');
select set_config('inv.i1', (public.create_invitation(pg_temp.t('a'), '  Nuevo.Inv@Example.TEST ', 'doctor', array[pg_temp.t('branch_a')])).id::text, true);
select pg_temp.assert_true(
  (select email = 'nuevo.inv@example.test' and status = 'pending' and role = 'doctor' and expires_at > now() + interval '6 days'
   from public.invitations where id = pg_temp.t('i1')),
  'la invitación guarda el correo normalizado, pendiente y con 7 días');
select pg_temp.assert_true(
  (select details::text not like '%@%' from public.audit_logs where action = 'invitation.created' and entity_id = pg_temp.t('i1')::text),
  'la auditoría no guarda el correo');

select public.create_invitation(pg_temp.t('a'), 'nuevo.inv@example.test', 'reception');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(role = 'reception') from public.invitations where tenant_id = pg_temp.t('a') and status = 'pending'),
  'reinvitar el mismo correo renueva la pendiente en lugar de duplicarla');

select pg_temp.expect_error(format($$select public.create_invitation(%L, 'otra@example.test', 'owner')$$, pg_temp.t('a')),
  '22023', 'no se puede invitar como propietaria');
select pg_temp.expect_error(format($$select public.create_invitation(%L, 'otra@example.test', 'doctor', array[%L]::uuid[])$$, pg_temp.t('a'), pg_temp.t('branch_b')),
  '22023', 'no se invita a una sucursal de otra clínica');
select pg_temp.expect_error(format($$select public.create_invitation(%L, 'doctor_a.inv@example.test', 'doctor')$$, pg_temp.t('a')),
  '23505', 'no se invita a quien ya es miembro');
select pg_temp.expect_error(format($$select public.create_invitation(%L, 'no-es-correo', 'doctor')$$, pg_temp.t('a')),
  '23514', 'el correo debe tener formato válido');
select pg_temp.expect_error(format($$insert into public.invitations (tenant_id, email, role) values (%L, 'x@example.test', 'doctor')$$, pg_temp.t('a')),
  '42501', 'sin INSERT directo en invitations');

select pg_temp.login_as('admin_a');
select public.create_invitation(pg_temp.t('a'), 'admin2.inv@example.test', 'admin');
select pg_temp.assert_true((select count(*) = 2 from public.invitations where tenant_id = pg_temp.t('a')), 'el administrador ve e invita');

select pg_temp.login_as('doctor_a');
select pg_temp.assert_true((select count(*) = 0 from public.invitations), 'un doctor no ve invitaciones');
select pg_temp.expect_error(format($$select public.create_invitation(%L, 'x@example.test', 'doctor')$$, pg_temp.t('a')),
  '42501', 'un doctor no invita');

select pg_temp.login_as('owner_b');
select pg_temp.assert_true((select count(*) = 0 from public.invitations where tenant_id = pg_temp.t('a')), 'otra clínica no ve las invitaciones de A');
select pg_temp.expect_error(format($$select public.revoke_invitation(%L)$$, pg_temp.t('i1')), '42501', 'otra clínica no cancela invitaciones de A');
select public.create_invitation(pg_temp.t('b'), 'nuevo.inv@example.test', 'doctor_collab');

-- --------------------------------------------------------------- aceptar -------
select pg_temp.login_as('owner_a');
select public.create_invitation(pg_temp.t('a'), 'sin_confirmar.inv@example.test', 'doctor');
select pg_temp.login_as('sin_confirmar');
select pg_temp.assert_true(public.accept_my_invitations() = 0, 'sin correo confirmado no se acepta nada');
select pg_temp.assert_true(
  (select count(*) = 0 from public.memberships where user_id = pg_temp.uid('sin_confirmar')),
  'sin correo confirmado no se crea la membresía');
select pg_temp.logout();
update public.invitations set status = 'revoked' where email = 'sin_confirmar.inv@example.test';

-- Defensa extra: aunque existiera una invitación al correo de la propietaria
-- (la RPC no la crea), aceptarla no le quita el rol de propietaria.
insert into public.invitations (tenant_id, email, role) values (pg_temp.t('a'), 'owner_a.inv@example.test', 'reception');
select pg_temp.login_as('owner_a');
select public.accept_my_invitations();
select pg_temp.assert_true(
  (select role = 'owner' and status = 'active' from public.memberships where user_id = pg_temp.uid('owner_a') and tenant_id = pg_temp.t('a')),
  'aceptar una invitación nunca cambia el rol de la propietaria');

select pg_temp.login_as('nuevo');
select pg_temp.assert_true(public.accept_my_invitations() = 2, 'acepta las invitaciones de su correo en A y en B');
select pg_temp.assert_true(
  (select count(*) = 2 from public.memberships where user_id = pg_temp.uid('nuevo') and status = 'active'),
  'queda como miembro activo de las dos clínicas');
select pg_temp.assert_true(
  (select role = 'reception' from public.memberships where user_id = pg_temp.uid('nuevo') and tenant_id = pg_temp.t('a')),
  'con el rol de la invitación renovada');
select pg_temp.assert_true(public.accept_my_invitations() = 0, 'aceptar otra vez no hace nada (idempotente)');

-- ------------------------------------------------- cancelar y vencidas ---------
select pg_temp.login_as('owner_a');
select set_config('inv.i2', (public.create_invitation(pg_temp.t('a'), 'tarde.inv@example.test', 'doctor')).id::text, true);
select public.revoke_invitation(pg_temp.t('i2'));
select pg_temp.expect_error(format($$select public.revoke_invitation(%L)$$, pg_temp.t('i2')), '22023', 'no se cancela dos veces');
select pg_temp.logout();
update public.invitations set expires_at = now() - interval '1 minute'
where tenant_id = pg_temp.t('a') and email = 'admin2.inv@example.test';
update auth.users set email = 'admin2.inv@example.test' where id = pg_temp.uid('sin_confirmar');
update auth.users set email_confirmed_at = now() where id = pg_temp.uid('sin_confirmar');
select pg_temp.login_as('sin_confirmar');
select pg_temp.assert_true(public.accept_my_invitations() = 0, 'una invitación vencida no se acepta');

-- ---------------------------------------------------- gestión de miembros ------
select pg_temp.login_as('owner_a');
select set_config('inv.m_doctor', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a') and tenant_id = pg_temp.t('a')), true);
select set_config('inv.m_owner', (select id::text from public.memberships where user_id = pg_temp.uid('owner_a') and tenant_id = pg_temp.t('a')), true);
select public.update_member_role(pg_temp.t('m_doctor'), 'doctor_collab');
select pg_temp.assert_true((select role = 'doctor_collab' from public.memberships where id = pg_temp.t('m_doctor')), 'cambia el rol de un miembro');
select pg_temp.expect_error(format($$select public.update_member_role(%L, 'owner')$$, pg_temp.t('m_doctor')), '22023', 'no se asigna el rol de propietaria');

select pg_temp.login_as('admin_a');
select pg_temp.expect_error(format($$select public.update_member_role(%L, 'admin')$$, pg_temp.t('m_owner')), '42501', 'no se cambia el rol de la propietaria');
select pg_temp.expect_error(format($$select public.revoke_member(%L)$$, pg_temp.t('m_owner')), '42501', 'no se quita a la propietaria');
select public.revoke_member(pg_temp.t('m_doctor'));
select pg_temp.assert_true((select status = 'revoked' from public.memberships where id = pg_temp.t('m_doctor')), 'quita a un miembro (queda revocado)');

select pg_temp.login_as('doctor_a');
select pg_temp.assert_true((select count(*) = 0 from public.tenants where id = pg_temp.t('a')), 'el miembro quitado ya no ve la clínica');

-- reinvitar a quien fue quitado lo reactiva
select pg_temp.login_as('owner_a');
select public.create_invitation(pg_temp.t('a'), 'doctor_a.inv@example.test', 'doctor');
select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(public.accept_my_invitations() = 1, 'reinvitar a alguien quitado lo reactiva');
select pg_temp.assert_true((select count(*) = 1 from public.tenants where id = pg_temp.t('a')), 'y vuelve a ver la clínica');

select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.revoke_member(%L)$$, pg_temp.t('m_doctor')), '42501', 'otra clínica no quita miembros de A');

-- ------------------------------------------------------------- superadmin ------
select pg_temp.login_as('super');
select pg_temp.assert_true((select count(*) >= 4 from public.invitations), 'el superadmin ve las invitaciones');

select pg_temp.logout();
select 'invitaciones: todas las pruebas pasaron' as resultado;

rollback;
