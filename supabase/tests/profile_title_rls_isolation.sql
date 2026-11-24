-- =============================================================================
-- PRUEBAS · 20261124000100_profile_title (título «Dr.» o «Dra.» en el perfil)
-- Local: `npm run test:db`. Dev: `npx supabase db query --remote --yes -f <este archivo>`.
-- Actores: owner_a, reception_a, doctor_a, doctor2_a, owner_b, super. Termina en ROLLBACK.
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
    when 'owner_a' then 'f1' when 'reception_a' then 'f2' when 'doctor_a' then 'f3' when 'doctor2_a' then 'f4'
    when 'owner_b' then 'f5' when 'super' then 'f6' end)::uuid;
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

create function pg_temp.title_seen_by(k text, who text) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.login_as(k);
  select title into v from public.profiles where id = pg_temp.uid(who);
  perform pg_temp.logout();
  return v;
end $$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'update_my_profile'),
  'update_my_profile tiene una sola firma');
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.update_my_profile(text,text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_my_profile(text,text,text)', 'EXECUTE'),
  'anon no ejecuta update_my_profile; authenticated sí');
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'authenticated no escribe profiles directo');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.title@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba título');

select pg_temp.login_as('owner_a');
select set_config('tt.a', (public.create_tenant('Clínica Título A', 'clinic', 'title-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('tt.b', (public.create_tenant('Clínica Título B', 'clinic', 'title-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (current_setting('tt.a')::uuid, pg_temp.uid('reception_a'), 'reception'),
  (current_setting('tt.a')::uuid, pg_temp.uid('doctor_a'), 'doctor'),
  (current_setting('tt.a')::uuid, pg_temp.uid('doctor2_a'), 'doctor_collab');

select pg_temp.assert_true((select title = '' from public.profiles where id = pg_temp.uid('doctor_a')), 'sin título por omisión');

-- ------------------------------------------------------------- escritura ----
select pg_temp.login_as('doctor_a');
select pg_temp.expect_error($$select public.update_my_profile(p_title => 'Doctora')$$, '22023', 'solo Dr., Dra. o sin título');
select pg_temp.expect_error($$select public.update_my_profile(p_title => 'Lic.')$$, '22023', 'otros títulos no');
select public.update_my_profile(p_title => ' Dra. ');
select pg_temp.assert_true((select title = 'Dra.' from public.profiles where id = pg_temp.uid('doctor_a')), 'guarda el título sin espacios');
select public.update_my_profile(p_full_name => 'Doctora A Prueba');
select pg_temp.assert_true(
  (select title = 'Dra.' and full_name = 'Doctora A Prueba' from public.profiles where id = pg_temp.uid('doctor_a')),
  'NULL no cambia el título');
select pg_temp.expect_error(
  format($$update public.profiles set title = 'Dr.' where id = %L$$, pg_temp.uid('doctor_a')),
  '42501', 'no se escribe directo en profiles');

select pg_temp.login_as('doctor2_a');
select public.update_my_profile(p_title => 'Dr.');
select public.update_my_profile(p_title => '');
select pg_temp.assert_true((select title = '' from public.profiles where id = pg_temp.uid('doctor2_a')), 'cadena vacía quita el título');
select public.update_my_profile(p_title => 'Dr.');

-- Cada quien cambia solo el suyo: la RPC actúa sobre auth.uid().
select pg_temp.login_as('owner_a');
select public.update_my_profile(p_title => 'Dr.');
select pg_temp.logout();
select pg_temp.assert_true(
  (select title from public.profiles where id = pg_temp.uid('doctor_a')) = 'Dra.'
  and (select title from public.profiles where id = pg_temp.uid('owner_a')) = 'Dr.',
  'la dueña cambia su título, no el del doctor');

-- --------------------------------------------------------------- lectura ----
select pg_temp.assert_true(pg_temp.title_seen_by('reception_a', 'doctor_a') = 'Dra.', 'recepción ve el título de su compañera');
select pg_temp.assert_true(pg_temp.title_seen_by('doctor2_a', 'doctor_a') = 'Dra.', 'otro doctor de la clínica lo ve');
select pg_temp.assert_true(pg_temp.title_seen_by('owner_a', 'doctor2_a') = 'Dr.', 'la dueña ve el título de su doctor');
select pg_temp.assert_true(pg_temp.title_seen_by('owner_b', 'doctor_a') is null, 'otra clínica no ve el perfil');
select pg_temp.assert_true(pg_temp.title_seen_by('super', 'doctor_a') = 'Dra.', 'el superadmin ve perfiles (no son datos clínicos)');

select set_config('role', 'none', true);
select 'título: todas las pruebas pasaron' as resultado;

rollback;
