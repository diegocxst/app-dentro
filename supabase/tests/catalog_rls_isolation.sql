-- =============================================================================
-- PRUEBAS · 20261116000200_chairs_treatments (sillones y tratamientos)
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
  select ('00000000-0000-4000-8000-0000000000' || case k when 'owner_a' then '91' when 'reception_a' then '92' when 'owner_b' then '93' end)::uuid;
$$;

create function pg_temp.login_as(k text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(k), 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.c(k text) returns uuid language sql stable as $$ select current_setting('cat.' || k)::uuid $$;

select pg_temp.assert_true(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.chairs'::regclass, 'public.treatments'::regclass)),
  'RLS habilitada en chairs y treatments');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.cat@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'owner_b']) as k;

select pg_temp.login_as('owner_a');
select set_config('cat.a', (public.create_tenant('Clínica Catálogo A', 'clinic', 'cat-test-a')).id::text, true);
select set_config('cat.branch_a', (select id::text from public.branches where tenant_id = pg_temp.c('a')), true);
select pg_temp.login_as('owner_b');
select set_config('cat.b', (public.create_tenant('Clínica Catálogo B', 'clinic', 'cat-test-b')).id::text, true);
select set_config('cat.branch_b', (select id::text from public.branches where tenant_id = pg_temp.c('b')), true);
select set_config('role', 'none', true);
insert into public.memberships (tenant_id, user_id, role) values (pg_temp.c('a'), pg_temp.uid('reception_a'), 'reception');

-- ---------------------------------------------------------------- sillones ----
select pg_temp.login_as('owner_a');
select set_config('cat.chair1', (public.create_chair(pg_temp.c('branch_a'), 'Sillón 1')).id::text, true);
select public.create_chair(pg_temp.c('branch_a'), 'Sillón 2');
select pg_temp.expect_error(format($$select public.create_chair(%L, ' sillón 1 ')$$, pg_temp.c('branch_a')), '23505', 'no se repite el nombre del sillón en la sucursal');
select pg_temp.expect_error(format($$select public.create_chair(%L, 'Intruso')$$, pg_temp.c('branch_b')), '42501', 'no crea sillones en otra clínica');
select public.update_chair(pg_temp.c('chair1'), p_is_active => false);
select pg_temp.assert_true((select not is_active from public.chairs where id = pg_temp.c('chair1')), 'desactiva un sillón');
select pg_temp.expect_error(
  format($$insert into public.chairs (tenant_id, branch_id, name) values (%L, %L, 'x')$$, pg_temp.c('a'), pg_temp.c('branch_a')),
  '42501', 'sin INSERT directo en chairs');
select set_config('role', 'none', true);
select pg_temp.expect_error(
  format($$insert into public.chairs (tenant_id, branch_id, name) values (%L, %L, 'Cruzado')$$, pg_temp.c('a'), pg_temp.c('branch_b')),
  '23503', 'FK compuesta: un sillón de A no puede ir en una sucursal de B');

-- ------------------------------------------------------------ tratamientos ----
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  public.save_treatments(pg_temp.c('a'), '[
    {"category":"preventiva","name":"Limpieza dental","price_mxn":850,"duration_minutes":45},
    {"category":"ortodoncia","name":"Ortodoncia con brackets","price_mxn":28000,"duration_minutes":null}
  ]'::jsonb) = 2,
  'guarda varios tratamientos a la vez');
select set_config('cat.t1', (select id::text from public.treatments where tenant_id = pg_temp.c('a') and name = 'Limpieza dental'), true);
select public.save_treatments(pg_temp.c('a'), jsonb_build_array(jsonb_build_object(
  'id', pg_temp.c('t1'), 'category', 'preventiva', 'name', 'Limpieza dental', 'price_mxn', 900, 'duration_minutes', 45, 'is_active', false)));
select pg_temp.assert_true(
  (select price_mxn = 900 and not is_active from public.treatments where id = pg_temp.c('t1')),
  'actualiza precio y lo desactiva');
select pg_temp.expect_error(format($$select public.save_treatments(%L, '[{"category":"preventiva","name":"limpieza DENTAL","price_mxn":1}]')$$, pg_temp.c('a')),
  '23505', 'no se repite el nombre del tratamiento');
select pg_temp.expect_error(format($$select public.save_treatments(%L, '[{"category":"magia","name":"Otro","price_mxn":1}]')$$, pg_temp.c('a')),
  '23514', 'la categoría debe ser válida');
select pg_temp.expect_error(format($$select public.save_treatments(%L, '[{"category":"otros","name":"Negativo","price_mxn":-5}]')$$, pg_temp.c('a')),
  '23514', 'el precio no puede ser negativo');
select pg_temp.expect_error(format($$select public.save_treatments(%L, '[{"category":"otros","name":"Bien","price_mxn":10},{"category":"otros","name":"Mal","price_mxn":-1}]')$$, pg_temp.c('a')),
  '23514', 'todo o nada: un elemento malo no guarda ninguno');
select pg_temp.assert_true((select count(*) = 0 from public.treatments where name = 'Bien'), 'tras el error no quedó guardado el elemento bueno');

select pg_temp.login_as('owner_b');
select pg_temp.expect_error(
  format($$select public.save_treatments(%L, jsonb_build_array(jsonb_build_object('id', %L, 'category', 'otros', 'name', 'Robado', 'price_mxn', 1)))$$, pg_temp.c('b'), pg_temp.c('t1')),
  'P0002', 'no edita tratamientos de otra clínica desde la suya');
select pg_temp.expect_error(format($$select public.save_treatments(%L, '[]')$$, pg_temp.c('a')), '42501', 'no guarda en otra clínica');
select pg_temp.assert_true((select count(*) = 0 from public.treatments where tenant_id = pg_temp.c('a')), 'otra clínica no ve el catálogo de A');
select pg_temp.assert_true((select count(*) = 0 from public.chairs where tenant_id = pg_temp.c('a')), 'otra clínica no ve los sillones de A');

-- ------------------------------------------------------------- recepción ------
select pg_temp.login_as('reception_a');
select pg_temp.assert_true((select count(*) = 2 from public.treatments where tenant_id = pg_temp.c('a')), 'recepción ve el catálogo (para presupuestos)');
select pg_temp.assert_true((select count(*) = 2 from public.chairs where tenant_id = pg_temp.c('a')), 'recepción ve los sillones (para la agenda)');
select pg_temp.expect_error(format($$select public.save_treatments(%L, '[]')$$, pg_temp.c('a')), '42501', 'recepción no cambia precios');
select pg_temp.expect_error(format($$select public.create_chair(%L, 'Sillón 3')$$, pg_temp.c('branch_a')), '42501', 'recepción no crea sillones');

select set_config('role', 'none', true);
select 'catálogo: todas las pruebas pasaron' as resultado;

rollback;
