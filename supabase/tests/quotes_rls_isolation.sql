-- =============================================================================
-- PRUEBAS · 20261118000100_quotes
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
    when 'owner_a' then 'b1' when 'reception_a' then 'b2' when 'doctor_a' then 'b3' when 'doctor2_a' then 'b4'
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('qt.' || k)::uuid $$;
create function pg_temp.items(p_price numeric, p_disc numeric default 0) returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_object('concept', 'Alineadores transparentes', 'quantity', 1, 'unit_price', p_price),
    jsonb_build_object('concept', 'Limpieza previa', 'quantity', 2, 'unit_price', 850)
  ) || case when p_disc <> 0 then jsonb_build_array(jsonb_build_object('concept', 'Descuento', 'quantity', 1, 'unit_price', -p_disc)) else '[]'::jsonb end
$$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class where oid in ('public.quotes'::regclass, 'public.quote_items'::regclass)), 'RLS habilitada en presupuestos y partidas');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.qt@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba presupuestos');

select pg_temp.login_as('owner_a');
select set_config('qt.a', (public.create_tenant('Clínica Presupuestos A', 'clinic', 'qt-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('qt.b', (public.create_tenant('Clínica Presupuestos B', 'clinic', 'qt-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor');
select set_config('qt.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);
select set_config('qt.d2', (select id::text from public.memberships where user_id = pg_temp.uid('doctor2_a')), true);

select pg_temp.login_as('reception_a');
select set_config('qt.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Presupuesto Uno', 'papel', p_primary_doctor => pg_temp.v('d1'))).id::text, true);
select set_config('qt.p2', (public.create_patient(pg_temp.v('a'), 'Paciente Presupuesto Dos', 'papel')).id::text, true);

-- ------------------------------------------------------------- crear ---------
select set_config('qt.q1', (public.save_quote(null, pg_temp.v('p1'), pg_temp.v('d1'), pg_temp.items(34500, 850), 'Ortodoncia invisible', 5000, 12)).id::text, true);
select pg_temp.assert_true(
  (select folio = 1 and status = 'borrador' and total = 35350 and down_payment = 5000 and installments = 12 and valid_until = current_date + 30
   from public.quotes where id = pg_temp.v('q1')),
  'folio 1, borrador, total con descuento (34,500 + 2×850 − 850) y plan de pagos');
select pg_temp.assert_true((select count(*) = 3 from public.quote_items where quote_id = pg_temp.v('q1')), 'guarda las partidas');
select set_config('qt.q2', (public.save_quote(null, pg_temp.v('p2'), null, pg_temp.items(1000), 'Limpieza', 999, 0)).id::text, true);
select pg_temp.assert_true((select folio = 2 and down_payment = 0 from public.quotes where id = pg_temp.v('q2')), 'folio consecutivo; de contado no hay anticipo');
select pg_temp.expect_error(format($$select public.save_quote(null, %L, null, '[]')$$, pg_temp.v('p1')), '22023', 'sin partidas no hay presupuesto');
select pg_temp.expect_error(format($$select public.save_quote(null, %L, null, %L)$$, pg_temp.v('p1'), pg_temp.items(100, 5000)), '22023', 'el total no puede ser negativo');
select pg_temp.expect_error(format($$select public.save_quote(null, %L, null, %L, '', 999999, 6)$$, pg_temp.v('p1'), pg_temp.items(1000)), '22023', 'el anticipo no supera el total');

-- Editar reemplaza las partidas y recalcula el total.
select public.save_quote(pg_temp.v('q1'), pg_temp.v('p1'), pg_temp.v('d1'), pg_temp.items(30000), 'Ortodoncia invisible', 5000, 18);
select pg_temp.assert_true((select total = 31700 and installments = 18 from public.quotes where id = pg_temp.v('q1')), 'editar recalcula el total');
select pg_temp.assert_true((select count(*) = 2 from public.quote_items where quote_id = pg_temp.v('q1')), 'y reemplaza las partidas');
select pg_temp.expect_error(format($$select public.save_quote(%L, %L, null, %L)$$, pg_temp.v('q1'), pg_temp.v('p2'), pg_temp.items(1000)), '22023', 'no se cambia el paciente');

-- ------------------------------------------------------------- doctores ------
select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(pg_temp.rows('select * from public.quotes') = 1, 'el doctor ve solo los presupuestos de sus pacientes');
select pg_temp.assert_true(pg_temp.rows('select * from public.quote_items') = 2, 'y solo esas partidas');
select set_config('qt.q3', (public.save_quote(null, pg_temp.v('p1'), pg_temp.v('d2'), pg_temp.items(5000))).id::text, true);
select pg_temp.assert_true((select doctor_id = pg_temp.v('d1') from public.quotes where id = pg_temp.v('q3')), 'el doctor queda como doctor de su presupuesto');
select pg_temp.expect_error(format($$select public.save_quote(null, %L, null, %L)$$, pg_temp.v('p2'), pg_temp.items(1000)), 'P0002', 'no hace presupuestos de pacientes ajenos');
select pg_temp.expect_error(format($$select public.set_quote_status(%L, 'presentado')$$, pg_temp.v('q2')), 'P0002', 'ni los mueve');

select pg_temp.login_as('doctor2_a');
select pg_temp.assert_true(pg_temp.rows('select * from public.quotes') = 0, 'otro doctor no ve presupuestos ajenos');
select pg_temp.login_as('owner_b');
select pg_temp.assert_true(pg_temp.rows('select * from public.quotes') = 0, 'otra clínica no ve presupuestos');
select pg_temp.expect_error(format($$select public.set_quote_status(%L, 'presentado')$$, pg_temp.v('q1')), 'P0002', 'otra clínica no los mueve');
select pg_temp.login_as('super');
select pg_temp.assert_true(pg_temp.rows('select * from public.quotes') = 0, 'el superadmin no ve presupuestos');

-- ------------------------------------------------------------- etapas --------
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.set_quote_status(%L, 'aceptado')$$, pg_temp.v('q1')), '22023', 'un borrador no se acepta sin presentarlo');
select public.set_quote_status(pg_temp.v('q1'), 'presentado');
select pg_temp.assert_true((select sent_at is not null from public.quotes where id = pg_temp.v('q1')), 'presentar guarda la fecha de envío');
select public.set_quote_status(pg_temp.v('q1'), 'en_duda');
select public.mark_quote_followup(pg_temp.v('q1'));
select pg_temp.assert_true((select last_followup_at is not null from public.quotes where id = pg_temp.v('q1')), 'registra el seguimiento');
select public.set_quote_status(pg_temp.v('q1'), 'aceptado');
select pg_temp.expect_error(format($$select public.save_quote(%L, %L, null, %L)$$, pg_temp.v('q1'), pg_temp.v('p1'), pg_temp.items(1)), '22023', 'un presupuesto aceptado ya no se edita');
select public.set_quote_status(pg_temp.v('q1'), 'en_tratamiento');
select public.set_quote_status(pg_temp.v('q1'), 'terminado');
select pg_temp.expect_error(format($$select public.set_quote_status(%L, 'perdido', 'x')$$, pg_temp.v('q1')), '22023', 'uno terminado no se pierde');
select pg_temp.expect_error(format($$select public.set_quote_status(%L, 'perdido')$$, pg_temp.v('q2')), '22023', 'perdido exige motivo');
select public.set_quote_status(pg_temp.v('q2'), 'perdido', 'Eligió otra clínica');
select public.set_quote_status(pg_temp.v('q2'), 'presentado');
select pg_temp.assert_true((select status = 'presentado' and lost_reason is null from public.quotes where id = pg_temp.v('q2')), 'reabrir limpia el motivo');

select pg_temp.assert_true(
  (select (s ->> 'won')::int = 1 and (s ->> 'decided')::int = 1 and (s ->> 'avg_ticket')::numeric = 31700
   from (select public.quote_stats(pg_temp.v('a'), now() - interval '30 days') as s) x),
  'indicadores: aceptados, decididos y ticket promedio');

-- Sin escritura directa; los CHECK protegen aunque se escriba como dueño de la base.
select pg_temp.expect_error(format($$update public.quotes set total = 1 where id = %L$$, pg_temp.v('q1')), '42501', 'sin UPDATE directo');
select pg_temp.expect_error(format($$delete from public.quotes where id = %L$$, pg_temp.v('q1')), '42501', 'sin DELETE');
select pg_temp.logout();
select pg_temp.expect_error(format($$update public.quotes set status = 'perdido', lost_reason = null where id = %L$$, pg_temp.v('q2')), '23514', 'CHECK: perdido exige motivo');
select pg_temp.expect_error(format($$update public.quotes set down_payment = total + 1 where id = %L$$, pg_temp.v('q1')), '23514', 'CHECK: anticipo ≤ total');

-- Auditoría sin montos ni datos del paciente.
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  (select count(*) >= 5 and bool_and(details - 'status' = '{}'::jsonb) from public.audit_logs where entity = 'quote'),
  'auditoría sin montos ni datos del paciente');

select pg_temp.logout();
select 'presupuestos: todas las pruebas pasaron' as resultado;

rollback;
