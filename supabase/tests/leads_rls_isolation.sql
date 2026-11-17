-- =============================================================================
-- PRUEBAS · 20261116000800_leads
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('ld.' || k)::uuid $$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class where oid in ('public.leads'::regclass, 'public.lead_activity'::regclass)), 'RLS habilitada en leads e historial');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.ld@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba leads');

select pg_temp.login_as('owner_a');
select set_config('ld.a', (public.create_tenant('Clínica Leads A', 'clinic', 'ld-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('ld.b', (public.create_tenant('Clínica Leads B', 'clinic', 'ld-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor');
select set_config('ld.m_rec', (select id::text from public.memberships where user_id = pg_temp.uid('reception_a')), true);
select set_config('ld.m_doc', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);

-- ------------------------------------------------------------- alta ----------
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.create_lead(%L, 'Lead Sin Aviso', false, '+525512345678')$$, pg_temp.v('a')), '22023', 'sin aviso de privacidad no hay alta');
select pg_temp.expect_error(format($$select public.create_lead(%L, 'Lead Sin Contacto', true)$$, pg_temp.v('a')), '23514', 'necesita teléfono o correo');
select pg_temp.expect_error(format($$select public.create_lead(%L, 'Lead Doctor', true, '+525512345678', p_assigned_to => %L)$$, pg_temp.v('a'), pg_temp.v('m_doc')), '22023', 'el responsable no puede ser un doctor');
select set_config('ld.l1', (public.create_lead(pg_temp.v('a'), 'Lead Prueba Uno', true, '+525512345678', ' LEAD@Example.test ', 'Ortodoncia', 'meta', pg_temp.v('m_rec'))).id::text, true);
select pg_temp.assert_true(
  (select status = 'nuevo' and email = 'lead@example.test' and notice_version = 'clinica-borrador-2026-11' and first_response_at is null
   from public.leads where id = pg_temp.v('l1')),
  'nace «nuevo», con el aviso vigente y el correo normalizado');
select pg_temp.assert_true((select count(*) = 1 from public.lead_activity where lead_id = pg_temp.v('l1') and kind = 'created'), 'el alta queda en el historial');

-- ------------------------------------------------------------- acceso --------
select pg_temp.login_as('doctor_a');
select pg_temp.assert_true(pg_temp.rows('select * from public.leads') = 0, 'un doctor no ve leads');
select pg_temp.assert_true(pg_temp.rows('select * from public.lead_activity') = 0, 'ni su historial');
select pg_temp.expect_error(format($$select public.set_lead_status(%L, 'contactado')$$, pg_temp.v('l1')), 'P0002', 'un doctor no mueve leads');
select pg_temp.expect_error(format($$select public.create_lead(%L, 'Lead Doc', true, '+525512345679')$$, pg_temp.v('a')), '42501', 'un doctor no da de alta leads');
select pg_temp.expect_error(format($$select public.lead_stats(%L, now() - interval '30 days')$$, pg_temp.v('a')), '42501', 'ni ve indicadores');

select pg_temp.login_as('owner_b');
select pg_temp.assert_true(pg_temp.rows('select * from public.leads') = 0, 'otra clínica no ve leads');
select pg_temp.expect_error(format($$select public.add_lead_note(%L, 'x')$$, pg_temp.v('l1')), 'P0002', 'otra clínica no escribe notas');

select pg_temp.login_as('super');
select pg_temp.assert_true(pg_temp.rows('select * from public.leads') = 0, 'el superadmin no ve leads');

-- ------------------------------------------------------------- embudo --------
select pg_temp.login_as('reception_a');
select public.add_lead_note(pg_temp.v('l1'), 'Le escribí por WhatsApp');
select pg_temp.assert_true((select first_response_at is not null from public.leads where id = pg_temp.v('l1')), 'la primera nota cuenta como respuesta');
select public.set_lead_status(pg_temp.v('l1'), 'contactado');
select public.set_lead_status(pg_temp.v('l1'), 'valoracion');
select pg_temp.expect_error(format($$select public.set_lead_status(%L, 'convertido')$$, pg_temp.v('l1')), '22023', '«convertido» solo con la conversión');
select pg_temp.expect_error(format($$select public.set_lead_status(%L, 'perdido')$$, pg_temp.v('l1')), '22023', '«perdido» exige motivo');
select public.set_lead_status(pg_temp.v('l1'), 'perdido', 'Eligió otra clínica por precio');
select pg_temp.assert_true(
  (select lost_reason = 'Eligió otra clínica por precio' from public.leads where id = pg_temp.v('l1')), 'guarda el motivo de pérdida');
select public.set_lead_status(pg_temp.v('l1'), 'contactado');
select pg_temp.assert_true((select lost_reason is null from public.leads where id = pg_temp.v('l1')), 'al reabrirlo se limpia el motivo');
select pg_temp.assert_true(
  (select count(*) = 4 from public.lead_activity where lead_id = pg_temp.v('l1') and kind = 'status'), 'cada cambio de estado queda en el historial');

select public.update_lead(pg_temp.v('l1'), p_email => '', p_assigned_to => '');
select pg_temp.assert_true((select email is null and assigned_to is null from public.leads where id = pg_temp.v('l1')), 'vacío borra correo y responsable');
select pg_temp.expect_error(format($$select public.update_lead(%L, p_phone_e164 => '')$$, pg_temp.v('l1')), '23514', 'no se queda sin teléfono ni correo');

select pg_temp.assert_true(
  (select (s ->> 'leads')::int = 1 and (s ->> 'reached_valoracion')::int = 1 and (s ->> 'unanswered_24h')::int = 0
   from (select public.lead_stats(pg_temp.v('a'), now() - interval '30 days') as s) x),
  'indicadores: leads del mes, llegaron a valoración, sin contestar');

-- Sin escritura directa.
select pg_temp.expect_error(format($$update public.leads set status = 'nuevo' where id = %L$$, pg_temp.v('l1')), '42501', 'sin UPDATE directo');
select pg_temp.expect_error(format($$delete from public.leads where id = %L$$, pg_temp.v('l1')), '42501', 'sin DELETE');
select pg_temp.expect_error(format($$insert into public.lead_activity (tenant_id, lead_id, kind) values (%L, %L, 'note')$$, pg_temp.v('a'), pg_temp.v('l1')), '42501', 'sin INSERT directo al historial');

-- Auditoría sin datos personales (la lee la gerencia).
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  (select count(*) >= 5 and bool_and(details - 'source' - 'status' = '{}'::jsonb) from public.audit_logs where entity = 'lead'),
  'auditoría sin datos del lead');

-- Los CHECK de la tabla protegen aunque se escriba como dueño de la base.
select pg_temp.logout();
select pg_temp.expect_error(format($$update public.leads set status = 'perdido', lost_reason = null where id = %L$$, pg_temp.v('l1')), '23514', 'CHECK: «perdido» exige motivo');
select pg_temp.expect_error(format($$update public.leads set status = 'convertido' where id = %L$$, pg_temp.v('l1')), '23514', 'CHECK: «convertido» exige paciente');

-- Clínica suspendida: se lee, no se escribe.
update public.tenants set status = 'suspended' where id = pg_temp.v('a');
select pg_temp.login_as('reception_a');
select pg_temp.assert_true(pg_temp.rows('select * from public.leads') = 1, 'suspendida: recepción sigue viendo los leads');
select pg_temp.expect_error(format($$select public.set_lead_status(%L, 'nuevo')$$, pg_temp.v('l1')), '42501', 'suspendida: no se mueven');

select pg_temp.logout();
select 'leads: todas las pruebas pasaron' as resultado;

rollback;
