-- =============================================================================
-- PRUEBAS · 20261116000900_lead_conversion
-- Local: `npm run test:db`. Dev: se corre con `db query --remote`. Termina en ROLLBACK.
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
    when 'owner_a' then 'a1' when 'reception_a' then 'a2' when 'doctor_a' then 'a3' when 'doctor2_a' then 'a4'
    when 'owner_b' then 'a5' when 'super' then 'a6' end)::uuid;
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('lc.' || k)::uuid $$;
-- Lunes de la semana próxima (siempre en el futuro) + días, a la hora local de la zona.
create function pg_temp.at(p_day int, p_hhmm text, p_tz text default 'America/Mexico_City') returns timestamptz language sql stable as $$
  select ((current_date + (8 - extract(isodow from current_date)::int) + p_day)::timestamp + p_hhmm::time) at time zone p_tz
$$;
create function pg_temp.val(p_lead text, p_doctor text, p_chair text, p_day int, p_from text, p_to text) returns uuid language sql as $$
  select (public.create_lead_appointment(pg_temp.v(p_lead), pg_temp.v(p_doctor), pg_temp.v('branch'), pg_temp.v(p_chair),
    pg_temp.at(p_day, p_from), pg_temp.at(p_day, p_to))).id
$$;

-- ---------------------------------------------------------------- entorno ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.lc@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba conversión');

select pg_temp.login_as('owner_a');
select set_config('lc.a', (public.create_tenant('Clínica Conversión A', 'clinic', 'lc-test-a')).id::text, true);
select set_config('lc.branch', (select id::text from public.branches where tenant_id = pg_temp.v('a')), true);
select public.set_branch_hours(pg_temp.v('branch'),
  '{"mon":[["09:00","14:00"]],"tue":[["09:00","14:00"]],"wed":[["09:00","14:00"]],"thu":[["09:00","14:00"]],"fri":[["09:00","14:00"]],"sat":[["09:00","14:00"]]}');
select set_config('lc.c1', (public.create_chair(pg_temp.v('branch'), 'Sillón 1')).id::text, true);
select set_config('lc.c2', (public.create_chair(pg_temp.v('branch'), 'Sillón 2')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('lc.b', (public.create_tenant('Clínica Conversión B', 'clinic', 'lc-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor');
select set_config('lc.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);

select pg_temp.login_as('reception_a');
select set_config('lc.l1', (public.create_lead(pg_temp.v('a'), 'Lead Conversión Uno', true, '+525512340001', p_source => 'meta')).id::text, true);
select set_config('lc.l2', (public.create_lead(pg_temp.v('a'), 'Lead Duplicado', true, '+525512340002')).id::text, true);
select set_config('lc.l3', (public.create_lead(pg_temp.v('a'), 'Lead Perdido', true, '+525512340003')).id::text, true);
select public.set_lead_status(pg_temp.v('l3'), 'perdido', 'No contestó');
select set_config('lc.p0', (public.create_patient(pg_temp.v('a'), 'Paciente Existente', 'papel', p_phone_e164 => '+525512340002')).id::text, true);

-- ------------------------------------------------------------- valoración ----
select set_config('lc.x1', pg_temp.val('l1', 'd1', 'c1', 0, '10:00', '11:00')::text, true);
select pg_temp.assert_true(
  (select patient_id is null and lead_id = pg_temp.v('l1') and kind = 'valoracion' from public.appointments where id = pg_temp.v('x1')),
  'la valoración es del lead, sin crear paciente');
select pg_temp.assert_true(
  (select status = 'valoracion' and first_response_at is not null from public.leads where id = pg_temp.v('l1')),
  'agendar pasa el lead a «Valoración agendada»');
select pg_temp.assert_true((select count(*) = 1 from public.lead_activity where lead_id = pg_temp.v('l1') and kind = 'appointment'), 'queda en el historial del lead');
select pg_temp.expect_error($$select pg_temp.val('l2', 'd1', 'c2', 0, '10:30', '11:30')$$, '23P01', 'sigue sin traslapes del doctor');
select pg_temp.expect_error($$select pg_temp.val('l2', 'd1', 'c2', 6, '10:00', '11:00')$$, 'DH001', 'sigue sin agendar fuera de horario');
select pg_temp.expect_error($$select pg_temp.val('l3', 'd1', 'c2', 1, '10:00', '11:00')$$, '22023', 'un lead perdido no se agenda');

select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(patient_name = 'Lead Conversión Uno' and patient_phone = '+525512340001')
   from public.list_appointments(pg_temp.at(-1, '00:00'), pg_temp.at(7, '00:00'), pg_temp.v('branch'))),
  'el doctor ve la valoración en su agenda con el nombre del lead');
select pg_temp.assert_true(pg_temp.rows('select * from public.leads') = 0, 'pero no ve el Kanban de leads');
select pg_temp.expect_error($$select pg_temp.val('l2', 'd1', 'c2', 1, '10:00', '11:00')$$, 'P0002', 'un doctor no agenda valoraciones de leads');
select pg_temp.expect_error(format($$select public.convert_lead(%L, 'papel')$$, pg_temp.v('l1')), 'P0002', 'un doctor no convierte leads');

select pg_temp.login_as('doctor2_a');
select pg_temp.assert_true(pg_temp.rows('select * from public.appointments') = 0, 'otro doctor no ve la valoración');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.convert_lead(%L, 'papel')$$, pg_temp.v('l1')), 'P0002', 'otra clínica no convierte');
select pg_temp.expect_error(format($$select * from public.lead_patient_matches(%L)$$, pg_temp.v('l2')), 'P0002', 'otra clínica no busca coincidencias');
select pg_temp.login_as('super');
select pg_temp.expect_error(format($$select public.convert_lead(%L, 'papel')$$, pg_temp.v('l1')), 'P0002', 'el superadmin no convierte');

-- Las reglas de la tabla protegen aunque se escriba como dueño de la base.
select pg_temp.logout();
select pg_temp.expect_error(format($$update public.appointments set patient_id = %L where id = %L$$, pg_temp.v('p0'), pg_temp.v('x1')), '23514', 'CHECK: paciente o lead, no ambos');
select pg_temp.expect_error(format($$update public.appointments set kind = 'tratamiento' where id = %L$$, pg_temp.v('x1')), '23514', 'CHECK: la cita de un lead es de valoración');

-- ------------------------------------------------------------- convertir -----
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.convert_lead(%L)$$, pg_temp.v('l1')), '22023', 'convertir exige el consentimiento');
select set_config('lc.p1', (public.convert_lead(pg_temp.v('l1'), 'digital', p_primary_doctor => pg_temp.v('d1'))).id::text, true);
select pg_temp.assert_true(
  (select full_name = 'Lead Conversión Uno' and phone_e164 = '+525512340001' and source = 'meta' and primary_doctor_id = pg_temp.v('d1')
   from public.patients where id = pg_temp.v('p1')),
  'crea el paciente con los datos y el origen del lead');
select pg_temp.logout(); -- los consentimientos no se leen directo (solo con open_patient)
select pg_temp.assert_true(
  (select count(*) = 1 from public.patient_consents where patient_id = pg_temp.v('p1') and method = 'digital' and notice_version = 'clinica-borrador-2026-11'),
  'con su consentimiento y la versión del aviso');
select pg_temp.login_as('reception_a');
select pg_temp.assert_true(
  (select patient_id = pg_temp.v('p1') and lead_id is null from public.appointments where id = pg_temp.v('x1')),
  'la valoración pasa a la ficha del paciente');
select pg_temp.assert_true(
  (select status = 'convertido' and converted_patient_id = pg_temp.v('p1') from public.leads where id = pg_temp.v('l1')),
  'el lead queda «Convertido» con el enlace a su ficha');
select pg_temp.expect_error(format($$select public.convert_lead(%L, 'papel')$$, pg_temp.v('l1')), '22023', 'no se convierte dos veces');

-- Vincular con un paciente que ya existe (mismo teléfono): sin duplicar.
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(id = pg_temp.v('p0')) from public.lead_patient_matches(pg_temp.v('l2'))),
  'encuentra al paciente con el mismo teléfono');
select set_config('lc.n', (select count(*)::text from public.patients), true);
select public.convert_lead(pg_temp.v('l2'), p_patient => pg_temp.v('p0'));
select pg_temp.assert_true((select count(*)::text = current_setting('lc.n') from public.patients), 'vincular no crea otro paciente');
select pg_temp.assert_true((select converted_patient_id = pg_temp.v('p0') from public.leads where id = pg_temp.v('l2')), 'el lead apunta al paciente existente');

select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(patient_name = 'Lead Conversión Uno') from public.list_appointments(pg_temp.at(-1, '00:00'), pg_temp.at(7, '00:00'), p_patient => pg_temp.v('p1'))),
  'el doctor tratante ve la cita en la ficha del nuevo paciente');

select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  (select bool_and(details - 'kind' - 'source' - 'status' - 'linked_existing' = '{}'::jsonb) from public.audit_logs where entity in ('lead', 'appointment', 'patient')),
  'auditoría sin datos personales');

select pg_temp.logout();
select 'conversión: todas las pruebas pasaron' as resultado;

rollback;
