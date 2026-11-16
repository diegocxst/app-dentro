-- =============================================================================
-- PRUEBAS · 20261116000700_appointments
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
    when 'owner_a' then 'e1' when 'reception_a' then 'e2' when 'doctor_a' then 'e3' when 'doctor2_a' then 'e4'
    when 'owner_b' then 'e5' when 'super' then 'e6' end)::uuid;
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('ag.' || k)::uuid $$;
-- Lunes de la semana próxima (siempre en el futuro) + días, a la hora local de la zona.
create function pg_temp.at(p_day int, p_hhmm text, p_tz text default 'America/Mexico_City') returns timestamptz language sql stable as $$
  select ((current_date + (8 - extract(isodow from current_date)::int) + p_day)::timestamp + p_hhmm::time) at time zone p_tz
$$;
create function pg_temp.cita(p_patient text, p_doctor text, p_chair text, p_day int, p_from text, p_to text) returns uuid language sql as $$
  select (public.create_appointment(pg_temp.v(p_patient), pg_temp.v(p_doctor), pg_temp.v('branch'), pg_temp.v(p_chair),
    pg_temp.at(p_day, p_from), pg_temp.at(p_day, p_to), 'tratamiento')).id
$$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true((select relrowsecurity from pg_class where oid = 'public.appointments'::regclass), 'RLS habilitada en citas');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.ag@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba agenda');

select pg_temp.login_as('owner_a');
select set_config('ag.a', (public.create_tenant('Clínica Agenda A', 'clinic', 'ag-test-a')).id::text, true);
select set_config('ag.branch', (select id::text from public.branches where tenant_id = pg_temp.v('a')), true);
select pg_temp.assert_true((select timezone = 'America/Mexico_City' from public.branches where id = pg_temp.v('branch')), 'zona por defecto: Ciudad de México');
-- Lunes a sábado de 9 a 14; domingo cerrado.
select public.set_branch_hours(pg_temp.v('branch'),
  '{"mon":[["09:00","14:00"]],"tue":[["09:00","14:00"]],"wed":[["09:00","14:00"]],"thu":[["09:00","14:00"]],"fri":[["09:00","14:00"]],"sat":[["09:00","14:00"]]}');
select set_config('ag.c1', (public.create_chair(pg_temp.v('branch'), 'Sillón 1')).id::text, true);
select set_config('ag.c2', (public.create_chair(pg_temp.v('branch'), 'Sillón 2')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('ag.b', (public.create_tenant('Clínica Agenda B', 'clinic', 'ag-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor');
select set_config('ag.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);
select set_config('ag.d2', (select id::text from public.memberships where user_id = pg_temp.uid('doctor2_a')), true);
select set_config('ag.m_rec', (select id::text from public.memberships where user_id = pg_temp.uid('reception_a')), true);

select pg_temp.login_as('reception_a');
select set_config('ag.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Agenda Uno', 'papel', p_primary_doctor => pg_temp.v('d1'))).id::text, true);
select set_config('ag.p2', (public.create_patient(pg_temp.v('a'), 'Paciente Agenda Dos', 'papel')).id::text, true);

-- ------------------------------------------------------------- agendar -------
select set_config('ag.x1', pg_temp.cita('p1', 'd1', 'c1', 0, '10:00', '11:00')::text, true);
select pg_temp.assert_true((select status = 'programada' and created_by = pg_temp.uid('reception_a') from public.appointments where id = pg_temp.v('x1')), 'recepción agenda; nace programada');
select pg_temp.expect_error($$select pg_temp.cita('p2', 'd2', 'c1', 0, '10:30', '11:30')$$, '23P01', 'no se traslapa el mismo sillón');
select pg_temp.expect_error($$select pg_temp.cita('p2', 'd1', 'c2', 0, '10:30', '11:30')$$, '23P01', 'no se traslapa el mismo doctor');
select pg_temp.cita('p2', 'd2', 'c1', 0, '11:00', '12:00');
select pg_temp.expect_error($$select pg_temp.cita('p2', 'd2', 'c2', 0, '13:30', '14:30')$$, 'DH001', 'no se agenda fuera del horario');
select pg_temp.expect_error($$select pg_temp.cita('p2', 'd2', 'c2', 6, '10:00', '11:00')$$, 'DH001', 'no se agenda en un día cerrado');
select pg_temp.expect_error($$select pg_temp.cita('p2', 'd2', 'c2', 0, '08:00', '09:30')$$, 'DH001', 'no empieza antes de abrir');
select pg_temp.expect_error(format($$select public.create_appointment(%L, %L, %L, %L, now() - interval '3 days', now() - interval '3 days' + interval '1 hour')$$,
  pg_temp.v('p2'), pg_temp.v('d2'), pg_temp.v('branch'), pg_temp.v('c2')), '22023', 'no se agenda en el pasado');
select pg_temp.expect_error(format($$select public.create_appointment(%L, %L, %L, %L, %L, %L)$$,
  pg_temp.v('p2'), pg_temp.v('m_rec'), pg_temp.v('branch'), pg_temp.v('c2'), pg_temp.at(1, '10:00'), pg_temp.at(1, '11:00')), '22023', 'recepción no es doctor');

-- Zona horaria: en Tijuana las 9:00 locales son las 11:00 de CDMX (en invierno).
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.set_branch_timezone(%L, 'America/Tijuana')$$, pg_temp.v('branch')), '42501', 'recepción no cambia la zona');
select pg_temp.login_as('owner_a');
select public.set_branch_timezone(pg_temp.v('branch'), 'America/Tijuana');
select pg_temp.expect_error(format($$select public.set_branch_timezone(%L, 'Europe/Madrid')$$, pg_temp.v('branch')), '23514', 'solo zonas de México');
select public.create_appointment(pg_temp.v('p2'), pg_temp.v('d2'), pg_temp.v('branch'), pg_temp.v('c2'),
  pg_temp.at(2, '09:00', 'America/Tijuana'), pg_temp.at(2, '10:00', 'America/Tijuana'));
select pg_temp.expect_error(format($$select public.create_appointment(%L, %L, %L, %L, %L, %L)$$,
  pg_temp.v('p2'), pg_temp.v('d2'), pg_temp.v('branch'), pg_temp.v('c2'), pg_temp.at(2, '13:30', 'America/Tijuana'), pg_temp.at(2, '14:30', 'America/Tijuana')),
  'DH001', 'el horario se lee en la zona de la sucursal');
select public.set_branch_timezone(pg_temp.v('branch'), 'America/Mexico_City');

-- ------------------------------------------------------------- doctores ------
select pg_temp.login_as('doctor_a');
select set_config('ag.x2', pg_temp.cita('p1', 'd1', 'c2', 1, '10:00', '11:00')::text, true);
select pg_temp.expect_error($$select pg_temp.cita('p1', 'd2', 'c2', 1, '12:00', '13:00')$$, '42501', 'un doctor no agenda en la agenda de otro');
select pg_temp.expect_error($$select pg_temp.cita('p2', 'd1', 'c2', 1, '12:00', '13:00')$$, 'P0002', 'un doctor no agenda a pacientes que no son suyos');
select pg_temp.assert_true((select count(*) = 2 and bool_and(doctor_id = pg_temp.v('d1')) from public.appointments), 'el doctor ve solo sus citas');
select pg_temp.assert_true((select count(*) = 2 from public.list_appointments(pg_temp.at(-1, '00:00'), pg_temp.at(7, '00:00'), pg_temp.v('branch'))), 'list_appointments también filtra');

select pg_temp.login_as('doctor2_a');
select pg_temp.assert_true((select count(*) = 0 from public.appointments where doctor_id = pg_temp.v('d1')), 'otro doctor no ve citas ajenas');
select pg_temp.expect_error(format($$select public.set_appointment_status(%L, 'cancelada')$$, pg_temp.v('x1')), 'P0002', 'otro doctor no cancela citas ajenas');

select pg_temp.login_as('owner_b');
select pg_temp.assert_true((select count(*) = 0 from public.appointments), 'otra clínica no ve citas');
select pg_temp.assert_true((select count(*) = 0 from public.list_appointments(pg_temp.at(-1, '00:00'), pg_temp.at(7, '00:00'), pg_temp.v('branch'))), 'otra clínica no lista citas');
select pg_temp.expect_error($$select pg_temp.cita('p1', 'd1', 'c1', 3, '10:00', '11:00')$$, '42501', 'otra clínica no agenda');

select pg_temp.login_as('super');
select pg_temp.assert_true((select count(*) = 0 from public.appointments), 'el superadmin no ve citas');

-- ------------------------------------------------------------- estados -------
select pg_temp.login_as('reception_a');
select pg_temp.assert_true((select count(*) = 4 from public.appointments), 'recepción ve todas las citas de su sucursal');
select public.set_appointment_status(pg_temp.v('x1'), 'confirmada');
select pg_temp.expect_error(format($$select public.set_appointment_status(%L, 'llego')$$, pg_temp.v('x1')), '22023', 'no se marca «llegó» días antes');
select public.update_appointment(pg_temp.v('x1'), pg_temp.v('d1'), pg_temp.v('branch'), pg_temp.v('c1'), pg_temp.at(3, '09:00'), pg_temp.at(3, '10:00'), 'tratamiento');
select pg_temp.assert_true((select status = 'programada' from public.appointments where id = pg_temp.v('x1')), 'reagendar vuelve a «programada»');
select public.set_appointment_status(pg_temp.v('x1'), 'cancelada', 'El paciente avisó');
select pg_temp.expect_error(format($$select public.set_appointment_status(%L, 'confirmada')$$, pg_temp.v('x1')), '22023', 'cancelada es final');
select pg_temp.expect_error(format($$select public.update_appointment(%L, %L, %L, %L, %L, %L, 'tratamiento')$$,
  pg_temp.v('x1'), pg_temp.v('d1'), pg_temp.v('branch'), pg_temp.v('c1'), pg_temp.at(3, '11:00'), pg_temp.at(3, '12:00')), '22023', 'una cancelada no se mueve');
select pg_temp.cita('p1', 'd1', 'c1', 3, '09:00', '10:00');
select pg_temp.assert_true(true, 'una cita cancelada libera el lugar');

-- Sin escritura directa.
select pg_temp.expect_error(format($$update public.appointments set status = 'confirmada' where id = %L$$, pg_temp.v('x2')), '42501', 'sin UPDATE directo');
select pg_temp.expect_error(format($$delete from public.appointments where id = %L$$, pg_temp.v('x2')), '42501', 'sin DELETE');
select pg_temp.expect_error(format($$insert into public.appointments (tenant_id, branch_id, chair_id, doctor_id, patient_id, starts_at, ends_at)
  values (%L, %L, %L, %L, %L, now(), now() + interval '1 hour')$$, pg_temp.v('a'), pg_temp.v('branch'), pg_temp.v('c1'), pg_temp.v('d1'), pg_temp.v('p1')), '42501', 'sin INSERT directo');

-- Auditoría (la lee la gerencia).
select pg_temp.login_as('owner_a');
select pg_temp.assert_true((select count(*) = 1 from public.audit_logs where action = 'appointment.rescheduled' and entity_id = pg_temp.v('x1')::text), 'reagendar queda en la auditoría');
select pg_temp.assert_true(
  (select count(*) >= 5 and bool_and(details - 'kind' - 'status' = '{}'::jsonb) from public.audit_logs where entity = 'appointment'),
  'auditoría sin datos del paciente');

-- Sucursales por membresía: recepción asignada a otra sucursal ya no agenda aquí.
select set_config('ag.branch2', (public.create_branch(pg_temp.v('a'), 'Sucursal Norte')).id::text, true);
select public.set_membership_branches(pg_temp.v('m_rec'), array[pg_temp.v('branch2')]);
select pg_temp.login_as('reception_a');
select pg_temp.expect_error($$select pg_temp.cita('p2', 'd2', 'c2', 4, '10:00', '11:00')$$, '42501', 'respeta las sucursales de la membresía');
select pg_temp.assert_true((select count(*) = 0 from public.appointments), 'y deja de ver las citas de esa sucursal');

select pg_temp.logout();
select 'agenda: todas las pruebas pasaron' as resultado;

rollback;
