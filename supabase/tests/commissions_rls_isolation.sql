-- =============================================================================
-- PRUEBAS · 20261123000100_commissions
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
    when 'owner_a' then 'd1' when 'reception_a' then 'd2' when 'doctor_a' then 'd3' when 'doctor2_a' then 'd4'
    when 'owner_b' then 'd5' when 'super' then 'd6' end)::uuid;
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('cm.' || k)::uuid $$;
-- Periodo de prueba que cubre hoy.
create function pg_temp.f() returns date language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date - 30 $$;
create function pg_temp.t() returns date language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date + 1 $$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.commission_schemes'::regclass, 'public.commission_entries'::regclass, 'public.commission_payouts'::regclass)),
  'RLS habilitada en las tablas de comisiones');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.cm@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba comisiones');

select pg_temp.login_as('owner_a');
select set_config('cm.a', (public.create_tenant('Clínica Comisiones A', 'clinic', 'cm-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('cm.b', (public.create_tenant('Clínica Comisiones B', 'clinic', 'cm-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor_collab'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor');
select set_config('cm.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);
select set_config('cm.d2', (select id::text from public.memberships where user_id = pg_temp.uid('doctor2_a')), true);
select set_config('cm.own', (select id::text from public.memberships where user_id = pg_temp.uid('owner_a')), true);
select set_config('cm.rec', (select id::text from public.memberships where user_id = pg_temp.uid('reception_a')), true);

select pg_temp.login_as('reception_a');
select set_config('cm.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Comisión Uno', 'papel', p_primary_doctor => pg_temp.v('d1'))).id::text, true);
select set_config('cm.p2', (public.create_patient(pg_temp.v('a'), 'Paciente Comisión Dos', 'papel', p_primary_doctor => pg_temp.v('d2'))).id::text, true);
-- Pago ANTES de tener esquema: no genera comisión.
select set_config('cm.x0', (public.register_payment(pg_temp.v('p1'), 700, 'efectivo')).id::text, true);
select pg_temp.logout();
select pg_temp.assert_true((select count(*) = 0 from public.commission_entries where payment_id = pg_temp.v('x0')), 'un pago anterior al esquema no genera comisión');

-- --------------------------------------------------------------- esquemas ----
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.set_commission_scheme(%L, 'percent_collected', 40)$$, pg_temp.v('d1')), 'P0002', 'recepción no define esquemas');
select pg_temp.login_as('doctor_a');
select pg_temp.expect_error(format($$select public.set_commission_scheme(%L, 'percent_collected', 90)$$, pg_temp.v('d1')), 'P0002', 'un doctor no define su esquema');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.set_commission_scheme(%L, 'percent_collected', 40)$$, pg_temp.v('d1')), 'P0002', 'otra clínica no define esquemas');
select pg_temp.login_as('owner_a');
select pg_temp.expect_error(format($$select public.set_commission_scheme(%L, 'percent_collected', 40)$$, pg_temp.v('own')), '22023', 'la dueña no lleva esquema');
select pg_temp.expect_error(format($$select public.set_commission_scheme(%L, 'percent_collected', 40)$$, pg_temp.v('rec')), '22023', 'recepción no lleva esquema');
select pg_temp.expect_error(format($$select public.set_commission_scheme(%L, 'percent_collected', 0)$$, pg_temp.v('d1')), '22023', 'porcentaje mayor a cero');
select pg_temp.expect_error(format($$select public.set_commission_scheme(%L, 'percent_collected', 120)$$, pg_temp.v('d1')), '22023', 'porcentaje hasta 100');
select pg_temp.expect_error(format($$select public.set_commission_scheme(%L, 'chair_rent')$$, pg_temp.v('d2')), '22023', 'la renta exige monto');
select public.set_commission_scheme(pg_temp.v('d1'), 'percent_collected', 40);
select public.set_commission_scheme(pg_temp.v('d2'), 'chair_rent', p_rent => 3000);
select pg_temp.assert_true(
  (select count(*) = 2 from public.commission_schemes where tenant_id = pg_temp.v('a') and ended_at is null),
  'un esquema vigente por doctor');

-- ------------------------------------------------------------- cálculo -------
select pg_temp.login_as('reception_a');
select set_config('cm.x1', (public.register_payment(pg_temp.v('p1'), 5000, 'transferencia')).id::text, true);
select set_config('cm.x2', (public.register_payment(pg_temp.v('p2'), 1000, 'efectivo')).id::text, true);
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  (select amount = 2000 and rate = 40 and base = 5000 and kind = 'comision' and payout_id is null from public.commission_entries where payment_id = pg_temp.v('x1')),
  '40% de lo cobrado');
select pg_temp.assert_true(
  (select amount = 1000 and rate = 100 from public.commission_entries where payment_id = pg_temp.v('x2')),
  'renta: el doctor recibe lo cobrado');

-- Cambiar el esquema no toca lo ya calculado.
select public.set_commission_scheme(pg_temp.v('d1'), 'percent_collected', 50);
select pg_temp.assert_true(
  (select count(*) = 1 from public.commission_schemes where membership_id = pg_temp.v('d1') and ended_at is not null),
  'el esquema anterior se cierra, no se borra');
select pg_temp.login_as('reception_a');
select set_config('cm.x3', (public.register_payment(pg_temp.v('p1'), 1000, 'efectivo')).id::text, true);
select pg_temp.login_as('owner_a');
select pg_temp.assert_true((select amount = 500 from public.commission_entries where payment_id = pg_temp.v('x3')), 'el pago nuevo usa el esquema nuevo');
select pg_temp.assert_true((select amount = 2000 from public.commission_entries where payment_id = pg_temp.v('x1')), 'lo anterior no cambia');

select pg_temp.assert_true(
  (select count(*) = 2
     and bool_and(case when doctor_id = pg_temp.v('d1') then collected = 6700 and commission = 2500 and pending = 2500 and patients = 1 and rent_due = 0
                       else collected = 1000 and commission = 1000 and rent_due = 3000 end)
   from public.commission_summary(pg_temp.v('a'), pg_temp.f(), pg_temp.t())),
  'resumen del periodo para la gerencia');
select pg_temp.assert_true(
  (select (l ->> 'total')::int = 2 and l -> 'rows' -> 0 ->> 'patient' = 'Paciente Comisión Uno'
   from (select public.commission_lines(pg_temp.v('d1'), pg_temp.f(), pg_temp.t()) as l) x),
  'detalle con el paciente');
select pg_temp.expect_error(format($$select public.commission_summary(%L, %L, %L)$$, pg_temp.v('a'), pg_temp.t(), pg_temp.f()), '22023', 'periodo al revés');

-- ------------------------------------------------------------- acceso --------
select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(doctor_id = pg_temp.v('d1')) from public.commission_summary(pg_temp.v('a'), pg_temp.f(), pg_temp.t())),
  'el doctor solo ve su fila');
select pg_temp.assert_true(pg_temp.rows('select * from public.commission_entries') = 2, 'el doctor ve sus comisiones');
select pg_temp.assert_true(pg_temp.rows('select * from public.commission_schemes') = 2, 'y sus esquemas');
select pg_temp.expect_error(format($$select public.commission_lines(%L, %L, %L)$$, pg_temp.v('d2'), pg_temp.f(), pg_temp.t()), 'P0002', 'ni el detalle de otro doctor');
select pg_temp.expect_error(format($$select public.pay_commissions(%L, %L, %L)$$, pg_temp.v('d1'), pg_temp.f(), pg_temp.t()), 'P0002', 'un doctor no se paga a sí mismo');
select pg_temp.login_as('doctor2_a');
select pg_temp.assert_true(pg_temp.rows('select * from public.commission_entries') = 1, 'otro doctor solo ve lo suyo');
select pg_temp.login_as('reception_a');
select pg_temp.assert_true(pg_temp.rows(format('select * from public.commission_summary(%L, %L, %L)', pg_temp.v('a'), pg_temp.f(), pg_temp.t())) = 0, 'recepción no ve comisiones');
select pg_temp.assert_true(pg_temp.rows('select * from public.commission_entries') + pg_temp.rows('select * from public.commission_schemes') = 0, 'ni las tablas');
select pg_temp.expect_error(format($$select public.pay_commissions(%L, %L, %L)$$, pg_temp.v('d1'), pg_temp.f(), pg_temp.t()), 'P0002', 'recepción no paga comisiones');
select pg_temp.expect_error(format($$select public.set_commission_period(%L, 'mensual')$$, pg_temp.v('a')), '42501', 'recepción no cambia el periodo');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.commission_summary(%L, %L, %L)$$, pg_temp.v('a'), pg_temp.f(), pg_temp.t()), '42501', 'otra clínica no ve el resumen');
select pg_temp.assert_true(pg_temp.rows('select * from public.commission_entries') = 0, 'otra clínica no ve comisiones');
select pg_temp.expect_error(format($$select public.pay_commissions(%L, %L, %L)$$, pg_temp.v('d1'), pg_temp.f(), pg_temp.t()), 'P0002', 'otra clínica no paga');
select pg_temp.login_as('super');
select pg_temp.expect_error(format($$select public.commission_summary(%L, %L, %L)$$, pg_temp.v('a'), pg_temp.f(), pg_temp.t()), '42501', 'el superadmin no ve el resumen');
select pg_temp.assert_true(pg_temp.rows('select * from public.commission_entries') + pg_temp.rows('select * from public.commission_payouts') = 0, 'ni las comisiones');

-- ------------------------------------------------------- anular y pagar ------
select pg_temp.login_as('owner_a');
select public.void_payment(pg_temp.v('x3'), 'Error de captura');
select pg_temp.assert_true((select voided_at is not null from public.commission_entries where payment_id = pg_temp.v('x3')), 'pago anulado sin pagar: su comisión se anula');

select set_config('cm.po1', (public.pay_commissions(pg_temp.v('d1'), pg_temp.f(), pg_temp.t(), 'Transferencia')).id::text, true);
select pg_temp.assert_true(
  (select commissions = 2000 and rent = 0 and total = 2000 from public.commission_payouts where id = pg_temp.v('po1')),
  'el pago al doctor suma lo pendiente sin lo anulado');
select pg_temp.assert_true(
  (select payout_id = pg_temp.v('po1') from public.commission_entries where payment_id = pg_temp.v('x1')),
  'las comisiones quedan pagadas');
select pg_temp.expect_error(format($$select public.pay_commissions(%L, %L, %L)$$, pg_temp.v('d1'), pg_temp.f(), pg_temp.t()), '22023', 'no se paga dos veces');

select public.void_payment(pg_temp.v('x1'), 'Devolución');
select pg_temp.assert_true(
  (select amount = -2000 and base = -5000 and payout_id is null and voided_at is null from public.commission_entries where payment_id = pg_temp.v('x1') and kind = 'ajuste'),
  'pago anulado ya pagado: ajuste negativo');
select pg_temp.assert_true(
  (select payout_id is not null and voided_at is null from public.commission_entries where payment_id = pg_temp.v('x1') and kind = 'comision'),
  'la comisión pagada no se toca');
select pg_temp.assert_true(
  (select pending = -2000 and paid = 2000 from public.commission_summary(pg_temp.v('a'), pg_temp.f(), pg_temp.t()) where doctor_id = pg_temp.v('d1')),
  'el ajuste queda por descontar');

-- Renta: se descuenta una vez por periodo.
select set_config('cm.po2', (public.pay_commissions(pg_temp.v('d2'), pg_temp.f(), pg_temp.t())).id::text, true);
select pg_temp.assert_true(
  (select commissions = 1000 and rent = 3000 and total = -2000 from public.commission_payouts where id = pg_temp.v('po2')),
  'renta: lo cobrado menos la renta (a favor de la clínica)');
select pg_temp.assert_true(
  (select rent_due = 0 from public.commission_summary(pg_temp.v('a'), pg_temp.f(), pg_temp.t()) where doctor_id = pg_temp.v('d2')),
  'la renta del periodo ya se cobró');
select pg_temp.expect_error(format($$select public.pay_commissions(%L, %L, %L)$$, pg_temp.v('d2'), pg_temp.f(), pg_temp.t()), '22023', 'la renta no se cobra dos veces');

-- Periodo de la clínica.
select pg_temp.expect_error(format($$select public.set_commission_period(%L, 'semanal')$$, pg_temp.v('a')), '22023', 'solo quincenal o mensual');
select public.set_commission_period(pg_temp.v('a'), 'mensual');
select pg_temp.assert_true((select commission_period = 'mensual' from public.tenants where id = pg_temp.v('a')), 'periodo mensual guardado');
select public.set_commission_scheme(pg_temp.v('d2'));
select pg_temp.assert_true(
  (select count(*) = 0 from public.commission_schemes where membership_id = pg_temp.v('d2') and ended_at is null),
  'sin comisión: se cierra el esquema');

-- Sin escritura directa; los CHECK protegen aunque se escriba como dueño de la base.
select pg_temp.expect_error(format($$insert into public.commission_entries (tenant_id, doctor_id, payment_id, base, rate, amount, period_date) values (%L, %L, %L, 1, 1, 1, current_date)$$, pg_temp.v('a'), pg_temp.v('d1'), pg_temp.v('x2')), '42501', 'sin INSERT directo');
select pg_temp.expect_error(format($$update public.commission_entries set amount = 1 where payment_id = %L$$, pg_temp.v('x2')), '42501', 'sin UPDATE directo');
select pg_temp.expect_error('delete from public.commission_payouts', '42501', 'sin DELETE');
select pg_temp.assert_true(
  (select count(*) >= 5 and bool_and(details - 'kind' - 'period' = '{}'::jsonb) from public.audit_logs where action like 'commission.%'),
  'auditoría sin montos ni datos del paciente');
select pg_temp.logout();
select pg_temp.expect_error(format($$update public.commission_entries set voided_at = now() where payment_id = %L and kind = 'comision'$$, pg_temp.v('x1')), '23514', 'CHECK: una comisión pagada no se anula');
select pg_temp.expect_error(format($$update public.commission_schemes set percent = 150 where membership_id = %L and ended_at is null$$, pg_temp.v('d1')), '23514', 'CHECK: porcentaje hasta 100');

select 'comisiones: todas las pruebas pasaron' as resultado;

rollback;
