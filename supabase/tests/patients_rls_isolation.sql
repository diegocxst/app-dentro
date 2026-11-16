-- =============================================================================
-- PRUEBAS · 20261116000400_patients (DATOS DE SALUD)
-- Local: `npm run test:db`. Dev: pegar en el SQL Editor. Termina en ROLLBACK.
-- Actores: owner_a, reception_a, doctor_a (Dr. 1), collab_a (Dr. 2), owner_b, superadmin.
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
    when 'owner_a' then 'b1' when 'reception_a' then 'b2' when 'doctor_a' then 'b3' when 'collab_a' then 'b4'
    when 'owner_b' then 'b5' when 'super' then 'b6' end)::uuid;
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('pat.' || k)::uuid $$;
create function pg_temp.n_patients() returns bigint language sql stable as $$
  select count(*) from public.patients where tenant_id in (current_setting('pat.a')::uuid, current_setting('pat.b')::uuid);
$$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.patients'::regclass, 'public.patient_consents'::regclass, 'public.patient_notes'::regclass, 'public.patient_access_log'::regclass)),
  'RLS habilitada en las 4 tablas de pacientes');
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.patient_notes', 'SELECT')
  and not has_table_privilege('authenticated', 'public.patient_consents', 'SELECT'),
  'notas y consentimientos no se leen directo (solo con open_patient, que registra el acceso)');
select pg_temp.assert_true(
  not exists (select 1 from pg_policies where tablename in ('patients', 'patient_notes', 'patient_consents', 'patient_access_log') and qual like '%is_platform_admin%'),
  'ninguna política de pacientes deja entrar al superadmin');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.pat@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', k || ' Prueba'), now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'collab_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba pacientes');

select pg_temp.login_as('owner_a');
select set_config('pat.a', (public.create_tenant('Clínica Pacientes A', 'clinic', 'pat-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('pat.b', (public.create_tenant('Clínica Pacientes B', 'clinic', 'pat-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('collab_a'), 'doctor_collab');
select set_config('pat.m_doctor', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);
select set_config('pat.m_collab', (select id::text from public.memberships where user_id = pg_temp.uid('collab_a')), true);
select set_config('pat.m_owner_b', (select id::text from public.memberships where user_id = pg_temp.uid('owner_b')), true);
select set_config('pat.m_reception', (select id::text from public.memberships where user_id = pg_temp.uid('reception_a')), true);

-- ------------------------------------------------------------------ alta ------
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.create_patient(%L, 'Sin Consentimiento', null)$$, pg_temp.v('a')),
  '22023', 'no hay alta sin consentimiento');
select pg_temp.expect_error(format($$select public.create_patient(%L, 'Doctor Ajeno', 'papel', p_primary_doctor => %L)$$, pg_temp.v('a'), pg_temp.v('m_owner_b')),
  '22023', 'el doctor tratante debe ser de la misma clínica');
select pg_temp.expect_error(format($$select public.create_patient(%L, 'Recepción Doctora', 'papel', p_primary_doctor => %L)$$, pg_temp.v('a'), pg_temp.v('m_reception')),
  '22023', 'recepción no puede ser doctor tratante');
select set_config('pat.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Uno Prueba', 'papel',
  p_birth_date => '1990-05-01', p_phone_e164 => '+525511111111', p_email => ' Uno@Example.TEST ',
  p_source => 'referido', p_primary_doctor => pg_temp.v('m_doctor'), p_tags => array['ortodoncia', ' ortodoncia ', ''])).id::text, true);
select set_config('pat.p2', (public.create_patient(pg_temp.v('a'), 'Paciente Dos Prueba', 'digital', p_primary_doctor => pg_temp.v('m_collab'))).id::text, true);
select set_config('pat.p3', (public.create_patient(pg_temp.v('a'), 'Paciente Tres Prueba', 'papel')).id::text, true);

select pg_temp.logout();
select pg_temp.expect_error(format($$insert into public.patients (tenant_id, full_name, primary_doctor_id) values (%L, 'Cruzado', %L)$$, pg_temp.v('a'), pg_temp.v('m_owner_b')),
  '23503', 'FK compuesta: aunque se escriba directo, el doctor debe ser de la misma clínica');
select pg_temp.assert_true(
  (select email = 'uno@example.test' and tags = array['ortodoncia'] from public.patients where id = pg_temp.v('p1')),
  'normaliza el correo y las etiquetas');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(method = 'papel' and notice_version = 'clinica-borrador-2026-11') from public.patient_consents where patient_id = pg_temp.v('p1')),
  'guarda el consentimiento con la versión del aviso de la clínica');
select pg_temp.assert_true(
  (select details::text not like '%Prueba%' and details::text not like '%@%' from public.audit_logs where action = 'patient.created' and entity_id = pg_temp.v('p1')::text),
  'la auditoría no guarda datos del paciente');

-- -------------------------------------------------------- quién ve a quién ----
select pg_temp.login_as('reception_a');
select pg_temp.assert_true(pg_temp.n_patients() = 3, 'recepción ve a los 3 pacientes de su clínica');
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(pg_temp.n_patients() = 3, 'la propietaria ve a los 3');
select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(pg_temp.n_patients() = 1 and (select id from public.patients) = pg_temp.v('p1'), 'el doctor ve solo a su paciente');
select pg_temp.expect_error(format($$select public.open_patient(%L)$$, pg_temp.v('p2')), 'P0002', 'el doctor no abre la ficha de un paciente ajeno');
select pg_temp.expect_error(format($$select public.add_patient_note(%L, 'intruso')$$, pg_temp.v('p3')), 'P0002', 'el doctor no escribe notas en pacientes ajenos');
select pg_temp.login_as('collab_a');
select pg_temp.assert_true(pg_temp.n_patients() = 1 and (select id from public.patients) = pg_temp.v('p2'), 'el colaborador ve solo a su paciente');
select pg_temp.login_as('owner_b');
select pg_temp.assert_true(pg_temp.n_patients() = 0, 'otra clínica no ve pacientes de A');
select pg_temp.expect_error(format($$select public.open_patient(%L)$$, pg_temp.v('p1')), 'P0002', 'otra clínica no abre fichas de A');
select pg_temp.login_as('super');
select pg_temp.assert_true(pg_temp.n_patients() = 0, 'el superadmin NO ve pacientes');
select pg_temp.expect_error(format($$select public.open_patient(%L)$$, pg_temp.v('p1')), 'P0002', 'el superadmin NO abre fichas');
select pg_temp.assert_true((select count(*) = 0 from public.patient_access_log), 'el superadmin no ve la bitácora');

-- ------------------------------------------------------ ficha y bitácora ------
select pg_temp.login_as('doctor_a');
select public.add_patient_note(pg_temp.v('p1'), 'Le preocupa el precio');
select pg_temp.assert_true(
  (select (public.open_patient(pg_temp.v('p1')) -> 'notes' -> 0 ->> 'body') = 'Le preocupa el precio'),
  'open_patient devuelve las notas');
select pg_temp.expect_error($$select count(*) from public.patient_notes$$, '42501', 'las notas no se leen directo');
select pg_temp.assert_true(pg_temp.n_patients() = 1, 'sigue viendo solo a su paciente');
select pg_temp.assert_true((select count(*) = 0 from public.patient_access_log), 'un doctor no ve la bitácora');

select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  (select count(*) = 1 from public.patient_access_log where patient_id = pg_temp.v('p1') and actor_id = pg_temp.uid('doctor_a') and action = 'view'),
  'abrir la ficha queda en la bitácora con quién la abrió');
select pg_temp.assert_true(
  (select count(*) >= 1 from public.patient_access_log where patient_id = pg_temp.v('p1') and action = 'note'),
  'escribir una nota queda en la bitácora');

-- -------------------------------------------------------------- edición -------
select pg_temp.login_as('doctor_a');
select public.update_patient(pg_temp.v('p1'), p_phone_e164 => '', p_tags => array['implantes']);
select pg_temp.assert_true((select phone_e164 is null and tags = array['implantes'] from public.patients where id = pg_temp.v('p1')), 'el doctor edita a su paciente');
select pg_temp.expect_error(format($$select public.update_patient(%L, p_primary_doctor => %L)$$, pg_temp.v('p1'), pg_temp.v('m_collab')),
  '42501', 'el doctor no cambia el doctor tratante');
select pg_temp.expect_error(format($$select public.set_patient_archived(%L, true)$$, pg_temp.v('p1')), '42501', 'el doctor no archiva');
select pg_temp.expect_error(format($$update public.patients set full_name = 'X' where id = %L$$, pg_temp.v('p1')), '42501', 'sin UPDATE directo');
select pg_temp.expect_error(format($$delete from public.patients where id = %L$$, pg_temp.v('p1')), '42501', 'sin DELETE: los pacientes no se borran');

select pg_temp.login_as('reception_a');
select public.update_patient(pg_temp.v('p1'), p_primary_doctor => pg_temp.v('m_collab')::text);
select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(pg_temp.n_patients() = 0, 'al cambiar de doctor tratante, el anterior deja de verlo');
select pg_temp.login_as('collab_a');
select pg_temp.assert_true(pg_temp.n_patients() = 2, 'y el nuevo doctor lo ve');

select pg_temp.login_as('reception_a');
select public.set_patient_archived(pg_temp.v('p3'), true);
select pg_temp.assert_true((select archived_at is not null from public.patients where id = pg_temp.v('p3')), 'recepción archiva');
select public.set_patient_archived(pg_temp.v('p3'), false);
select pg_temp.assert_true((select archived_at is null from public.patients where id = pg_temp.v('p3')), 'y reactiva');

-- ----------------------------------------------- doctor da de alta (es su paciente)
select pg_temp.login_as('doctor_a');
select set_config('pat.p4', (public.create_patient(pg_temp.v('a'), 'Paciente Cuatro Prueba', 'papel', p_primary_doctor => pg_temp.v('m_collab'))).id::text, true);
select pg_temp.assert_true((select primary_doctor_id = pg_temp.v('m_doctor') from public.patients where id = pg_temp.v('p4')),
  'si un doctor da de alta, queda como doctor tratante (no puede asignarlo a otro)');

-- ------------------------------------------------------- clínica suspendida ---
select pg_temp.login_as('super');
select public.admin_set_tenant_status(pg_temp.v('a'), 'suspended', 'Prueba de pacientes suspendida');
select pg_temp.login_as('reception_a');
select pg_temp.assert_true(pg_temp.n_patients() = 4, 'suspendida: recepción sigue leyendo');
select pg_temp.expect_error(format($$select public.add_patient_note(%L, 'x')$$, pg_temp.v('p1')), '42501', 'suspendida: no se escribe');
select pg_temp.expect_error(format($$select public.create_patient(%L, 'Nuevo Suspendido', 'papel')$$, pg_temp.v('a')), '42501', 'suspendida: no se dan de alta pacientes');

select pg_temp.logout();
select 'pacientes: todas las pruebas pasaron' as resultado;

rollback;
