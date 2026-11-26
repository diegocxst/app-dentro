-- =============================================================================
-- PRUEBAS · 20261126000200_patient_credit (cobro contra presupuesto y saldo a favor, M5-C)
-- Local: `npm run test:db`. Dev: `npx supabase db query --remote --yes -f <este archivo>`.
-- Actores: owner_a, reception_a, doctor_a, doctor2_a, owner_b y super. Termina en ROLLBACK.
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('pc.' || k)::uuid $$;
create function pg_temp.seen(k text, p_sql text) returns int language plpgsql as $$
declare n int;
begin
  perform pg_temp.login_as(k);
  execute p_sql into n;
  perform pg_temp.logout();
  return n;
end $$;
-- Lo pagado de un presupuesto y el saldo a favor del paciente 1 (como la base).
create function pg_temp.paid(k text) returns numeric language sql stable as $$
  select coalesce(sum(amount), 0) from public.payment_allocations where quote_id = pg_temp.v(k) and voided_at is null
$$;
create function pg_temp.credit() returns numeric language sql stable as $$
  select private.patient_credit(pg_temp.v('a'), pg_temp.v('p1'))
$$;
-- Comisión vigente que generó un pago.
create function pg_temp.comm(k text) returns numeric language sql stable as $$
  select coalesce(sum(amount), 0) from public.commission_entries where payment_id = pg_temp.v(k) and voided_at is null and kind = 'comision'
$$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.payment_allocations', 'SELECT')
  and not has_table_privilege('authenticated', 'public.payment_allocations', 'INSERT')
  and not has_table_privilege('authenticated', 'public.payment_allocations', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.payment_allocations', 'DELETE')
  and not has_table_privilege('anon', 'public.payment_allocations', 'SELECT'),
  'las aplicaciones solo se escriben desde la base');
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'private.apply_patient_credit(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.patient_credit(uuid,uuid)', 'EXECUTE'),
  'aplicar el saldo a favor no se llama desde la app');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.pc@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba saldo a favor');

select pg_temp.login_as('owner_a');
select set_config('pc.a', (public.create_tenant('Clínica Saldo A', 'clinic', 'pc-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('pc.b', (public.create_tenant('Clínica Saldo B', 'clinic', 'pc-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor_collab');
select set_config('pc.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);

select pg_temp.login_as('reception_a');
select set_config('pc.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Saldo Uno', 'papel', p_primary_doctor => pg_temp.v('d1'))).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('pc.pb', (public.create_patient(pg_temp.v('b'), 'Paciente Saldo B', 'papel')).id::text, true);
select pg_temp.login_as('owner_a');
select public.set_commission_scheme(pg_temp.v('d1'), 'percent_collected', 40);
select pg_temp.logout();

-- Tres presupuestos presentados del paciente 1, con la doctora 1.
insert into public.quotes (tenant_id, folio, patient_id, doctor_id, title, status, total) values
  (pg_temp.v('a'), 1, pg_temp.v('p1'), pg_temp.v('d1'), 'Uno', 'presentado', 3000),
  (pg_temp.v('a'), 2, pg_temp.v('p1'), pg_temp.v('d1'), 'Dos', 'presentado', 2000),
  (pg_temp.v('a'), 3, pg_temp.v('p1'), pg_temp.v('d1'), 'Tres', 'presentado', 5000);
select set_config('pc.q1', (select id::text from public.quotes where tenant_id = pg_temp.v('a') and folio = 1), true);
select set_config('pc.q2', (select id::text from public.quotes where tenant_id = pg_temp.v('a') and folio = 2), true);
select set_config('pc.q3', (select id::text from public.quotes where tenant_id = pg_temp.v('a') and folio = 3), true);

-- ------------------------------------------------- abono suelto = saldo a favor ----
select pg_temp.login_as('reception_a');
select set_config('pc.x1', (public.register_payment(pg_temp.v('p1'), 1500, 'efectivo')).id::text, true);
select pg_temp.logout();
select pg_temp.assert_true(pg_temp.credit() = 1500 and pg_temp.paid('q1') = 0, 'sin presupuesto aceptado, el abono queda a favor');
select pg_temp.assert_true((select doctor_id is null and quote_id is null from public.payments where id = pg_temp.v('x1')), 'el saldo a favor no tiene doctor');
select pg_temp.assert_true(pg_temp.comm('x1') = 0, 'el saldo a favor no genera comisión mientras no se aplica');

select pg_temp.login_as('doctor_a');
select pg_temp.assert_true((select (public.patient_account(pg_temp.v('p1')) ->> 'credit')::numeric = 1500), 'la cuenta del paciente muestra el saldo a favor');
select pg_temp.login_as('doctor2_a');
select pg_temp.expect_error(format($$select public.patient_account(%L)$$, pg_temp.v('p1')), 'P0002', 'otro doctor no ve la cuenta');

-- ------------------------------------- al aceptar, el saldo a favor se aplica ----
select pg_temp.login_as('owner_a');
select public.set_quote_status(pg_temp.v('q1'), 'aceptado');
select pg_temp.logout();
select pg_temp.assert_true(pg_temp.credit() = 0 and pg_temp.paid('q1') = 1500, 'al aceptarse se le aplica el saldo a favor');
select pg_temp.assert_true(
  (select source = 'saldo_a_favor' and doctor_id = pg_temp.v('d1') from public.payment_allocations where payment_id = pg_temp.v('x1')),
  'la aplicación lleva el doctor del presupuesto');
select pg_temp.assert_true(pg_temp.comm('x1') = 600, 'la comisión nace al aplicarse (40% de 1,500)');

-- ------------------------------------------------ pago contra un presupuesto ----
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.register_payment(%L, 1600, 'efectivo', p_quote => %L)$$, pg_temp.v('p1'), pg_temp.v('q1')),
  '22023', 'no se paga más que el saldo del presupuesto');
select set_config('pc.x2', (public.register_payment(pg_temp.v('p1'), 1500, 'tarjeta_debito', p_quote => pg_temp.v('q1'))).id::text, true);
select pg_temp.logout();
select pg_temp.assert_true(pg_temp.paid('q1') = 3000, 'pagar el saldo completo');

-- Otro abono suelto: no hay presupuesto aceptado con saldo, queda a favor.
select pg_temp.login_as('reception_a');
select set_config('pc.x3', (public.register_payment(pg_temp.v('p1'), 2500, 'efectivo')).id::text, true);
select pg_temp.logout();
select pg_temp.assert_true(pg_temp.credit() = 2500, 'si ya está todo pagado, sigue a favor');

-- Un apartado acepta el presupuesto 2 y el saldo a favor cubre el resto.
select pg_temp.login_as('reception_a');
select set_config('pc.x4', (public.register_payment(pg_temp.v('p1'), 500, 'efectivo', p_quote => pg_temp.v('q2'))).id::text, true);
select pg_temp.logout();
select pg_temp.assert_true((select status = 'aceptado' from public.quotes where id = pg_temp.v('q2')), 'el apartado acepta el presupuesto');
select pg_temp.assert_true(pg_temp.paid('q2') = 2000 and pg_temp.credit() = 1000, 'el saldo a favor cubre hasta el saldo; lo que sobra sigue a favor');

-- Al aceptar el 3, se aplica lo que queda.
select pg_temp.login_as('owner_a');
select public.set_quote_status(pg_temp.v('q3'), 'aceptado');
select pg_temp.logout();
select pg_temp.assert_true(pg_temp.paid('q3') = 1000 and pg_temp.credit() = 0, 'lo que quedaba se aplica al siguiente');
select pg_temp.assert_true(pg_temp.comm('x3') = 1000, 'un abono aplicado a dos presupuestos genera comisión de ambos (40% de 2,500)');

-- -------------------------------------------------------------- anulaciones ----
select pg_temp.login_as('owner_a');
select public.void_payment(pg_temp.v('x3'), 'Prueba');
select pg_temp.logout();
select pg_temp.assert_true((select count(*) = 2 and bool_and(voided_at is not null) from public.payment_allocations where payment_id = pg_temp.v('x3')),
  'al anular se anulan sus aplicaciones');
select pg_temp.assert_true(pg_temp.paid('q2') = 500 and pg_temp.paid('q3') = 0 and pg_temp.comm('x3') = 0, 'y sus comisiones; los saldos se reabren');

select pg_temp.login_as('reception_a');
select set_config('pc.x5', (public.register_payment(pg_temp.v('p1'), 800, 'efectivo')).id::text, true);
select pg_temp.logout();
select pg_temp.assert_true(pg_temp.paid('q2') = 1300 and pg_temp.paid('q3') = 0, 'el saldo a favor va primero al presupuesto más antiguo');

-- ------------------------------------------------------------- reportes ----
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  (select collected = 1500 + 1500 + 500 + 800 and commission = 0.4 * (1500 + 1500 + 500 + 800)
   from public.commission_summary(pg_temp.v('a'), current_date - 1, current_date + 1) where doctor_id = pg_temp.v('d1')),
  'lo cobrado del doctor es lo aplicado a sus presupuestos');
select pg_temp.assert_true((select count(*) >= 2 from jsonb_array_elements(public.commission_lines(pg_temp.v('d1'), current_date - 1, current_date + 1) -> 'rows') r
  where r ->> 'source' = 'saldo_a_favor' and r ->> 'quote_folio' is not null), 'los movimientos dicen que vino de saldo a favor y de qué presupuesto');
select pg_temp.logout();

-- ------------------------------------------------------------------ RLS ----
select pg_temp.assert_true(pg_temp.seen('doctor_a', format('select count(*) from public.payment_allocations where patient_id = %L', pg_temp.v('p1'))) > 0, 'la doctora ve las de su paciente');
select pg_temp.assert_true(pg_temp.seen('reception_a', format('select count(*) from public.payment_allocations where patient_id = %L', pg_temp.v('p1'))) > 0, 'recepción las ve');
select pg_temp.assert_true(pg_temp.seen('doctor2_a', 'select count(*) from public.payment_allocations') = 0, 'otro doctor no ve las ajenas');
select pg_temp.assert_true(pg_temp.seen('owner_b', 'select count(*) from public.payment_allocations') = 0, 'otra clínica no las ve');
select pg_temp.assert_true(pg_temp.seen('super', 'select count(*) from public.payment_allocations') = 0, 'el superadmin no las ve');

-- Otra clínica: su abono suelto no toca a la clínica A.
select pg_temp.login_as('owner_b');
select public.register_payment(pg_temp.v('pb'), 999, 'efectivo');
select pg_temp.logout();
select pg_temp.assert_true((select count(*) = 0 from public.payment_allocations where tenant_id = pg_temp.v('b')), 'el saldo de otra clínica no se aplica aquí');

-- ---------------------------------------------------------------- defensas ----
select pg_temp.login_as('owner_a');
select pg_temp.expect_error(format($$insert into public.payment_allocations (tenant_id, payment_id, quote_id, patient_id, amount, source) values (%L, %L, %L, %L, 1, 'pago')$$,
  pg_temp.v('a'), pg_temp.v('x5'), pg_temp.v('q3'), pg_temp.v('p1')), '42501', 'sin INSERT directo');
select pg_temp.logout();
-- Aunque se escriba como dueño de la base, una aplicación no pasa del pago.
select pg_temp.expect_error(format($$insert into public.payment_allocations (tenant_id, payment_id, quote_id, patient_id, amount, source) values (%L, %L, %L, %L, 1, 'pago')$$,
  pg_temp.v('a'), pg_temp.v('x5'), pg_temp.v('q3'), pg_temp.v('p1')), '22023', 'no se aplica más de lo pagado');
select pg_temp.expect_error(format($$insert into public.payment_allocations (tenant_id, payment_id, quote_id, patient_id, amount, source) values (%L, %L, %L, %L, 1, 'pago')$$,
  pg_temp.v('a'), pg_temp.v('x3'), pg_temp.v('q3'), pg_temp.v('p1')), '22023', 'un pago anulado no se aplica');

-- ---------------------------------------------------------------- auditoría ----
select pg_temp.assert_true(
  (select count(*) >= 5 and bool_and(details - 'method' - 'kind' = '{}'::jsonb)
     and count(*) filter (where details ->> 'kind' = 'saldo_a_favor') >= 3
   from public.audit_logs where action = 'payment.registered' and tenant_id = pg_temp.v('a')),
  'auditoría sin montos: solo forma de pago y si fue saldo a favor');

select 'saldo a favor: todas las pruebas pasaron' as resultado;
rollback;
