-- =============================================================================
-- PRUEBAS · 20261116000600_arco (DATOS DE SALUD)
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
    when 'owner_a' then 'd1' when 'reception_a' then 'd2' when 'doctor_a' then 'd3' when 'admin_a' then 'd4'
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('arco.' || k)::uuid $$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true((select relrowsecurity from pg_class where oid = 'public.arco_requests'::regclass), 'RLS habilitada en solicitudes ARCO');
select pg_temp.assert_true(private.add_business_days(date '2026-11-13', 20) = date '2026-12-11', '20 días hábiles desde un viernes');
select pg_temp.assert_true(private.add_business_days(date '2026-11-14', 1) = date '2026-11-16', 'un sábado + 1 hábil = lunes');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.arco@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'admin_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba arco');
select set_config('arco.due', private.add_business_days(current_date, 20)::text, true);

select pg_temp.login_as('owner_a');
select set_config('arco.a', (public.create_tenant('Clínica Arco A', 'clinic', 'arco-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('arco.b', (public.create_tenant('Clínica Arco B', 'clinic', 'arco-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor'),
  (pg_temp.v('a'), pg_temp.uid('admin_a'), 'admin');
select set_config('arco.m_doctor', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);

select pg_temp.login_as('reception_a');
select set_config('arco.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Arco Uno', 'papel', p_primary_doctor => pg_temp.v('m_doctor'))).id::text, true);
select public.add_patient_note(pg_temp.v('p1'), 'Nota clínica ficticia');

-- ------------------------------------------------------------- registrar -----
select set_config('arco.r1', public.create_arco_request(pg_temp.v('p1'), 'acceso', 'presencial', current_date, 'Pide copia de su expediente')::text, true);
select pg_temp.assert_true(pg_temp.rows('select * from public.arco_requests') = 0, 'recepción registra pero no lee solicitudes');
select pg_temp.expect_error(format($$select public.create_arco_request(%L, 'oposicion', 'correo', current_date + 1)$$, pg_temp.v('p1')), '22023', 'sin fecha futura');
select pg_temp.expect_error(format($$select public.create_arco_request(%L, 'oposicion', 'fax', current_date)$$, pg_temp.v('p1')), '23514', 'canal válido');

select pg_temp.login_as('doctor_a');
select pg_temp.expect_error(format($$select public.create_arco_request(%L, 'cancelacion', 'correo', current_date)$$, pg_temp.v('p1')), '42501', 'un doctor no registra solicitudes');
select pg_temp.assert_true(pg_temp.rows('select * from public.arco_requests') = 0, 'un doctor no ve solicitudes');
select pg_temp.expect_error(format($$select public.export_patient_data(%L)$$, pg_temp.v('p1')), 'P0002', 'un doctor no exporta (ni a su paciente)');

select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.create_arco_request(%L, 'acceso', 'correo', current_date)$$, pg_temp.v('p1')), 'P0002', 'otra clínica no registra');
select pg_temp.expect_error(format($$select public.export_patient_data(%L)$$, pg_temp.v('p1')), 'P0002', 'otra clínica no exporta');
select pg_temp.assert_true(pg_temp.rows('select * from public.arco_requests') = 0, 'otra clínica no ve solicitudes');

select pg_temp.login_as('super');
select pg_temp.expect_error(format($$select public.export_patient_data(%L)$$, pg_temp.v('p1')), 'P0002', 'el superadmin no exporta');
select pg_temp.assert_true(pg_temp.rows('select * from public.arco_requests') = 0, 'el superadmin no ve solicitudes');

-- ------------------------------------------------------------- gerencia ------
select pg_temp.login_as('admin_a');
select pg_temp.assert_true(
  (select status = 'recibida' and due_on = current_setting('arco.due')::date and created_by = pg_temp.uid('reception_a')
   from public.arco_requests where id = pg_temp.v('r1')),
  'la administración ve la solicitud con su plazo de 20 días hábiles');
select pg_temp.expect_error(format($$select public.update_arco_request(%L, 'atendida')$$, pg_temp.v('r1')), '22023', 'resolver exige respuesta');
select public.update_arco_request(pg_temp.v('r1'), 'en_proceso');
select public.update_arco_request(pg_temp.v('r1'), 'atendida', 'Se entregó copia en PDF y JSON');
select pg_temp.assert_true(
  (select resolved_by = pg_temp.uid('admin_a') and resolved_at is not null from public.arco_requests where id = pg_temp.v('r1')),
  'queda quién y cuándo la resolvió');
select pg_temp.expect_error(format($$select public.update_arco_request(%L, 'en_proceso')$$, pg_temp.v('r1')), '22023', 'una resuelta no se reabre');

select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.update_arco_request(%L, 'improcedente', 'x')$$, pg_temp.v('r1')), 'P0002', 'recepción no resuelve');
select pg_temp.expect_error(format($$select public.export_patient_data(%L)$$, pg_temp.v('p1')), 'P0002', 'recepción no exporta');

-- ------------------------------------------------------------- exportar ------
select pg_temp.login_as('owner_a');
select set_config('arco.export', public.export_patient_data(pg_temp.v('p1'))::text, true);
select pg_temp.assert_true(
  (select (e -> 'patient' ->> 'full_name') = 'Paciente Arco Uno'
      and jsonb_array_length(e -> 'consents') = 1
      and (e -> 'notes' -> 0 ->> 'body') = 'Nota clínica ficticia'
      and jsonb_array_length(e -> 'arco_requests') = 1
      and e ->> 'format' = 'dentro.patient-export.v1'
      and not (e -> 'patient' ? 'tenant_id')
   from (select current_setting('arco.export')::jsonb as e) x),
  'la exportación trae datos, consentimiento, notas y solicitudes (sin ids internos)');
select pg_temp.assert_true(
  (select count(*) = 1 from public.patient_access_log where patient_id = pg_temp.v('p1') and action = 'export' and actor_id = pg_temp.uid('owner_a')),
  'exportar queda en la bitácora con quién lo hizo');
select pg_temp.assert_true(
  (select count(*) = 1 from public.audit_logs where action = 'patient.exported' and entity_id = pg_temp.v('p1')::text and details = '{}'::jsonb),
  'auditoría sin datos del paciente');

-- Clínica suspendida: se puede exportar, no registrar ni resolver.
select pg_temp.logout();
update public.tenants set status = 'suspended' where id = pg_temp.v('a');
select pg_temp.login_as('owner_a');
select public.export_patient_data(pg_temp.v('p1'));
select pg_temp.expect_error(format($$select public.create_arco_request(%L, 'acceso', 'correo', current_date)$$, pg_temp.v('p1')), '42501', 'suspendida: no registra');

-- El CHECK protege aunque se escriba como dueño de la base (desde 0013).
select pg_temp.logout();
select pg_temp.expect_error(format($$update public.arco_requests set status = 'improcedente', response = null, resolved_at = now() where id = %L$$, pg_temp.v('r1')), '23514', 'CHECK: resuelta exige respuesta');
select pg_temp.login_as('owner_a');

-- Sin escritura directa.
select pg_temp.expect_error(format($$update public.arco_requests set status = 'recibida' where id = %L$$, pg_temp.v('r1')), '42501', 'sin UPDATE directo');
select pg_temp.expect_error(format($$delete from public.arco_requests where id = %L$$, pg_temp.v('r1')), '42501', 'sin DELETE');

select pg_temp.logout();
select 'arco: todas las pruebas pasaron' as resultado;

rollback;
