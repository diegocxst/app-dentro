-- =============================================================================
-- PRUEBAS · 20261115000400_tenant_logo (logo de la clínica en Storage privado)
-- Local: `npm run test:db`. Dev: pegar en el SQL Editor. Termina en ROLLBACK.
-- Los objetos se insertan directo en storage.objects (como haría la API de
-- Storage con el JWT del usuario) para probar las políticas.
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

create function pg_temp.rows(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

create function pg_temp.uid(k text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000000' || case k
    when 'owner_a' then 'f1' when 'reception_a' then 'f2' when 'owner_b' then 'f3' when 'super' then 'f4' end)::uuid;
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

create function pg_temp.t(k text) returns uuid language sql stable as $$ select current_setting('logo.' || k)::uuid $$;

create function pg_temp.n_logos(p_tenant uuid) returns bigint language sql stable as $$
  select count(*) from storage.objects where bucket_id = 'tenant-branding' and name like p_tenant::text || '/%';
$$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  (select not public and file_size_limit = 1048576 and allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
   from storage.buckets where id = 'tenant-branding'),
  'el bucket tenant-branding es privado, de 1 MB y solo PNG, JPG y WebP');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.logo@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba logo');

select pg_temp.login_as('owner_a');
select set_config('logo.a', (public.create_tenant('Clínica Logo A', 'clinic', 'logo-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('logo.b', (public.create_tenant('Clínica Logo B', 'clinic', 'logo-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values (pg_temp.t('a'), pg_temp.uid('reception_a'), 'reception');

-- -------------------------------------------------------------- propietaria ---
select pg_temp.login_as('owner_a');
insert into storage.objects (bucket_id, name, owner) values ('tenant-branding', pg_temp.t('a') || '/logo-0123456789ab.png', pg_temp.uid('owner_a'));
select pg_temp.assert_true(pg_temp.n_logos(pg_temp.t('a')) = 1, 'la propietaria sube y ve el logo de su clínica');
select pg_temp.expect_error(
  format($$insert into storage.objects (bucket_id, name) values ('tenant-branding', %L)$$, pg_temp.t('b') || '/logo-0123456789ab.png'),
  '42501', 'no sube logos en la carpeta de otra clínica');
select pg_temp.expect_error(
  format($$insert into storage.objects (bucket_id, name) values ('tenant-branding', %L)$$, pg_temp.t('a') || '/expediente.pdf'),
  '42501', 'solo acepta rutas logo-<id>.<png|jpg|webp>');
select pg_temp.expect_error(
  format($$insert into storage.objects (bucket_id, name) values ('tenant-branding', %L)$$, pg_temp.t('a') || '/logo-0123456789ab.svg'),
  '42501', 'no acepta SVG');

select public.update_tenant_identity(pg_temp.t('a'), p_logo_path => pg_temp.t('a') || '/logo-0123456789ab.png');
select pg_temp.assert_true(
  (select logo_path = pg_temp.t('a') || '/logo-0123456789ab.png' from public.tenants where id = pg_temp.t('a')),
  'update_tenant_identity guarda la ruta del logo');
select pg_temp.expect_error(
  format($$select public.update_tenant_identity(%L, p_logo_path => %L)$$, pg_temp.t('a'), pg_temp.t('b') || '/logo-0123456789ab.png'),
  '22023', 'el logo no puede apuntar a un archivo de otra clínica');
select pg_temp.expect_error(
  format($$select public.update_tenant_identity(%L, p_logo_path => 'https://example.test/logo.png')$$, pg_temp.t('a')),
  '22023', 'el logo no puede ser una URL externa');

-- ------------------------------------------------------- recepción de A ------
select pg_temp.login_as('reception_a');
select pg_temp.assert_true(pg_temp.n_logos(pg_temp.t('a')) = 1, 'recepción ve el logo de su clínica');
select pg_temp.expect_error(
  format($$insert into storage.objects (bucket_id, name) values ('tenant-branding', %L)$$, pg_temp.t('a') || '/logo-abcdefabcdef.png'),
  '42501', 'recepción no sube logos');
select set_config('storage.allow_delete_query', 'true', true);
select pg_temp.assert_true(
  pg_temp.rows(format($$delete from storage.objects where bucket_id = 'tenant-branding' and name like %L$$, pg_temp.t('a') || '/%')) = 0,
  'recepción no borra el logo');
select pg_temp.assert_true(
  pg_temp.rows(format($$update storage.objects set metadata = '{}' where bucket_id = 'tenant-branding' and name like %L$$, pg_temp.t('a') || '/%')) = 0,
  'recepción no cambia el logo');

-- ------------------------------------------------------------- otra clínica ---
select pg_temp.login_as('owner_b');
select pg_temp.assert_true(pg_temp.n_logos(pg_temp.t('a')) = 0, 'otra clínica no ve el logo de A');
select pg_temp.assert_true(
  pg_temp.rows(format($$delete from storage.objects where bucket_id = 'tenant-branding' and name like %L$$, pg_temp.t('a') || '/%')) = 0,
  'otra clínica no borra el logo de A');

-- --------------------------------------------------------------- superadmin ---
select pg_temp.login_as('super');
select pg_temp.assert_true(pg_temp.n_logos(pg_temp.t('a')) = 1, 'el superadmin ve los logos');
select pg_temp.expect_error(
  format($$insert into storage.objects (bucket_id, name) values ('tenant-branding', %L)$$, pg_temp.t('a') || '/logo-abcdefabcdef.png'),
  '42501', 'el superadmin no sube logos por la clínica');

-- ------------------------------------------------------- suspendida y borrar --
select public.admin_set_tenant_status(pg_temp.t('a'), 'suspended', 'Prueba de logo suspendida');
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(pg_temp.n_logos(pg_temp.t('a')) = 1, 'suspendida: el logo se sigue viendo');
select pg_temp.assert_true(
  pg_temp.rows(format($$delete from storage.objects where bucket_id = 'tenant-branding' and name like %L$$, pg_temp.t('a') || '/%')) = 0,
  'suspendida: no se puede borrar el logo');
select pg_temp.login_as('super');
select public.admin_set_tenant_status(pg_temp.t('a'), 'active', 'Reactivación de prueba');
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  pg_temp.rows(format($$delete from storage.objects where bucket_id = 'tenant-branding' and name like %L$$, pg_temp.t('a') || '/%')) = 1,
  'la propietaria de una clínica activa borra su logo');

select pg_temp.logout();
select 'logo: todas las pruebas pasaron' as resultado;

rollback;
