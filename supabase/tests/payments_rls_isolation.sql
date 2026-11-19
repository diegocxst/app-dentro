-- =============================================================================
-- PRUEBAS · 20261119000100_payments
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
    when 'owner_a' then 'c7' when 'reception_a' then 'c8' when 'doctor_a' then 'c9' when 'doctor2_a' then 'ca'
    when 'owner_b' then 'cb' when 'super' then 'cc' end)::uuid;
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('py.' || k)::uuid $$;
create function pg_temp.items(p_price numeric, p_disc numeric default 0) returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_object('concept', 'Alineadores transparentes', 'quantity', 1, 'unit_price', p_price),
    jsonb_build_object('concept', 'Limpieza previa', 'quantity', 2, 'unit_price', 850)
  ) || case when p_disc <> 0 then jsonb_build_array(jsonb_build_object('concept', 'Descuento', 'quantity', 1, 'unit_price', -p_disc)) else '[]'::jsonb end
$$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'RLS habilitada en pagos');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.py@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba pagos');

select pg_temp.login_as('owner_a');
select set_config('py.a', (public.create_tenant('Clínica Pagos A', 'clinic', 'py-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('py.b', (public.create_tenant('Clínica Pagos B', 'clinic', 'py-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor');
select set_config('py.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);

select pg_temp.login_as('reception_a');
select set_config('py.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Pagos Uno', 'papel', p_primary_doctor => pg_temp.v('d1'))).id::text, true);
select set_config('py.p2', (public.create_patient(pg_temp.v('a'), 'Paciente Pagos Dos', 'papel')).id::text, true);
select set_config('py.q1', (public.save_quote(null, pg_temp.v('p1'), pg_temp.v('d1'), '[{"concept":"Ortodoncia","quantity":1,"unit_price":38000}]', 'Ortodoncia', 5000, 12)).id::text, true);
select set_config('py.q2', (public.save_quote(null, pg_temp.v('p2'), null, '[{"concept":"Limpieza","quantity":1,"unit_price":850}]')).id::text, true);

-- ------------------------------------------------------------- registrar -----
select pg_temp.expect_error(format($$select public.register_payment(%L, 5000, 'efectivo', p_quote => %L)$$, pg_temp.v('p1'), pg_temp.v('q1')), '22023', 'un borrador no se cobra');
select public.set_quote_status(pg_temp.v('q1'), 'presentado');
select set_config('py.x1', (public.register_payment(pg_temp.v('p1'), 5000, 'transferencia', p_quote => pg_temp.v('q1'), p_reference => 'SPEI 123')).id::text, true);
select pg_temp.assert_true(
  (select folio = 1 and amount = 5000 and doctor_id = pg_temp.v('d1') and registered_by = pg_temp.uid('reception_a') from public.payments where id = pg_temp.v('x1')),
  'folio 1, monto y doctor del presupuesto');
select pg_temp.assert_true((select status = 'aceptado' from public.quotes where id = pg_temp.v('q1')), 'el anticipo pasa el presupuesto a «Aceptado»');
select pg_temp.expect_error(format($$select public.register_payment(%L, 33001, 'efectivo', p_quote => %L)$$, pg_temp.v('p1'), pg_temp.v('q1')), '22023', 'no supera el saldo del presupuesto');
select pg_temp.expect_error(format($$select public.register_payment(%L, 100, 'efectivo', p_quote => %L)$$, pg_temp.v('p2'), pg_temp.v('q1')), '22023', 'el presupuesto debe ser del paciente');
select pg_temp.expect_error(format($$select public.register_payment(%L, 0, 'efectivo')$$, pg_temp.v('p1')), '22023', 'monto mayor a cero');
select pg_temp.expect_error(format($$select public.register_payment(%L, 100, 'efectivo', now() + interval '3 days')$$, pg_temp.v('p1')), '22023', 'sin fechas futuras');
select set_config('py.x2', (public.register_payment(pg_temp.v('p2'), 300, 'efectivo')).id::text, true);
select pg_temp.assert_true((select folio = 2 and quote_id is null from public.payments where id = pg_temp.v('x2')), 'abono suelto sin presupuesto');

select pg_temp.assert_true(
  (select (a ->> 'paid_total')::numeric = 5000 and (a ->> 'balance')::numeric = 33000 and (a -> 'quotes' -> 0 ->> 'paid')::numeric = 5000
   from (select public.patient_account(pg_temp.v('p1')) as a) x),
  'cuenta del paciente: pagado y saldo');

-- ------------------------------------------------------------- acceso --------
select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(pg_temp.rows('select * from public.payments') = 1, 'el doctor ve los pagos de sus pacientes');
select pg_temp.expect_error(format($$select public.register_payment(%L, 100, 'efectivo')$$, pg_temp.v('p1')), '42501', 'un doctor no registra pagos');
select pg_temp.expect_error(format($$select public.payment_stats(%L, now(), now())$$, pg_temp.v('a')), '42501', 'ni ve los totales de la clínica');
select pg_temp.expect_error(format($$select * from public.receivables(%L)$$, pg_temp.v('a')), '42501', 'ni los saldos de la clínica');
select pg_temp.login_as('doctor2_a');
select pg_temp.assert_true(pg_temp.rows('select * from public.payments') = 0, 'otro doctor no ve pagos ajenos');
select pg_temp.login_as('owner_b');
select pg_temp.assert_true(pg_temp.rows('select * from public.payments') = 0, 'otra clínica no ve pagos');
select pg_temp.expect_error(format($$select public.void_payment(%L, 'x')$$, pg_temp.v('x1')), 'P0002', 'otra clínica no anula');
select pg_temp.login_as('super');
select pg_temp.assert_true(pg_temp.rows('select * from public.payments') = 0, 'el superadmin no ve pagos');

-- ------------------------------------------------------------- anular --------
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.void_payment(%L, 'Error de captura')$$, pg_temp.v('x1')), '42501', 'recepción no anula');
select pg_temp.assert_true(
  (select (s ->> 'month')::numeric = 5300 and (s ->> 'receivable')::numeric = 33000 from (select public.payment_stats(pg_temp.v('a'), now() - interval '1 day', now() - interval '30 days') as s) x),
  'indicadores: cobrado y por cobrar');
select pg_temp.assert_true((select count(*) = 1 and bool_and(balance = 33000) from public.receivables(pg_temp.v('a'))), 'saldos: el paciente con saldo');
select pg_temp.login_as('owner_a');
select pg_temp.expect_error(format($$select public.void_payment(%L, '')$$, pg_temp.v('x1')), '22023', 'anular exige motivo');
select public.void_payment(pg_temp.v('x1'), 'Error de captura');
select pg_temp.assert_true(
  (select (a ->> 'paid_total')::numeric = 0 and (a ->> 'balance')::numeric = 38000 from (select public.patient_account(pg_temp.v('p1')) as a) x),
  'un pago anulado deja de contar');
select pg_temp.expect_error(format($$select public.void_payment(%L, 'otra vez')$$, pg_temp.v('x1')), '22023', 'no se anula dos veces');
select pg_temp.assert_true(
  (select (s ->> 'collected')::numeric = 0 from (select public.quote_stats(pg_temp.v('a'), now() - interval '30 days') as s) x),
  'lo cobrado del Kanban excluye anulados');

-- Sin escritura directa; el CHECK protege aunque se escriba como dueño de la base.
select pg_temp.expect_error(format($$update public.payments set amount = 1 where id = %L$$, pg_temp.v('x2')), '42501', 'sin UPDATE directo');
select pg_temp.expect_error(format($$delete from public.payments where id = %L$$, pg_temp.v('x2')), '42501', 'sin DELETE');
select pg_temp.assert_true(
  (select count(*) >= 3 and bool_and(details - 'method' - 'status' = '{}'::jsonb) from public.audit_logs where entity = 'payment'),
  'auditoría sin montos ni datos del paciente');
select pg_temp.logout();
select pg_temp.expect_error(format($$update public.payments set voided_at = now() where id = %L$$, pg_temp.v('x2')), '23514', 'CHECK: anulado exige motivo');

select 'pagos: todas las pruebas pasaron' as resultado;

rollback;
