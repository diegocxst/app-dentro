-- =============================================================================
-- PRUEBAS · 20261116000500_patient_documents (DATOS DE SALUD)
-- Local: `npm run test:db`. Dev: pegar en el SQL Editor. Termina en ROLLBACK.
-- Los objetos se insertan en storage.objects como lo haría la API de Storage.
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
    when 'owner_a' then 'c1' when 'reception_a' then 'c2' when 'doctor_a' then 'c3' when 'doctor2_a' then 'c4'
    when 'owner_b' then 'c5' when 'super' then 'c6' end)::uuid;
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('doc.' || k)::uuid $$;
create function pg_temp.path(k text, f text) returns text language sql stable as $$
  select pg_temp.v('a') || '/' || pg_temp.v(k) || '/' || f
$$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  (select not public and file_size_limit = 26214400 from storage.buckets where id = 'patient-documents'),
  'el bucket es privado y de 25 MB');
select pg_temp.assert_true(
  not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
              and policyname like 'patient_documents%' and cmd in ('SELECT', 'UPDATE', 'DELETE', 'ALL')),
  'no hay políticas para leer, cambiar o borrar archivos de pacientes');
select pg_temp.assert_true(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.patient_documents'::regclass, 'public.document_access_log'::regclass)),
  'RLS habilitada en documentos y bitácora');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.doc@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba documentos');

select pg_temp.login_as('owner_a');
select set_config('doc.a', (public.create_tenant('Clínica Docs A', 'clinic', 'doc-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('doc.b', (public.create_tenant('Clínica Docs B', 'clinic', 'doc-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor');
select set_config('doc.m_doctor', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);

select pg_temp.login_as('reception_a');
select set_config('doc.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Doc Uno', 'papel', p_primary_doctor => pg_temp.v('m_doctor'))).id::text, true);
select set_config('doc.p2', (public.create_patient(pg_temp.v('a'), 'Paciente Doc Dos', 'papel')).id::text, true);

-- ---------------------------------------------------------------- subir -------
select pg_temp.login_as('doctor_a');
insert into storage.objects (bucket_id, name, owner, metadata)
values ('patient-documents', pg_temp.path('p1', '11111111-1111-4111-8111-111111111111.jpg'), pg_temp.uid('doctor_a'), '{"mimetype":"image/jpeg","size":2048}');
select pg_temp.expect_error(
  format($$insert into storage.objects (bucket_id, name) values ('patient-documents', %L)$$, pg_temp.path('p2', '22222222-2222-4222-8222-222222222222.jpg')),
  '42501', 'un doctor no sube archivos de pacientes ajenos');
select pg_temp.expect_error(
  format($$insert into storage.objects (bucket_id, name) values ('patient-documents', %L)$$, pg_temp.path('p1', 'radiografia.exe')),
  '42501', 'solo rutas <uuid>.<pdf|jpg|png|webp|stl>');
select pg_temp.expect_error(
  format($$insert into storage.objects (bucket_id, name) values ('patient-documents', %L)$$, pg_temp.v('b') || '/' || pg_temp.v('p1') || '/33333333-3333-4333-8333-333333333333.pdf'),
  '42501', 'la ruta debe ser de la clínica del paciente');
select pg_temp.assert_true(
  (select count(*) = 0 from storage.objects where bucket_id = 'patient-documents'),
  'nadie lee el bucket directo (ni quien subió el archivo)');

select set_config('doc.d1', (public.register_document(pg_temp.v('p1'), 'radiografia', 'Panorámica', pg_temp.path('p1', '11111111-1111-4111-8111-111111111111.jpg'))).id::text, true);
select pg_temp.expect_error(
  format($$select public.register_document(%L, 'foto', 'Fantasma', %L)$$, pg_temp.v('p1'), pg_temp.path('p1', '44444444-4444-4444-8444-444444444444.jpg')),
  'P0002', 'no se registra un archivo que no se subió');
select pg_temp.expect_error(
  format($$select public.register_document(%L, 'foto', 'Ruta ajena', %L)$$, pg_temp.v('p1'), pg_temp.path('p2', '11111111-1111-4111-8111-111111111111.jpg')),
  '22023', 'no se registra un archivo de otro paciente');

select pg_temp.logout();
select pg_temp.assert_true(
  (select mime = 'image/jpeg' and size_bytes = 2048 and retain_until >= current_date + interval '5 years' - interval '1 day'
   from public.patient_documents where id = pg_temp.v('d1')),
  'guarda tipo, tamaño y retención de 5 años desde Storage');

-- ------------------------------------------------------- ver y bitácora -------
select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(
  (public.authorize_document_access(pg_temp.v('d1'), 'view') ->> 'storage_path') = pg_temp.path('p1', '11111111-1111-4111-8111-111111111111.jpg'),
  'el doctor tratante obtiene la ruta para firmar');
select public.authorize_document_access(pg_temp.v('d1'), 'download');
select pg_temp.assert_true((select count(*) = 0 from public.document_access_log), 'un doctor no ve la bitácora');

select pg_temp.login_as('doctor2_a');
select pg_temp.assert_true((select count(*) = 0 from public.patient_documents), 'otro doctor no ve los documentos de un paciente ajeno');
select pg_temp.expect_error(format($$select public.authorize_document_access(%L, 'view')$$, pg_temp.v('d1')), 'P0002', 'otro doctor no abre el documento');

select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.authorize_document_access(%L, 'view')$$, pg_temp.v('d1')), 'P0002', 'otra clínica no abre el documento');
select pg_temp.login_as('super');
select pg_temp.assert_true((select count(*) = 0 from public.patient_documents), 'el superadmin NO ve documentos');
select pg_temp.expect_error(format($$select public.authorize_document_access(%L, 'view')$$, pg_temp.v('d1')), 'P0002', 'el superadmin NO abre documentos');

select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  (select array_agg(action order by id) = array['upload', 'view', 'download'] from public.document_access_log where document_id = pg_temp.v('d1')),
  'la bitácora registra subir, ver y descargar');
select pg_temp.assert_true(
  (select bool_and(actor_id = pg_temp.uid('doctor_a')) from public.document_access_log where document_id = pg_temp.v('d1')),
  'con quién lo hizo');
select pg_temp.expect_error(format($$select public.authorize_document_access(%L, 'borrar')$$, pg_temp.v('d1')), '22023', 'solo ver o descargar');

-- ------------------------------------------------------- no se borra ----------
select set_config('storage.allow_delete_query', 'true', true);
select pg_temp.assert_true(
  pg_temp.rows($$delete from storage.objects where bucket_id = 'patient-documents'$$) = 0,
  'nadie borra archivos de pacientes desde la app');
select pg_temp.expect_error(format($$delete from public.patient_documents where id = %L$$, pg_temp.v('d1')), '42501', 'sin DELETE en documentos');
select pg_temp.expect_error(format($$update public.patient_documents set name = 'x' where id = %L$$, pg_temp.v('d1')), '42501', 'sin UPDATE directo');

select pg_temp.login_as('doctor_a');
select pg_temp.expect_error(format($$select public.set_document_archived(%L, true)$$, pg_temp.v('d1')), '42501', 'un doctor no archiva');
select pg_temp.login_as('reception_a');
select public.set_document_archived(pg_temp.v('d1'), true);
select pg_temp.assert_true((select archived_at is not null from public.patient_documents where id = pg_temp.v('d1')), 'recepción archiva');

select pg_temp.logout();
select 'documentos: todas las pruebas pasaron' as resultado;

rollback;
