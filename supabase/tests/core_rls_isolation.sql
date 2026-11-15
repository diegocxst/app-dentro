-- =============================================================================
-- PRUEBAS · Aislamiento multiempresa de 20261115000100_core_tenancy
-- Patrón de core-base (Realt-In), con los roles y reglas de dentro.
--
-- Cómo ejecutar:
--   * Local (sin Supabase): `npm run test:db`.
--   * Dev, con aprobación de Diego y DESPUÉS de aplicar la migración: pegar
--     COMPLETO en el SQL Editor → Run.
-- Todo corre en una transacción que termina en ROLLBACK: no deja datos.
--   Éxito: una fila «core: todas las pruebas pasaron».
--   Fallo: «FALLO: <prueba>» y nada se guarda.
--
-- Actores (ficticios, dominio reservado example.test, sin contraseña usable):
--   owner_a      propietaria de la clínica A
--   admin_a      administradora de A
--   reception_a  recepción de A
--   doctor_a     doctor de A
--   collab_a     doctor colaborador en A y en B
--   revoked_a    ex-recepción de A (membresía revocada)
--   owner_b      propietario de la clínica B
--   external_c   usuario registrado sin clínica
--   superadmin   superadministrador de plataforma
--   anon         visitante sin sesión
-- =============================================================================
begin;

-- ---------------------------------------------------------------- helpers ----
create function pg_temp.uid(p_key text) returns uuid language plpgsql immutable as $$
declare v text := case p_key
  when 'owner_a' then 'a1' when 'admin_a' then 'a2' when 'reception_a' then 'a3'
  when 'doctor_a' then 'a4' when 'collab_a' then 'a5' when 'revoked_a' then 'a6'
  when 'owner_b' then 'b1' when 'external_c' then 'c1' when 'superadmin' then 'f1' end;
begin
  if v is null then raise exception 'actor desconocido: %', p_key; end if;
  return ('00000000-0000-4000-8000-0000000000' || v)::uuid;
end $$;

create function pg_temp.id(p_key text) returns uuid language sql stable as $$
  select current_setting('core.' || p_key)::uuid;
$$;

create function pg_temp.login_as(p_key text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_key), 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.login_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.assert_true(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'FALLO: %', p_msg;
  end if;
end $$;

create function pg_temp.expect_error(p_sql text, p_state text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then
      return;
    end if;
    raise exception 'FALLO: % (sqlstate % en vez de %: %)', p_msg, sqlstate, p_state, sqlerrm;
  end;
  raise exception 'FALLO: % (se esperaba error %)', p_msg, p_state;
end $$;

-- Conteos acotados a los datos de esta prueba (se evalúan con RLS del actor).
create function pg_temp.n_tenants() returns bigint language sql stable as $$
  select count(*) from public.tenants where slug like 'core-test-%';
$$;
create function pg_temp.n_profiles() returns bigint language sql stable as $$
  select count(*) from public.profiles where id::text like '00000000-0000-4000-8000-0000000000%';
$$;
create function pg_temp.n_memberships(p_tenant uuid) returns bigint language sql stable as $$
  select count(*) from public.memberships where tenant_id = p_tenant;
$$;
create function pg_temp.n_branches(p_tenant uuid) returns bigint language sql stable as $$
  select count(*) from public.branches where tenant_id = p_tenant;
$$;
create function pg_temp.n_audit(p_tenant uuid) returns bigint language sql stable as $$
  select count(*) from public.audit_logs where tenant_id = p_tenant;
$$;

-- ======================================================= 0. entorno =========
select pg_temp.assert_true(
  (select count(*) = 7 and bool_and(c.relrowsecurity)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where (n.nspname, c.relname) in (('public','profiles'), ('public','tenants'), ('public','memberships'),
                                    ('public','branches'), ('public','membership_branches'),
                                    ('public','audit_logs'), ('private','platform_admins'))),
  'RLS habilitada en las 7 tablas del núcleo');

select pg_temp.assert_true(not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon no tiene USAGE sobre el esquema private');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'private.platform_admins', 'SELECT'),
  'authenticated no puede leer private.platform_admins');
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'private.write_audit(uuid,text,text,text,jsonb)', 'EXECUTE'),
  'authenticated no puede ejecutar private.write_audit');

select pg_temp.assert_true(
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema in ('public', 'private')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  'authenticated no tiene escrituras directas en ninguna tabla (todo por RPC)');
select pg_temp.assert_true(
  not exists (
    select 1 from information_schema.column_privileges
    where grantee = 'authenticated' and table_schema in ('public', 'private')
      and privilege_type in ('INSERT', 'UPDATE')),
  'authenticated no tiene escrituras por columna');
select pg_temp.assert_true(
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'anon' and table_schema in ('public', 'private')),
  'anon no tiene privilegios sobre ninguna tabla');

select pg_temp.assert_true(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'todas las funciones de public y private fijan search_path');
select pg_temp.assert_true(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  'anon no puede ejecutar ninguna RPC de public');

select pg_temp.assert_true(
  (select array_agg(tgname::text) = array['on_auth_user_created']
   from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal),
  'el único trigger en auth.users es on_auth_user_created');

select pg_temp.assert_true(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and (qual ~ 'private\.(is_member|has_role|can_write|is_platform_admin|shares_tenant_with|is_member_any_status)\('
           and qual !~ '\(\s*SELECT\s+private\.')),
  'las políticas llaman a los helpers envueltos en (select …)');

-- ======================================= 1. color de marca (contraste AA) ===
select pg_temp.assert_true(private.ensure_brand_color('#0e5e8a') = '#0E5E8A',
  'un brand_color con contraste AA se conserva (normalizado)');
select pg_temp.assert_true(
  private.ensure_brand_color('#2DD4E0') <> '#2DD4E0'
  and private.contrast_with_white(private.ensure_brand_color('#2DD4E0')) >= 4.5,
  'un brand_color claro se oscurece hasta 4.5:1');
select pg_temp.assert_true(
  private.contrast_with_white(private.ensure_brand_color('#FFFFFF')) >= 4.5
  and private.contrast_with_white(private.ensure_brand_color('#FFFF00')) >= 4.5,
  'blanco y amarillo también se oscurecen hasta AA');
select pg_temp.assert_true(private.ensure_brand_color('rojo') = '#1E1240'
  and private.ensure_brand_color(null) = '#1E1240',
  'un valor inválido usa el color night de dentro');

-- ================================================ 2. usuarios de prueba =====
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated',
       replace(k, '_', '.') || '.core@example.test', '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', n), now(), now(),
       '', '', '', ''
from (values
  ('owner_a', 'Owner A Prueba'), ('admin_a', 'Admin A Prueba'), ('reception_a', 'Recepcion A Prueba'),
  ('doctor_a', 'Doctor A Prueba'), ('collab_a', 'Colaborador Prueba'), ('revoked_a', 'Revocado A Prueba'),
  ('owner_b', 'Owner B Prueba'), ('external_c', 'Externo Prueba'), ('superadmin', 'Superadmin Prueba')
) as v (k, n);

select pg_temp.assert_true(
  (select count(*) from public.profiles
   where id::text like '00000000-0000-4000-8000-0000000000%' and full_name like '% Prueba') = 9,
  'el alta en Auth crea el perfil con nombre para los 9 usuarios');

-- ================================================= 3. alta de clínicas ======
select pg_temp.login_anon();
select pg_temp.expect_error(
  $$select public.create_tenant('Anonima', 'clinic', 'core-test-anon')$$, '42501',
  'anon no puede crear clínicas');

select pg_temp.login_as('owner_a');
select set_config('core.tenant_a',
  (public.create_tenant('Clínica A Prueba', 'clinic', 'core-test-a', 'Dra. A Prueba', 'Propietaria', '#2DD4E0')).id::text, true);

select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(name = 'Sucursal principal' and is_active)
   from public.branches where tenant_id = pg_temp.id('tenant_a')),
  'create_tenant crea la «Sucursal principal»');
select pg_temp.expect_error(
  $$select public.create_tenant('Segunda Prueba', 'independent', 'core-test-a2')$$, 'P0001',
  'D5: un usuario solo puede crear 1 clínica en el MVP');

select pg_temp.login_as('owner_b');
select pg_temp.expect_error(
  $$select public.create_tenant('Reservada', 'clinic', 'pacientes')$$, '23514',
  'no se puede usar un slug reservado');
select pg_temp.expect_error(
  $$select public.create_tenant('Duplicada', 'clinic', 'core-test-a')$$, '23505',
  'no se puede repetir el slug de otra clínica');
select set_config('core.tenant_b',
  (public.create_tenant('Consultorio B Prueba', 'independent', ' Core-Test-B ')).id::text, true);

select pg_temp.logout();
select pg_temp.assert_true(
  (select brand_color <> '#2DD4E0' and private.contrast_with_white(brand_color) >= 4.5
   from public.tenants where id = pg_temp.id('tenant_a')),
  'create_tenant guarda el brand_color ya ajustado a AA');
select pg_temp.assert_true(
  (select slug = 'core-test-b' and brand_color = '#1E1240' from public.tenants where id = pg_temp.id('tenant_b')),
  'el slug se normaliza y sin brand_color se usa night');
select pg_temp.assert_true(
  (select role = 'owner' and status = 'active' from public.memberships
   where tenant_id = pg_temp.id('tenant_a') and user_id = pg_temp.uid('owner_a')),
  'quien crea la clínica queda como propietario activo');

select set_config('core.branch_a1', (select id::text from public.branches where tenant_id = pg_temp.id('tenant_a')), true);
select set_config('core.branch_b1', (select id::text from public.branches where tenant_id = pg_temp.id('tenant_b')), true);

-- Equipo (las invitaciones por RPC llegan en E1-B5; aquí se siembran).
insert into public.memberships (tenant_id, user_id, role, status) values
  (pg_temp.id('tenant_a'), pg_temp.uid('admin_a'),     'admin',         'active'),
  (pg_temp.id('tenant_a'), pg_temp.uid('reception_a'), 'reception',     'active'),
  (pg_temp.id('tenant_a'), pg_temp.uid('doctor_a'),    'doctor',        'active'),
  (pg_temp.id('tenant_a'), pg_temp.uid('collab_a'),    'doctor_collab', 'active'),
  (pg_temp.id('tenant_a'), pg_temp.uid('revoked_a'),   'reception',     'revoked'),
  (pg_temp.id('tenant_b'), pg_temp.uid('collab_a'),    'doctor_collab', 'active');
insert into private.platform_admins (user_id, note) values (pg_temp.uid('superadmin'), 'prueba core');

select set_config('core.m_doctor_a', (select id::text from public.memberships
  where tenant_id = pg_temp.id('tenant_a') and user_id = pg_temp.uid('doctor_a')), true);
select set_config('core.m_collab_b', (select id::text from public.memberships
  where tenant_id = pg_temp.id('tenant_b') and user_id = pg_temp.uid('collab_a')), true);

select pg_temp.expect_error(
  format($$insert into public.membership_branches (tenant_id, membership_id, branch_id) values (%L, %L, %L)$$,
         pg_temp.id('tenant_a'), pg_temp.id('m_doctor_a'), pg_temp.id('branch_b1')),
  '23503', 'FK compuesta: una membresía de A no puede apuntar a una sucursal de B');

-- ====================================== 4. propietaria de A (activa) ========
select pg_temp.login_as('owner_a');

select pg_temp.assert_true(pg_temp.n_tenants() = 1, 'owner_a solo ve su clínica');
select pg_temp.assert_true(pg_temp.n_memberships(pg_temp.id('tenant_a')) = 6, 'owner_a ve las 6 membresías de A');
select pg_temp.assert_true(pg_temp.n_memberships(pg_temp.id('tenant_b')) = 0, 'owner_a no ve membresías de B');
select pg_temp.assert_true(pg_temp.n_profiles() = 5, 'owner_a ve 5 perfiles: el suyo y su equipo activo');
select pg_temp.assert_true(not exists (select 1 from public.profiles where id = pg_temp.uid('revoked_a')),
  'owner_a no ve el perfil de la ex-recepción revocada');
select pg_temp.assert_true(pg_temp.n_branches(pg_temp.id('tenant_b')) = 0, 'owner_a no ve sucursales de B');
select pg_temp.assert_true(pg_temp.n_audit(pg_temp.id('tenant_a')) >= 1, 'owner_a ve la auditoría de A');

-- Escrituras directas: todas rechazadas.
select pg_temp.expect_error($$insert into public.tenants (kind, display_name, slug) values ('clinic', 'Directa', 'core-test-x')$$,
  '42501', 'sin INSERT directo en tenants');
select pg_temp.expect_error(format($$update public.tenants set display_name = 'Hackeada' where id = %L$$, pg_temp.id('tenant_a')),
  '42501', 'sin UPDATE directo en tenants (ni siendo propietaria)');
select pg_temp.expect_error(format($$update public.profiles set full_name = 'X' where id = %L$$, pg_temp.uid('owner_a')),
  '42501', 'sin UPDATE directo en el propio perfil');
select pg_temp.expect_error(format($$delete from public.memberships where tenant_id = %L$$, pg_temp.id('tenant_a')),
  '42501', 'sin DELETE directo en memberships');
select pg_temp.expect_error(format($$insert into public.branches (tenant_id, name) values (%L, 'Directa')$$, pg_temp.id('tenant_a')),
  '42501', 'sin INSERT directo en branches');
select pg_temp.expect_error(format($$insert into public.audit_logs (tenant_id, action, entity) values (%L, 'x', 'y')$$, pg_temp.id('tenant_a')),
  '42501', 'sin INSERT directo en audit_logs');

-- Escrituras por RPC.
select public.update_tenant_identity(pg_temp.id('tenant_a'),
  p_owner_display_name => 'Dra. Nueva Prueba', p_brand_color => '#B42A5B');
select pg_temp.assert_true(
  (select owner_display_name = 'Dra. Nueva Prueba' and brand_color = '#B42A5B'
   from public.tenants where id = pg_temp.id('tenant_a')),
  'update_tenant_identity cambia la identidad');
select pg_temp.assert_true(
  (select details -> 'fields' ? 'owner_display_name' and details::text not like '%Prueba%'
   from public.audit_logs where tenant_id = pg_temp.id('tenant_a') and action = 'tenant.identity_updated'
   order by id desc limit 1),
  'la auditoría guarda los nombres de los campos, no los datos personales');
select pg_temp.expect_error(
  format($$select public.update_tenant_identity(%L, p_display_name => '')$$, pg_temp.id('tenant_a')),
  '23514', 'no se acepta un nombre de clínica vacío');

select set_config('core.branch_a2', (public.create_branch(pg_temp.id('tenant_a'), 'Sucursal Norte', 'Calle Prueba 1')).id::text, true);
select pg_temp.expect_error(
  format($$select public.create_branch(%L, ' sucursal norte ')$$, pg_temp.id('tenant_a')),
  '23505', 'no se repite el nombre de sucursal en la misma clínica');
select public.update_branch(pg_temp.id('branch_a2'), p_is_active => false);
select pg_temp.expect_error(
  format($$select public.update_branch(%L, p_is_active => false)$$, pg_temp.id('branch_a1')),
  '22023', 'no se puede desactivar la última sucursal activa');
select public.update_branch(pg_temp.id('branch_a2'), p_is_active => true);

select public.set_membership_branches(pg_temp.id('m_doctor_a'), array[pg_temp.id('branch_a2')]);
select pg_temp.assert_true(
  (select count(*) = 1 from public.membership_branches where membership_id = pg_temp.id('m_doctor_a')),
  'set_membership_branches asigna sucursales');
select pg_temp.expect_error(
  format($$select public.set_membership_branches(%L, array[%L]::uuid[])$$, pg_temp.id('m_doctor_a'), pg_temp.id('branch_b1')),
  '22023', 'no se asigna una sucursal de otra clínica');

-- Cruzar a la clínica B: rechazado.
select pg_temp.expect_error(
  format($$select public.update_tenant_identity(%L, p_display_name => 'Robada')$$, pg_temp.id('tenant_b')),
  '42501', 'owner_a no puede cambiar la identidad de B');
select pg_temp.expect_error(
  format($$select public.create_branch(%L, 'Intrusa')$$, pg_temp.id('tenant_b')),
  '42501', 'owner_a no puede crear sucursales en B');
select pg_temp.expect_error(
  format($$select public.update_branch(%L, p_name => 'Intrusa')$$, pg_temp.id('branch_b1')),
  '42501', 'owner_a no puede editar sucursales de B');
select pg_temp.expect_error(
  format($$select public.set_membership_branches(%L, '{}')$$, pg_temp.id('m_collab_b')),
  '42501', 'owner_a no puede tocar membresías de B');
select pg_temp.expect_error(
  format($$select public.admin_set_tenant_status(%L, 'suspended', 'intento de propietaria')$$, pg_temp.id('tenant_a')),
  '42501', 'solo el superadmin cambia el estatus');

-- Perfil propio por RPC.
select public.update_my_profile(p_phone_e164 => '+525512345678');
select pg_temp.assert_true(
  (select phone_e164 = '+525512345678' from public.profiles where id = pg_temp.uid('owner_a')),
  'update_my_profile guarda el teléfono');
select pg_temp.expect_error($$select public.update_my_profile(p_phone_e164 => '5512')$$,
  '23514', 'teléfono inválido rechazado');

-- ============================================== 5. administradora de A ======
select pg_temp.login_as('admin_a');
select public.update_tenant_identity(pg_temp.id('tenant_a'), p_owner_title => 'Directora');
select pg_temp.assert_true(pg_temp.n_audit(pg_temp.id('tenant_a')) >= 1, 'admin_a ve la auditoría de A');

-- ========================================= 6. recepción, doctor, colaborador =
select pg_temp.login_as('reception_a');
select pg_temp.assert_true(pg_temp.n_tenants() = 1 and pg_temp.n_branches(pg_temp.id('tenant_a')) = 2,
  'recepción ve su clínica y sus sucursales');
select pg_temp.assert_true(pg_temp.n_memberships(pg_temp.id('tenant_a')) = 6, 'recepción ve el equipo de A');
select pg_temp.assert_true(pg_temp.n_audit(pg_temp.id('tenant_a')) = 0, 'recepción no ve la auditoría');
select pg_temp.expect_error(
  format($$select public.update_tenant_identity(%L, p_display_name => 'Recepción')$$, pg_temp.id('tenant_a')),
  '42501', 'recepción no cambia la identidad');
select pg_temp.expect_error(
  format($$select public.create_branch(%L, 'Otra')$$, pg_temp.id('tenant_a')),
  '42501', 'recepción no crea sucursales');

select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(
  (select count(*) = 1 from public.membership_branches where membership_id = pg_temp.id('m_doctor_a')),
  'el doctor ve sus sucursales asignadas');
select pg_temp.assert_true(pg_temp.n_audit(pg_temp.id('tenant_a')) = 0, 'el doctor no ve la auditoría');
select pg_temp.expect_error(
  format($$select public.set_membership_branches(%L, '{}')$$, pg_temp.id('m_doctor_a')),
  '42501', 'el doctor no cambia sus propias sucursales');

select pg_temp.login_as('collab_a');
select pg_temp.assert_true(pg_temp.n_tenants() = 2, 'el colaborador ve las 2 clínicas donde trabaja');
select pg_temp.assert_true(pg_temp.n_audit(pg_temp.id('tenant_a')) = 0 and pg_temp.n_audit(pg_temp.id('tenant_b')) = 0,
  'el colaborador no ve auditoría de ninguna');
select pg_temp.assert_true(pg_temp.n_profiles() = 6,
  'el colaborador ve perfiles de sus dos equipos (los 5 activos de A, incluido el suyo, + owner_b)');
select pg_temp.expect_error(
  format($$select public.create_branch(%L, 'Colab')$$, pg_temp.id('tenant_b')),
  '42501', 'el colaborador no crea sucursales');

-- ============================================ 7. revocado y externo =========
select pg_temp.login_as('revoked_a');
select pg_temp.assert_true(pg_temp.n_tenants() = 0, 'la membresía revocada no ve la clínica');
select pg_temp.assert_true(pg_temp.n_memberships(pg_temp.id('tenant_a')) = 1, 'la revocada solo ve su propia membresía');
select pg_temp.assert_true(pg_temp.n_branches(pg_temp.id('tenant_a')) = 0, 'la revocada no ve sucursales');
select pg_temp.assert_true(pg_temp.n_profiles() = 1, 'la revocada solo ve su perfil');

select pg_temp.login_as('external_c');
select pg_temp.assert_true(pg_temp.n_tenants() = 0 and pg_temp.n_profiles() = 1
  and pg_temp.n_memberships(pg_temp.id('tenant_a')) = 0,
  'un usuario sin clínica no ve nada ajeno');
select pg_temp.assert_true(public.am_i_platform_admin() is false, 'external_c no es superadmin');

-- ======================================================== 8. anónimo ========
select pg_temp.login_anon();
select pg_temp.expect_error($$select count(*) from public.tenants$$, '42501', 'anon no lee tenants');
select pg_temp.expect_error($$select count(*) from public.profiles$$, '42501', 'anon no lee profiles');
select pg_temp.expect_error($$select count(*) from public.memberships$$, '42501', 'anon no lee memberships');
select pg_temp.expect_error($$select count(*) from public.branches$$, '42501', 'anon no lee branches');
select pg_temp.expect_error($$select public.am_i_platform_admin()$$, '42501', 'anon no ejecuta RPC');

-- ===================================================== 9. superadmin ========
select pg_temp.login_as('superadmin');
select pg_temp.assert_true(public.am_i_platform_admin(), 'am_i_platform_admin reconoce al superadmin');
select pg_temp.assert_true(pg_temp.n_tenants() = 2, 'el superadmin ve todas las clínicas');
select pg_temp.assert_true(
  pg_temp.n_memberships(pg_temp.id('tenant_a')) = 6 and pg_temp.n_memberships(pg_temp.id('tenant_b')) = 2,
  'el superadmin ve las membresías de todas las clínicas');
select pg_temp.assert_true(pg_temp.n_profiles() = 9, 'el superadmin ve los perfiles de todos');
select pg_temp.assert_true(pg_temp.n_branches(pg_temp.id('tenant_b')) = 1 and pg_temp.n_audit(pg_temp.id('tenant_a')) >= 1,
  'el superadmin ve sucursales y auditoría');
select pg_temp.expect_error(
  format($$select public.update_tenant_identity(%L, p_display_name => 'Super')$$, pg_temp.id('tenant_a')),
  '42501', 'el superadmin no edita la identidad de una clínica');
select pg_temp.expect_error(
  format($$select public.admin_set_tenant_status(%L, 'suspended', 'no')$$, pg_temp.id('tenant_b')),
  '22023', 'cambiar estatus exige un motivo');
select public.admin_set_tenant_status(pg_temp.id('tenant_b'), 'suspended', 'Falta de pago de prueba');
select pg_temp.assert_true(
  (select details ->> 'reason' = 'Falta de pago de prueba' and details ->> 'new_status' = 'suspended'
   from public.audit_logs where tenant_id = pg_temp.id('tenant_b') and action = 'tenant.status_changed'),
  'el cambio de estatus queda auditado con motivo');

-- =============================================== 10. clínica suspendida =====
select pg_temp.login_as('owner_b');
select pg_temp.assert_true(pg_temp.n_tenants() = 1 and pg_temp.n_branches(pg_temp.id('tenant_b')) = 1,
  'suspendida: el propietario sigue leyendo');
select pg_temp.expect_error(
  format($$select public.update_tenant_identity(%L, p_display_name => 'Suspendida')$$, pg_temp.id('tenant_b')),
  '42501', 'suspendida: no se puede cambiar la identidad');
select pg_temp.expect_error(
  format($$select public.create_branch(%L, 'Suspendida')$$, pg_temp.id('tenant_b')),
  '42501', 'suspendida: no se pueden crear sucursales');

-- ================================================ 11. clínica cancelada =====
select pg_temp.login_as('superadmin');
select public.admin_set_tenant_status(pg_temp.id('tenant_b'), 'cancelled', 'Cancelación de prueba');

select pg_temp.login_as('owner_b');
select pg_temp.assert_true(pg_temp.n_tenants() = 1, 'cancelada: el propietario ve la ficha para el aviso');
select pg_temp.assert_true(pg_temp.n_branches(pg_temp.id('tenant_b')) = 0, 'cancelada: sin acceso a sucursales');
select pg_temp.assert_true(pg_temp.n_memberships(pg_temp.id('tenant_b')) = 1, 'cancelada: solo ve su propia membresía');
select pg_temp.assert_true(pg_temp.n_audit(pg_temp.id('tenant_b')) = 0, 'cancelada: sin acceso a la auditoría');

select pg_temp.login_as('collab_a');
select pg_temp.assert_true(pg_temp.n_branches(pg_temp.id('tenant_a')) = 2 and pg_temp.n_branches(pg_temp.id('tenant_b')) = 0,
  'el colaborador sigue viendo A pero ya no B');

select pg_temp.login_as('owner_b');
select set_config('core.tenant_b2',
  (public.create_tenant('Consultorio B2 Prueba', 'independent', 'core-test-b2')).id::text, true);
select pg_temp.assert_true(pg_temp.id('tenant_b2') is not null,
  'una clínica cancelada no cuenta para el límite de 1 clínica');

-- ======================================================== resultado =========
select pg_temp.logout();
select 'core: todas las pruebas pasaron' as resultado;

rollback;
