-- =============================================================================
-- PRUEBAS · 20261124000400_doctor_reports (reportes del equipo e historial del doctor)
-- Local: `npm run test:db`. Dev: `npx supabase db query --remote --yes -f <este archivo>`.
-- Actores: owner_a, reception_a, doctor_a, doctor2_a, owner_b, super y la administradora admin_a.
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
    when 'owner_a' then 'd1' when 'reception_a' then 'd2' when 'doctor_a' then 'd3' when 'doctor2_a' then 'd4'
    when 'owner_b' then 'd5' when 'super' then 'd6' when 'admin_a' then 'd7' end)::uuid;
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('rp.' || k)::uuid $$;
create function pg_temp.ago(p_days int, p_hours int default 0) returns timestamptz language sql stable as $$
  select date_trunc('minute', now()) - make_interval(days => p_days, hours => p_hours)
$$;
-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.doctor_quote_report(uuid,date,date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.doctor_history(uuid,date,date)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.doctor_quote_report(uuid,date,date)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.doctor_history(uuid,date,date)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.quote_groups(uuid,uuid,boolean,date,date)', 'EXECUTE'),
  'permisos de las funciones nuevas');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.rp@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super', 'admin_a']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba reportes');

select pg_temp.login_as('owner_a');
select set_config('rp.a', (public.create_tenant('Clínica Reportes A', 'clinic', 'rp-test-a')).id::text, true);
select set_config('rp.branch', (select id::text from public.branches where tenant_id = pg_temp.v('a')), true);
select set_config('rp.chair', (public.create_chair(pg_temp.v('branch'), 'Sillón 1')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('rp.b', (public.create_tenant('Clínica Reportes B', 'clinic', 'rp-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor_collab'),
  (pg_temp.v('a'), pg_temp.uid('admin_a'), 'admin');
select set_config('rp.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);
select set_config('rp.d2', (select id::text from public.memberships where user_id = pg_temp.uid('doctor2_a')), true);
select set_config('rp.ownb', (select id::text from public.memberships where user_id = pg_temp.uid('owner_b')), true);

select pg_temp.login_as('reception_a');
select set_config('rp.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Reporte Uno', 'papel', p_primary_doctor => pg_temp.v('d1'))).id::text, true);
select set_config('rp.p2', (public.create_patient(pg_temp.v('a'), 'Paciente Reporte Dos', 'papel', p_primary_doctor => pg_temp.v('d2'))).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('rp.pb', (public.create_patient(pg_temp.v('b'), 'Paciente Reporte B', 'papel')).id::text, true);
select pg_temp.login_as('owner_a');
select public.set_commission_scheme(pg_temp.v('d1'), 'percent_collected', 40);
select pg_temp.logout();

-- Presupuestos (datos directos: el reporte solo lee).
insert into public.quotes (tenant_id, folio, patient_id, doctor_id, status, total, sent_at, lost_reason, created_at) values
  (pg_temp.v('a'), 1, pg_temp.v('p1'), pg_temp.v('d1'), 'borrador', 100, null, null, pg_temp.ago(1)),
  (pg_temp.v('a'), 2, pg_temp.v('p1'), pg_temp.v('d1'), 'presentado', 1000, pg_temp.ago(2), null, pg_temp.ago(3)),
  (pg_temp.v('a'), 3, pg_temp.v('p1'), pg_temp.v('d1'), 'en_duda', 2000, pg_temp.ago(2), null, pg_temp.ago(3)),
  (pg_temp.v('a'), 4, pg_temp.v('p1'), pg_temp.v('d1'), 'aceptado', 3000, pg_temp.ago(4), null, pg_temp.ago(5)),
  (pg_temp.v('a'), 5, pg_temp.v('p1'), pg_temp.v('d1'), 'en_tratamiento', 4000, pg_temp.ago(6), null, pg_temp.ago(7)),
  (pg_temp.v('a'), 6, pg_temp.v('p1'), pg_temp.v('d1'), 'terminado', 5000, pg_temp.ago(8), null, pg_temp.ago(9)),
  (pg_temp.v('a'), 7, pg_temp.v('p1'), pg_temp.v('d1'), 'perdido', 600, pg_temp.ago(10), 'Le pareció caro', pg_temp.ago(11)),
  -- Presentado hace 100 días: queda fuera del periodo aunque se haya movido después.
  (pg_temp.v('a'), 8, pg_temp.v('p1'), pg_temp.v('d1'), 'aceptado', 9000, pg_temp.ago(100), null, pg_temp.ago(101)),
  -- Sin fecha de presentado: cuenta la de creación.
  (pg_temp.v('a'), 9, pg_temp.v('p2'), pg_temp.v('d2'), 'presentado', 700, null, null, pg_temp.ago(1)),
  (pg_temp.v('a'), 10, pg_temp.v('p2'), null, 'aceptado', 800, pg_temp.ago(1), null, pg_temp.ago(1)),
  (pg_temp.v('b'), 1, pg_temp.v('pb'), pg_temp.v('ownb'), 'presentado', 999, pg_temp.ago(1), null, pg_temp.ago(1));

-- Citas del doctor A: 3 atendidas (2 pacientes), 1 falta, 1 cancelada y 2 próximas.
insert into public.appointments (tenant_id, branch_id, chair_id, doctor_id, patient_id, status, starts_at, ends_at, cancel_reason) values
  (pg_temp.v('a'), pg_temp.v('branch'), pg_temp.v('chair'), pg_temp.v('d1'), pg_temp.v('p1'), 'llego', pg_temp.ago(2), pg_temp.ago(2) + interval '1 hour', null),
  (pg_temp.v('a'), pg_temp.v('branch'), pg_temp.v('chair'), pg_temp.v('d1'), pg_temp.v('p1'), 'llego', pg_temp.ago(3), pg_temp.ago(3) + interval '1 hour', null),
  (pg_temp.v('a'), pg_temp.v('branch'), pg_temp.v('chair'), pg_temp.v('d1'), pg_temp.v('p2'), 'llego', pg_temp.ago(4), pg_temp.ago(4) + interval '1 hour', null),
  (pg_temp.v('a'), pg_temp.v('branch'), pg_temp.v('chair'), pg_temp.v('d1'), pg_temp.v('p2'), 'no_asistio', pg_temp.ago(5), pg_temp.ago(5) + interval '1 hour', null),
  (pg_temp.v('a'), pg_temp.v('branch'), pg_temp.v('chair'), pg_temp.v('d1'), pg_temp.v('p2'), 'cancelada', pg_temp.ago(6), pg_temp.ago(6) + interval '1 hour', 'Viaje'),
  (pg_temp.v('a'), pg_temp.v('branch'), pg_temp.v('chair'), pg_temp.v('d1'), pg_temp.v('p1'), 'programada', pg_temp.ago(-3), pg_temp.ago(-3) + interval '1 hour', null),
  (pg_temp.v('a'), pg_temp.v('branch'), pg_temp.v('chair'), pg_temp.v('d1'), pg_temp.v('p2'), 'confirmada', pg_temp.ago(-5), pg_temp.ago(-5) + interval '1 hour', null),
  -- Del otro doctor: no entra en el historial del doctor A.
  (pg_temp.v('a'), pg_temp.v('branch'), pg_temp.v('chair'), pg_temp.v('d2'), pg_temp.v('p2'), 'llego', pg_temp.ago(7), pg_temp.ago(7) + interval '1 hour', null);

-- Pagos: 1,500 vigentes y 500 anulados (su comisión se anula).
insert into public.payments (tenant_id, folio, patient_id, doctor_id, amount, method, paid_at) values
  (pg_temp.v('a'), 1, pg_temp.v('p1'), pg_temp.v('d1'), 1500, 'efectivo', pg_temp.ago(2)),
  (pg_temp.v('a'), 2, pg_temp.v('p1'), pg_temp.v('d1'), 500, 'efectivo', pg_temp.ago(2)),
  (pg_temp.v('a'), 3, pg_temp.v('p2'), pg_temp.v('d2'), 300, 'efectivo', pg_temp.ago(2));
update public.payments set voided_at = now(), void_reason = 'Prueba' where tenant_id = pg_temp.v('a') and folio = 2;

-- ---------------------------------------------------- reporte por doctor ----
-- Periodo de prueba: los últimos 30 días hasta mañana.
select pg_temp.login_as('owner_a');
create temp table rep on commit drop as select * from public.doctor_quote_report(pg_temp.v('a'), current_date - 30, current_date + 1);
select pg_temp.login_as('owner_b');
create temp table rep_b on commit drop as select * from public.doctor_quote_report(pg_temp.v('b'), current_date - 30, current_date + 1);
select pg_temp.logout();
select pg_temp.assert_true((select presented = 6 and presented_amount = 15600 and accepted = 3 and accepted_amount = 12000
    and waiting = 2 and waiting_amount = 3000 and unfinished = 2 and unfinished_amount = 7000 and lost = 1 and lost_amount = 600
  from rep where doctor_id = pg_temp.v('d1')), 'grupos del doctor A (sin borrador ni lo de fuera del periodo)');
select pg_temp.assert_true((select presented = 1 and waiting = 1 from rep where doctor_id = pg_temp.v('d2')),
  'sin fecha de presentado cuenta la de creación');
select pg_temp.assert_true((select presented = 1 and accepted = 1 and full_name = 'Sin doctor' from rep where doctor_id is null),
  'los presupuestos sin doctor van en su fila');
select pg_temp.assert_true((select count(*) = 1 from rep where role = 'owner' and presented = 0), 'la dueña aparece aunque no tenga presupuestos');
select pg_temp.assert_true((select count(*) = 0 from rep where role = 'reception'),
  'recepción no sale en el reporte');
select pg_temp.assert_true((select coalesce(sum(presented), 0) = 8 from rep), 'nada de la otra clínica');
select pg_temp.assert_true((select presented = 1 and presented_amount = 999 from rep_b where doctor_id = pg_temp.v('ownb')),
  'la otra clínica ve solo lo suyo');

select pg_temp.login_as('owner_a');
select pg_temp.expect_error(format($$select * from public.doctor_quote_report(%L, current_date - 401, current_date)$$, pg_temp.v('a')), '22023', 'periodo de más de 400 días');
select pg_temp.expect_error(format($$select * from public.doctor_quote_report(%L, current_date, current_date - 1)$$, pg_temp.v('a')), '22023', 'periodo al revés');
select pg_temp.expect_error(format($$select * from public.doctor_quote_report(%L, null, current_date)$$, pg_temp.v('a')), '22023', 'periodo sin inicio');
select pg_temp.login_as('admin_a');
select pg_temp.expect_error(format($$select * from public.doctor_quote_report(%L, current_date - 30, current_date)$$, pg_temp.v('a')), '42501', 'la administración no ve el reporte');
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select * from public.doctor_quote_report(%L, current_date - 30, current_date)$$, pg_temp.v('a')), '42501', 'recepción no ve el reporte');
select pg_temp.login_as('doctor_a');
select pg_temp.expect_error(format($$select * from public.doctor_quote_report(%L, current_date - 30, current_date)$$, pg_temp.v('a')), '42501', 'un doctor no ve el reporte');
select pg_temp.login_as('doctor2_a');
select pg_temp.expect_error(format($$select * from public.doctor_quote_report(%L, current_date - 30, current_date)$$, pg_temp.v('a')), '42501', 'un colaborador no ve el reporte');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select * from public.doctor_quote_report(%L, current_date - 30, current_date)$$, pg_temp.v('a')), '42501', 'otra clínica no ve el reporte');
select pg_temp.login_as('super');
select pg_temp.expect_error(format($$select * from public.doctor_quote_report(%L, current_date - 30, current_date)$$, pg_temp.v('a')), '42501', 'el superadmin no ve el reporte');
select pg_temp.logout();

-- ------------------------------------------------- historial del doctor ----
select pg_temp.login_as('owner_a');
select set_config('rp.h', public.doctor_history(pg_temp.v('d1'), current_date - 30, current_date + 1)::text, true);
select pg_temp.logout();
create temp table h on commit drop as select current_setting('rp.h')::jsonb as j;
select pg_temp.assert_true((select (j #>> '{appointments,attended}')::int = 3 and (j #>> '{appointments,no_show}')::int = 1
  and (j #>> '{appointments,cancelled}')::int = 1 and (j #>> '{appointments,total}')::int = 5 from h), 'citas del periodo');
select pg_temp.assert_true((select (j ->> 'patients')::int = 2 from h), 'pacientes atendidos distintos');
select pg_temp.assert_true((select (j ->> 'collected')::numeric = 1500 from h), 'cobrado sin anulados ni pagos de otros');
select pg_temp.assert_true((select (j ->> 'commission')::numeric = 600 from h), 'comisión sin la del pago anulado');
select pg_temp.assert_true((select (j #>> '{quotes,presented}')::int = 6 and (j #>> '{quotes,unfinished_amount}')::numeric = 7000 from h),
  'presupuestos del doctor');
select pg_temp.assert_true((select jsonb_array_length(j -> 'upcoming') = 2
  and (j #>> '{upcoming,0,starts_at}')::timestamptz < (j #>> '{upcoming,1,starts_at}')::timestamptz from h), 'próximas citas en orden');
select pg_temp.assert_true((select jsonb_array_length(j -> 'recent') = 5 and j #>> '{recent,0,status}' = 'llego' from h), 'últimas citas del periodo');
select pg_temp.assert_true((select not (j::text like '%Viaje%') from h), 'el historial no trae motivos ni notas');

select pg_temp.login_as('owner_a');
select set_config('rp.h2', public.doctor_history(pg_temp.v('d2'), current_date - 30, current_date + 1)::text, true);
select pg_temp.assert_true((current_setting('rp.h2')::jsonb #>> '{appointments,attended}')::int = 1
  and (current_setting('rp.h2')::jsonb ->> 'collected')::numeric = 300 and (current_setting('rp.h2')::jsonb ->> 'commission')::numeric = 0,
  'historial del otro doctor por separado');
select pg_temp.expect_error(format($$select public.doctor_history(%L, current_date - 401, current_date)$$, pg_temp.v('d1')), '22023', 'historial: periodo de más de 400 días');
select pg_temp.expect_error($$select public.doctor_history('00000000-0000-4000-8000-000000000999', current_date - 30, current_date)$$, 'P0002', 'historial de alguien que no existe');
select pg_temp.login_as('admin_a');
select pg_temp.expect_error(format($$select public.doctor_history(%L, current_date - 30, current_date)$$, pg_temp.v('d1')), 'P0002', 'la administración no ve historiales');
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.doctor_history(%L, current_date - 30, current_date)$$, pg_temp.v('d1')), 'P0002', 'recepción no ve historiales');
select pg_temp.login_as('doctor_a');
select pg_temp.expect_error(format($$select public.doctor_history(%L, current_date - 30, current_date)$$, pg_temp.v('d1')), 'P0002', 'un doctor no ve ni su propio historial');
select pg_temp.login_as('doctor2_a');
select pg_temp.expect_error(format($$select public.doctor_history(%L, current_date - 30, current_date)$$, pg_temp.v('d1')), 'P0002', 'un colaborador no ve el historial de otro');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.doctor_history(%L, current_date - 30, current_date)$$, pg_temp.v('d1')), 'P0002', 'otra clínica no ve historiales');
select pg_temp.login_as('super');
select pg_temp.expect_error(format($$select public.doctor_history(%L, current_date - 30, current_date)$$, pg_temp.v('d1')), 'P0002', 'el superadmin no ve historiales');
select pg_temp.logout();

select 'reportes: todas las pruebas pasaron' as resultado;
rollback;
