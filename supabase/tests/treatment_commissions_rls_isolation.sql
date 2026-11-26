-- =============================================================================
-- PRUEBAS · 20261126000100_treatment_commissions (comisión por tratamiento, M6-C1)
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('tc.' || k)::uuid $$;
create function pg_temp.seen(k text, p_sql text) returns int language plpgsql as $$
declare n int;
begin
  perform pg_temp.login_as(k);
  execute p_sql into n;
  perform pg_temp.logout();
  return n;
end $$;
-- Movimientos vigentes de un pago: [tratamiento o «general»] base rate monto [fijo].
create function pg_temp.parts(p_payment text) returns text language sql stable as $$
  select string_agg(coalesce(t.name, 'general') || ' ' || e.base || ' ' || e.rate || ' ' || e.amount || coalesce(' fijo ' || e.fixed_amount, ''),
    ' | ' order by coalesce(t.name, 'zzz'))
  from public.commission_entries e
  left join public.treatments t on t.id = e.treatment_id
  where e.payment_id = pg_temp.v(p_payment) and e.voided_at is null and e.kind = 'comision'
$$;
create function pg_temp.pay(p_key text, p_folio int, p_quote text, p_amount numeric) returns void language plpgsql as $$
begin
  insert into public.payments (tenant_id, folio, patient_id, quote_id, doctor_id, amount, method)
  values (pg_temp.v('a'), p_folio, pg_temp.v('p1'), case when p_quote is null then null else pg_temp.v(p_quote) end, pg_temp.v('d1'), p_amount, 'efectivo');
  perform set_config('tc.' || p_key, (select id::text from public.payments where tenant_id = pg_temp.v('a') and folio = p_folio), true);
end $$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.set_treatment_commission(uuid,uuid,numeric,numeric)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.set_treatment_commission(uuid,uuid,numeric,numeric)', 'EXECUTE')
  and not has_table_privilege('authenticated', 'public.commission_treatment_rules', 'INSERT')
  and not has_table_privilege('authenticated', 'public.commission_treatment_rules', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.commission_treatment_rules', 'DELETE'),
  'las excepciones solo se escriben por RPC');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.tc@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba comisión por tratamiento');

select pg_temp.login_as('owner_a');
select set_config('tc.a', (public.create_tenant('Clínica Tratamientos A', 'clinic', 'tc-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('tc.b', (public.create_tenant('Clínica Tratamientos B', 'clinic', 'tc-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor_collab');
select set_config('tc.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);
select set_config('tc.d2', (select id::text from public.memberships where user_id = pg_temp.uid('doctor2_a')), true);
insert into public.treatments (tenant_id, category, name, price_mxn) values
  (pg_temp.v('a'), 'implantes', 'Implante', 8000),
  (pg_temp.v('a'), 'preventiva', 'Limpieza', 2000),
  (pg_temp.v('a'), 'restauracion', 'Corona', 3000),
  (pg_temp.v('b'), 'implantes', 'Implante B', 8000);
select set_config('tc.imp', (select id::text from public.treatments where tenant_id = pg_temp.v('a') and name = 'Implante'), true);
select set_config('tc.lim', (select id::text from public.treatments where tenant_id = pg_temp.v('a') and name = 'Limpieza'), true);
select set_config('tc.cor', (select id::text from public.treatments where tenant_id = pg_temp.v('a') and name = 'Corona'), true);
select set_config('tc.impb', (select id::text from public.treatments where tenant_id = pg_temp.v('b')), true);

select pg_temp.login_as('reception_a');
select set_config('tc.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Tratamiento Uno', 'papel', p_primary_doctor => pg_temp.v('d1'))).id::text, true);
select pg_temp.login_as('owner_a');
select public.set_commission_scheme(pg_temp.v('d1'), 'percent_collected', 40);
select public.set_commission_scheme(pg_temp.v('d2'), 'chair_rent', p_rent => 3000);
select pg_temp.logout();

-- --------------------------------------------------- permisos y validación ----
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 30)$$, pg_temp.v('d1'), pg_temp.v('imp')), 'P0002', 'recepción no pone excepciones');
select pg_temp.login_as('doctor_a');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 90)$$, pg_temp.v('d1'), pg_temp.v('imp')), 'P0002', 'un doctor no se pone su comisión');
select pg_temp.login_as('doctor2_a');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 30)$$, pg_temp.v('d1'), pg_temp.v('imp')), 'P0002', 'un colaborador no pone la de otro');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 30)$$, pg_temp.v('d1'), pg_temp.v('imp')), 'P0002', 'otra clínica no pone excepciones');
select pg_temp.login_as('super');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 30)$$, pg_temp.v('d1'), pg_temp.v('imp')), 'P0002', 'el superadmin no pone excepciones');

select pg_temp.login_as('owner_a');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 30, 500)$$, pg_temp.v('d1'), pg_temp.v('imp')), '22023', 'porcentaje o monto, no los dos');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 0)$$, pg_temp.v('d1'), pg_temp.v('imp')), '22023', 'porcentaje mayor a cero');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 101)$$, pg_temp.v('d1'), pg_temp.v('imp')), '22023', 'porcentaje hasta 100');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, null, -5)$$, pg_temp.v('d1'), pg_temp.v('imp')), '22023', 'monto positivo');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 30)$$, pg_temp.v('d2'), pg_temp.v('imp')), '22023', 'con renta no hay excepciones');
select pg_temp.expect_error(format($$select public.set_treatment_commission(%L, %L, 30)$$, pg_temp.v('d1'), pg_temp.v('impb')), 'P0002', 'tratamiento de otra clínica');
select public.set_treatment_commission(pg_temp.v('d1'), pg_temp.v('imp'), 25);
select public.set_treatment_commission(pg_temp.v('d1'), pg_temp.v('imp'), 30);
select public.set_treatment_commission(pg_temp.v('d1'), pg_temp.v('cor'), null, 1500);
select pg_temp.logout();
select pg_temp.assert_true((select count(*) = 2 and bool_and(membership_id = pg_temp.v('d1')) from public.commission_treatment_rules),
  'una excepción por tratamiento (la segunda reemplaza a la primera)');
select pg_temp.assert_true((select percent = 30 from public.commission_treatment_rules where treatment_id = pg_temp.v('imp')), 'se guarda el último %');

select pg_temp.assert_true(pg_temp.seen('owner_a', 'select count(*) from public.commission_treatment_rules') = 2, 'la dueña ve las excepciones');
select pg_temp.assert_true(pg_temp.seen('doctor_a', 'select count(*) from public.commission_treatment_rules') = 2, 'el doctor ve las suyas');
select pg_temp.assert_true(pg_temp.seen('doctor2_a', 'select count(*) from public.commission_treatment_rules') = 0, 'otro doctor no las ve');
select pg_temp.assert_true(pg_temp.seen('reception_a', 'select count(*) from public.commission_treatment_rules') = 0, 'recepción no las ve');
select pg_temp.assert_true(pg_temp.seen('owner_b', 'select count(*) from public.commission_treatment_rules') = 0, 'otra clínica no las ve');
select pg_temp.assert_true(pg_temp.seen('super', 'select count(*) from public.commission_treatment_rules') = 0, 'el superadmin no las ve');

-- ------------------------------------------------------------------ cálculo ----
insert into public.quotes (tenant_id, folio, patient_id, doctor_id, status, total) values
  (pg_temp.v('a'), 1, pg_temp.v('p1'), pg_temp.v('d1'), 'aceptado', 10000),
  (pg_temp.v('a'), 2, pg_temp.v('p1'), pg_temp.v('d1'), 'aceptado', 6000),
  (pg_temp.v('a'), 3, pg_temp.v('p1'), pg_temp.v('d1'), 'aceptado', 8000);
select set_config('tc.q1', (select id::text from public.quotes where tenant_id = pg_temp.v('a') and folio = 1), true);
select set_config('tc.q2', (select id::text from public.quotes where tenant_id = pg_temp.v('a') and folio = 2), true);
select set_config('tc.q3', (select id::text from public.quotes where tenant_id = pg_temp.v('a') and folio = 3), true);
insert into public.quote_items (tenant_id, quote_id, position, treatment_id, concept, quantity, unit_price) values
  (pg_temp.v('a'), pg_temp.v('q1'), 0, pg_temp.v('imp'), 'Implante', 1, 8000),
  (pg_temp.v('a'), pg_temp.v('q1'), 1, pg_temp.v('lim'), 'Limpieza', 1, 2000),
  -- Dos coronas, una limpieza y un descuento de 1,000: total 6,000.
  (pg_temp.v('a'), pg_temp.v('q2'), 0, pg_temp.v('cor'), 'Corona', 2, 3000),
  (pg_temp.v('a'), pg_temp.v('q2'), 1, pg_temp.v('lim'), 'Limpieza', 1, 1000),
  (pg_temp.v('a'), pg_temp.v('q2'), 2, null, 'Descuento', 1, -1000),
  (pg_temp.v('a'), pg_temp.v('q3'), 0, pg_temp.v('imp'), 'Implante', 1, 8000);

select pg_temp.pay('x1', 1, 'q1', 1000);
select pg_temp.assert_true(pg_temp.parts('x1') = 'Implante 800.00 30.00 240.00 | general 200.00 40.00 80.00',
  'reparto proporcional: implante al 30% y limpieza al 40% general (' || coalesce(pg_temp.parts('x1'), 'nada') || ')');

select pg_temp.pay('x2', 2, 'q2', 3000);
select pg_temp.assert_true(pg_temp.parts('x2') = 'Corona 2571.43 0.00 1500.00 fijo 1500.00 | general 428.57 40.00 171.43',
  'monto fijo conforme se cobra y descuento repartido (' || coalesce(pg_temp.parts('x2'), 'nada') || ')');

select pg_temp.pay('x3', 3, 'q3', 1000);
select pg_temp.assert_true(pg_temp.parts('x3') = 'Implante 1000.00 30.00 300.00', 'todo con excepción: sin parte general');

select pg_temp.pay('x4', 4, null, 500);
select pg_temp.assert_true(pg_temp.parts('x4') = 'general 500.00 40.00 200.00', 'sin presupuesto: % general');

select pg_temp.assert_true((select sum(base) = 1000 from public.commission_entries where payment_id = pg_temp.v('x1')), 'las partes suman el abono');

-- ------------------------------------------------------------ anulaciones ----
update public.payments set voided_at = now(), void_reason = 'Prueba' where id = pg_temp.v('x1');
select pg_temp.assert_true((select count(*) = 2 and bool_and(voided_at is not null) from public.commission_entries where payment_id = pg_temp.v('x1')),
  'al anular se anulan todas las partes');

select pg_temp.login_as('owner_a');
select public.pay_commissions(pg_temp.v('d1'), current_date - 1, current_date + 1);
select pg_temp.logout();
update public.payments set voided_at = now(), void_reason = 'Prueba' where id = pg_temp.v('x2');
select pg_temp.assert_true((select count(*) = 2 and sum(amount) = -1671.43 and count(treatment_id) = 1 and count(fixed_amount) = 1
  from public.commission_entries where payment_id = pg_temp.v('x2') and kind = 'ajuste'),
  'ya pagadas: un ajuste por parte, con su regla');

-- ----------------------------------------------- quitar y con otro esquema ----
select pg_temp.login_as('owner_a');
select public.set_treatment_commission(pg_temp.v('d1'), pg_temp.v('imp'));
select pg_temp.logout();
select pg_temp.assert_true((select count(*) = 1 from public.commission_treatment_rules), 'quitar la excepción');
select pg_temp.pay('x5', 5, 'q1', 1000);
select pg_temp.assert_true(pg_temp.parts('x5') = 'general 1000.00 40.00 400.00', 'sin excepción vuelve al % general');
select pg_temp.assert_true(pg_temp.parts('x3') = 'Implante 1000.00 30.00 300.00', 'lo ya generado no cambia');

select pg_temp.login_as('owner_a');
select public.set_commission_scheme(pg_temp.v('d1'), 'chair_rent', p_rent => 2000);
select pg_temp.logout();
select pg_temp.pay('x6', 6, 'q2', 600);
select pg_temp.assert_true(pg_temp.parts('x6') = 'general 600.00 100.00 600.00', 'con renta se ignoran las excepciones');

-- -------------------------------------------------- movimientos y auditoría ----
select pg_temp.login_as('doctor_a');
select pg_temp.assert_true((select count(*) >= 1 from jsonb_array_elements(public.commission_lines(pg_temp.v('d1'), current_date - 1, current_date + 1) -> 'rows') r
  where r ->> 'treatment' = 'Implante' and (r ->> 'rate')::numeric = 30), 'los movimientos dicen el tratamiento');
select pg_temp.logout();
select pg_temp.assert_true((select count(*) >= 4 and bool_and(details - 'kind' = '{}'::jsonb) from public.audit_logs where action = 'commission.treatment_rule_set'),
  'auditoría sin montos');

select 'comisión por tratamiento: todas las pruebas pasaron' as resultado;
rollback;
