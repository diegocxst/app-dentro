-- =============================================================================
-- PRUEBAS · 20261124000200_intern_role + 20261124000300_doctor_schedule
-- (horario del doctor y permisos del pasante)
-- Local: `npm run test:db`. Dev: `npx supabase db query --remote --yes -f <este archivo>`.
-- Actores: owner_a, reception_a, doctor_a, doctor2_a, owner_b, super y el pasante intern_a.
-- Termina en ROLLBACK.
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
    when 'owner_a' then 'c1' when 'reception_a' then 'c2' when 'doctor_a' then 'c3' when 'doctor2_a' then 'c4'
    when 'owner_b' then 'c5' when 'super' then 'c6' when 'intern_a' then 'c7' end)::uuid;
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('hs.' || k)::uuid $$;
-- Lunes de la semana próxima (siempre en el futuro) + días, a la hora local.
create function pg_temp.at(p_day int, p_hhmm text) returns timestamptz language sql stable as $$
  select ((current_date + (8 - extract(isodow from current_date)::int) + p_day)::timestamp + p_hhmm::time) at time zone 'America/Mexico_City'
$$;
create function pg_temp.cita(p_patient text, p_doctor text, p_chair text, p_day int, p_from text, p_to text) returns uuid language sql as $$
  select (public.create_appointment(pg_temp.v(p_patient), pg_temp.v(p_doctor), pg_temp.v('branch'), pg_temp.v(p_chair),
    pg_temp.at(p_day, p_from), pg_temp.at(p_day, p_to), 'tratamiento')).id
$$;
-- Lo que un actor ve de una tabla (cuenta de filas con RLS).
create function pg_temp.seen(k text, p_sql text) returns int language plpgsql as $$
declare n int;
begin
  perform pg_temp.login_as(k);
  execute p_sql into n;
  perform pg_temp.logout();
  return n;
end $$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  (select 'doctor_intern' = any (enum_range(null::public.tenant_role)::text[])), 'existe el rol pasante');
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.set_doctor_schedule(uuid,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.set_doctor_schedule(uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.within_doctor_hours(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE'),
  'permisos de las funciones nuevas');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.doctor_settings', 'UPDATE'), 'doctor_settings no se escribe directo');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.hs@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super', 'intern_a']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba horario');

select pg_temp.login_as('owner_a');
select set_config('hs.a', (public.create_tenant('Clínica Horario A', 'clinic', 'hs-test-a')).id::text, true);
select set_config('hs.branch', (select id::text from public.branches where tenant_id = pg_temp.v('a')), true);
-- Sucursal: lunes a sábado de 9 a 19.
select public.set_branch_hours(pg_temp.v('branch'),
  '{"mon":[["09:00","19:00"]],"tue":[["09:00","19:00"]],"wed":[["09:00","19:00"]],"thu":[["09:00","19:00"]],"fri":[["09:00","19:00"]],"sat":[["09:00","19:00"]]}');
select set_config('hs.c1', (public.create_chair(pg_temp.v('branch'), 'Sillón 1')).id::text, true);
select set_config('hs.c2', (public.create_chair(pg_temp.v('branch'), 'Sillón 2')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('hs.b', (public.create_tenant('Clínica Horario B', 'clinic', 'hs-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor_collab'),
  (pg_temp.v('a'), pg_temp.uid('intern_a'), 'reception');
select set_config('hs.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);
select set_config('hs.d2', (select id::text from public.memberships where user_id = pg_temp.uid('doctor2_a')), true);
select set_config('hs.in', (select id::text from public.memberships where user_id = pg_temp.uid('intern_a')), true);
select set_config('hs.own', (select id::text from public.memberships where user_id = pg_temp.uid('owner_a')), true);

-- ------------------------------------------------------------ rol pasante ----
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.update_member_role(%L, 'doctor_intern')$$, pg_temp.v('in')), '42501', 'recepción no asigna roles');
select pg_temp.login_as('owner_a');
select public.update_member_role(pg_temp.v('in'), 'doctor_intern');
select pg_temp.assert_true((select role = 'doctor_intern' from public.memberships where id = pg_temp.v('in')), 'la gerencia asigna el rol pasante');
select set_config('hs.off', (public.create_doctor(pg_temp.v('a'), 'Pasante Sin Acceso', 'doctor_intern')).id::text, true);
select pg_temp.assert_true((select user_id is null and role = 'doctor_intern' from public.memberships where id = pg_temp.v('off')),
  'un pasante puede ser doctor sin acceso');
select pg_temp.expect_error(format($$select public.update_member_role(%L, 'reception')$$, pg_temp.v('off')), '22023',
  'un pasante sin acceso no pasa a recepción');
select pg_temp.assert_true((select status = 'pending' from public.create_invitation(pg_temp.v('a'), 'nuevo.pasante.hs@example.test', 'doctor_intern', '{}')),
  'se invita a un pasante');

-- ----------------------------------------------------- horario del doctor ----
-- Doctor A: lunes 9–14 y 16–19; martes 9–14. Sin miércoles.
select set_config('hs.sched', '{"mon":[["09:00","14:00"],["16:00","19:00"]],"tue":[["09:00","14:00"]]}', true);
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.set_doctor_schedule(%L, %L)$$, pg_temp.v('d1'), current_setting('hs.sched')), '42501', 'recepción no cambia horarios');
select pg_temp.login_as('doctor2_a');
select pg_temp.expect_error(format($$select public.set_doctor_schedule(%L, %L)$$, pg_temp.v('d1'), current_setting('hs.sched')), '42501', 'un doctor no cambia el horario de otro');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.set_doctor_schedule(%L, %L)$$, pg_temp.v('d1'), current_setting('hs.sched')), 'P0002', 'otra clínica no lo ve');
select pg_temp.login_as('super');
select pg_temp.expect_error(format($$select public.set_doctor_schedule(%L, %L)$$, pg_temp.v('d1'), current_setting('hs.sched')), 'P0002', 'el superadmin no cambia horarios');
select pg_temp.login_as('owner_a');
select pg_temp.expect_error(format($$select public.set_doctor_schedule(%L, %L)$$, pg_temp.v('d1'),
  '{"mon":[["09:00","11:00"],["12:00","13:00"],["14:00","15:00"]]}'), '22023', 'hasta dos turnos por día');
select pg_temp.expect_error(format($$select public.set_doctor_schedule(%L, %L)$$, pg_temp.v('d1'),
  '{"mon":[["09:00","14:00"],["13:00","15:00"]]}'), '22023', 'los turnos no se enciman');
select pg_temp.expect_error(format($$select public.set_doctor_schedule(%L, %L)$$, pg_temp.v('d1'), '{"lun":[["09:00","14:00"]]}'), '22023', 'días válidos');
select pg_temp.expect_error(format($$select public.set_doctor_schedule(%L, %L)$$, (select id from public.memberships where user_id = pg_temp.uid('reception_a'))::text,
  current_setting('hs.sched')), '22023', 'recepción no tiene horario de doctor');
select public.set_doctor_schedule(pg_temp.v('d1'), current_setting('hs.sched')::jsonb);
select pg_temp.assert_true((select schedule = current_setting('hs.sched')::jsonb from public.doctor_settings where membership_id = pg_temp.v('d1')),
  'la gerencia guarda el horario');
-- El propio doctor también lo cambia (aquí el pasante).
select pg_temp.login_as('intern_a');
select public.set_doctor_schedule(pg_temp.v('in'), '{"mon":[["09:00","13:00"]]}');
select pg_temp.assert_true((select schedule ->> 'mon' is not null from public.doctor_settings where membership_id = pg_temp.v('in')),
  'el propio doctor cambia su horario');
select pg_temp.logout();
select pg_temp.assert_true(
  (select count(*) = 2 and bool_and(details::text not like '%09:00%') from public.audit_logs
   where tenant_id = pg_temp.v('a') and action = 'membership.schedule_updated'),
  'la auditoría no guarda el horario');

-- Lectura: los compañeros ven el horario; otra clínica no.
select pg_temp.assert_true(pg_temp.seen('reception_a', format($$select count(*) from public.doctor_settings where membership_id = %L and schedule is not null$$, pg_temp.v('d1'))) = 1,
  'recepción ve el horario del doctor');
select pg_temp.assert_true(pg_temp.seen('owner_b', format($$select count(*) from public.doctor_settings where membership_id = %L$$, pg_temp.v('d1'))) = 0,
  'otra clínica no ve el horario');

-- --------------------------------------------- agendar respeta el horario ----
select pg_temp.login_as('reception_a');
select set_config('hs.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Horario Uno', 'papel', p_primary_doctor => pg_temp.v('d1'))).id::text, true);
select set_config('hs.p2', (public.create_patient(pg_temp.v('a'), 'Paciente Horario Dos', 'papel', p_primary_doctor => pg_temp.v('d2'))).id::text, true);
select pg_temp.cita('p1', 'd1', 'c1', 0, '10:00', '11:00');
select pg_temp.cita('p1', 'd1', 'c1', 0, '16:00', '17:00');
select pg_temp.expect_error($$select pg_temp.cita('p1', 'd1', 'c1', 0, '14:30', '15:30')$$, 'DH002', 'no se agenda en el descanso del doctor');
select pg_temp.expect_error($$select pg_temp.cita('p1', 'd1', 'c1', 0, '13:30', '14:30')$$, 'DH002', 'ni a caballo entre turno y descanso');
select pg_temp.expect_error($$select pg_temp.cita('p1', 'd1', 'c1', 2, '10:00', '11:00')$$, 'DH002', 'ni el día que no trabaja');
select pg_temp.expect_error($$select pg_temp.cita('p1', 'd1', 'c1', 0, '18:30', '19:30')$$, 'DH001', 'el horario de la sucursal se revisa primero');
-- Sin horario propio solo manda la sucursal.
select pg_temp.cita('p2', 'd2', 'c2', 0, '14:30', '15:30');
-- Quitar el horario (NULL) libera la agenda.
select pg_temp.login_as('owner_a');
select public.set_doctor_schedule(pg_temp.v('d1'), null);
select pg_temp.login_as('reception_a');
select pg_temp.cita('p1', 'd1', 'c1', 2, '10:00', '11:00');

-- ------------------------------------------------------- pasante: alcance ----
select pg_temp.login_as('reception_a');
select set_config('hs.pi', (public.create_patient(pg_temp.v('a'), 'Paciente Pasante', 'papel', p_primary_doctor => pg_temp.v('in'))).id::text, true);
select pg_temp.login_as('owner_a');
select set_config('hs.qi', (public.save_quote(null, pg_temp.v('pi'), pg_temp.v('in'),
  jsonb_build_array(jsonb_build_object('concept', 'Limpieza', 'quantity', 1, 'unit_price', 900)), 'Limpieza', 0, 0)).id::text, true);
select public.register_payment(pg_temp.v('pi'), 300, 'efectivo');
select set_config('hs.q1', (public.save_quote(null, pg_temp.v('p1'), pg_temp.v('d1'),
  jsonb_build_array(jsonb_build_object('concept', 'Resina', 'quantity', 1, 'unit_price', 1200)), 'Resina', 0, 0)).id::text, true);

select pg_temp.assert_true(pg_temp.seen('intern_a', 'select count(*) from public.patients') = 1, 'el pasante ve solo a sus pacientes');
select pg_temp.assert_true(pg_temp.seen('intern_a', 'select count(*) from public.quotes') = 0, 'el pasante no ve presupuestos, ni de sus pacientes');
select pg_temp.assert_true(pg_temp.seen('intern_a', 'select count(*) from public.quote_items') = 0, 'ni sus partidas');
select pg_temp.assert_true(pg_temp.seen('intern_a', 'select count(*) from public.payments') = 0, 'ni los cobros');
select pg_temp.assert_true(pg_temp.seen('intern_a', 'select count(*) from public.commission_entries') = 0, 'ni comisiones');
select pg_temp.assert_true(pg_temp.seen('doctor_a', 'select count(*) from public.quotes') = 1, 'el doctor sigue viendo los presupuestos de sus pacientes');
select pg_temp.assert_true(pg_temp.seen('owner_a', 'select count(*) from public.payments') = 1, 'la gerencia ve los cobros');

select pg_temp.login_as('intern_a');
select pg_temp.expect_error(format($$select public.quote_stats(%L, now() - interval '30 days')$$, pg_temp.v('a')), '42501', 'el pasante no ve estadísticas de presupuestos');
select pg_temp.expect_error(format($$select public.patient_account(%L)$$, pg_temp.v('pi')), '42501', 'el pasante no ve la cuenta del paciente');
select pg_temp.assert_true((select count(*) = 0 from public.commission_summary(pg_temp.v('a'), current_date - 15, current_date)), 'el pasante no ve comisiones');
select pg_temp.expect_error(format($$select public.save_quote(null, %L, %L, '[{"concept":"X","quantity":1,"unit_price":100}]'::jsonb, 'X', 0, 0)$$,
  pg_temp.v('pi'), pg_temp.v('in')), '42501', 'el pasante no hace presupuestos');
select pg_temp.expect_error(format($$select public.set_quote_status(%L, 'presentado')$$, pg_temp.v('qi')), '42501', 'ni mueve presupuestos');

-- Sí trabaja su agenda y sus pacientes.
select pg_temp.assert_true((select primary_doctor_id = pg_temp.v('in') from public.create_patient(pg_temp.v('a'), 'Paciente Propio Pasante', 'papel')),
  'el paciente que da de alta el pasante queda con él');
select pg_temp.cita('pi', 'in', 'c2', 0, '10:00', '11:00');
select pg_temp.expect_error($$select pg_temp.cita('pi', 'in', 'c2', 0, '14:00', '15:00')$$, 'DH002', 'el pasante también tiene horario');
select pg_temp.expect_error($$select pg_temp.cita('p1', 'in', 'c2', 0, '11:00', '12:00')$$, 'P0002', 'no agenda a pacientes de otros');
select pg_temp.expect_error($$select pg_temp.cita('pi', 'd1', 'c2', 1, '10:00', '11:00')$$, '42501', 'solo agenda en su agenda');
select public.add_patient_note(pg_temp.v('pi'), 'Nota del pasante');
select pg_temp.logout();

select pg_temp.assert_true(pg_temp.seen('owner_b', 'select count(*) from public.patients') = 0, 'otra clínica no ve pacientes');
select pg_temp.assert_true(pg_temp.seen('super', 'select count(*) from public.quotes') = 0, 'el superadmin no ve presupuestos');

select set_config('role', 'none', true);
select 'horario y pasante: todas las pruebas pasaron' as resultado;

rollback;
