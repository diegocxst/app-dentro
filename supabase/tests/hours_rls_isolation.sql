-- =============================================================================
-- PRUEBAS · 20261116000300_branch_hours (horario por sucursal)
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
  select ('00000000-0000-4000-8000-0000000000' || case k when 'owner_a' then 'a7' when 'doctor_a' then 'a8' when 'owner_b' then 'a9' end)::uuid;
$$;

create function pg_temp.login_as(k text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(k), 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.b() returns uuid language sql stable as $$ select current_setting('hrs.branch')::uuid $$;

-- Validador puro
select pg_temp.assert_true(private.valid_opening_hours('{}'), 'sin días = cerrado (válido)');
select pg_temp.assert_true(private.valid_opening_hours('{"mon":[["09:00","14:00"],["16:00","20:00"]],"sat":[["09:00","13:00"]]}'), 'horario partido válido');
select pg_temp.assert_true(not private.valid_opening_hours('{"lunes":[["09:00","14:00"]]}'), 'rechaza días desconocidos');
select pg_temp.assert_true(not private.valid_opening_hours('{"mon":[["14:00","09:00"]]}'), 'rechaza un tramo que termina antes de empezar');
select pg_temp.assert_true(not private.valid_opening_hours('{"mon":[["09:00","14:00"],["13:00","18:00"]]}'), 'rechaza tramos encimados');
select pg_temp.assert_true(not private.valid_opening_hours('{"mon":[["9:00","14:00"]]}'), 'rechaza horas sin formato HH:MM');
select pg_temp.assert_true(not private.valid_opening_hours('{"mon":[["08:00","09:00"],["10:00","11:00"],["12:00","13:00"],["14:00","15:00"]]}'), 'máximo 3 tramos por día');
select pg_temp.assert_true(not private.valid_opening_hours('[]'), 'debe ser un objeto');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.hrs@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'doctor_a', 'owner_b']) as k;

select pg_temp.login_as('owner_a');
select set_config('hrs.a', (public.create_tenant('Clínica Horario A', 'clinic', 'hrs-test-a')).id::text, true);
select set_config('hrs.branch', (select id::text from public.branches where tenant_id = current_setting('hrs.a')::uuid), true);
select pg_temp.login_as('owner_b');
select public.create_tenant('Clínica Horario B', 'clinic', 'hrs-test-b');
select set_config('role', 'none', true);
insert into public.memberships (tenant_id, user_id, role) values (current_setting('hrs.a')::uuid, pg_temp.uid('doctor_a'), 'doctor');

select pg_temp.assert_true((select opening_hours = '{}'::jsonb from public.branches where id = pg_temp.b()), 'una sucursal nueva no tiene horario');

select pg_temp.login_as('owner_a');
select public.set_branch_hours(pg_temp.b(), '{"mon":[["09:00","14:00"],["16:00","20:00"]],"tue":[["09:00","18:00"]]}');
select pg_temp.assert_true((select opening_hours -> 'mon' -> 1 ->> 1 = '20:00' from public.branches where id = pg_temp.b()), 'guarda el horario');
select pg_temp.expect_error(format($$select public.set_branch_hours(%L, '{"mon":[["14:00","09:00"]]}')$$, pg_temp.b()), '22023', 'rechaza un horario inválido');
select pg_temp.expect_error(format($$update public.branches set opening_hours = '{}' where id = %L$$, pg_temp.b()), '42501', 'sin UPDATE directo');

select pg_temp.login_as('doctor_a');
select pg_temp.assert_true((select opening_hours ? 'mon' from public.branches where id = pg_temp.b()), 'el doctor ve el horario (para la agenda)');
select pg_temp.expect_error(format($$select public.set_branch_hours(%L, '{}')$$, pg_temp.b()), '42501', 'el doctor no cambia el horario');

select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.set_branch_hours(%L, '{}')$$, pg_temp.b()), '42501', 'otra clínica no cambia el horario');

select set_config('role', 'none', true);
select pg_temp.expect_error(format($$update public.branches set opening_hours = '{"mon":[["10:00","09:00"]]}' where id = %L$$, pg_temp.b()),
  '23514', 'el CHECK de la tabla también protege (aunque se escriba como dueño de la base)');

select 'horario: todas las pruebas pasaron' as resultado;

rollback;
