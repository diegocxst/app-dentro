-- =============================================================================
-- PRUEBAS · 20261116000100_onboarding_tasks (avance de la guía de inicio)
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
  select ('00000000-0000-4000-8000-0000000000' || case k when 'owner_a' then '81' when 'doctor_a' then '82' when 'owner_b' then '83' end)::uuid;
$$;

create function pg_temp.login_as(k text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(k), 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.t() returns uuid language sql stable as $$ select current_setting('onb.a')::uuid $$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.onb@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'doctor_a', 'owner_b']) as k;

select pg_temp.login_as('owner_a');
select set_config('onb.a', (public.create_tenant('Clínica Guía A', 'clinic', 'onb-test-a')).id::text, true);
select set_config('role', 'none', true);
insert into public.memberships (tenant_id, user_id, role) values (pg_temp.t(), pg_temp.uid('doctor_a'), 'doctor');

select pg_temp.assert_true(
  (select onboarding_state = '{"tasks": {"identity": true}}'::jsonb from public.tenants where id = pg_temp.t()),
  'una clínica nueva empieza con la identidad hecha');

select pg_temp.login_as('owner_a');
select public.set_onboarding_task(pg_temp.t(), 'team', true);
select public.set_onboarding_task(pg_temp.t(), 'first_patient', true);
select public.set_onboarding_task(pg_temp.t(), 'first_patient', false);
select pg_temp.assert_true(
  (select onboarding_state -> 'tasks' = '{"identity": true, "team": true, "first_patient": false}'::jsonb from public.tenants where id = pg_temp.t()),
  'marca y desmarca tareas sin perder las demás');
select pg_temp.expect_error(format($$select public.set_onboarding_task(%L, 'hackear', true)$$, pg_temp.t()), '22023', 'solo acepta las 7 tareas');
select pg_temp.assert_true(
  (select count(*) = 3 from public.audit_logs where tenant_id = pg_temp.t() and action = 'onboarding.task_set'),
  'cada cambio queda en la auditoría');

select pg_temp.login_as('doctor_a');
select pg_temp.expect_error(format($$select public.set_onboarding_task(%L, 'team', false)$$, pg_temp.t()), '42501', 'un doctor no cambia la guía');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.set_onboarding_task(%L, 'team', false)$$, pg_temp.t()), '42501', 'otra clínica no cambia la guía');
select pg_temp.expect_error(format($$update public.tenants set onboarding_state = '{}' where id = %L$$, pg_temp.t()), '42501', 'sin UPDATE directo');

select set_config('role', 'none', true);
select 'guía: todas las pruebas pasaron' as resultado;

rollback;
