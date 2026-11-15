-- =============================================================================
-- PRUEBAS · 20261115000300_account_consents (aviso y consentimientos de cuentas)
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

create function pg_temp.login_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.login_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true(
  (select bool_and(c.relrowsecurity) and count(*) = 2 from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in ('privacy_notices', 'account_consents')),
  'RLS habilitada en privacy_notices y account_consents');
select pg_temp.assert_true(
  (select count(*) = 1 from public.privacy_notices where is_current),
  'hay exactamente una versión vigente del aviso');
select pg_temp.expect_error(
  $$insert into public.privacy_notices (version, title, is_current) values ('otra-version', 'Otra vigente', true)$$,
  '23505', 'no puede haber dos versiones vigentes');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-0000000000e1'::uuid, 'una.consent@example.test'),
  ('00000000-0000-4000-8000-0000000000e2'::uuid, 'otra.consent@example.test'),
  ('00000000-0000-4000-8000-0000000000e3'::uuid, 'super.consent@example.test')
) as u (id, email);
insert into private.platform_admins (user_id, note) values ('00000000-0000-4000-8000-0000000000e3', 'prueba consentimientos');

select set_config('consent.version', (select version from public.privacy_notices where is_current), true);

-- ---------------------------------------------------------------- anónimo ----
select pg_temp.login_anon();
select pg_temp.expect_error($$select count(*) from public.privacy_notices$$, '42501', 'anon no lee los avisos');
select pg_temp.expect_error($$select count(*) from public.account_consents$$, '42501', 'anon no lee consentimientos');
select pg_temp.expect_error(
  format($$select public.accept_privacy_notice(%L)$$, current_setting('consent.version')),
  '42501', 'anon no acepta avisos');

-- ------------------------------------------------------------- una cuenta ----
select pg_temp.login_as('00000000-0000-4000-8000-0000000000e1');
select pg_temp.assert_true((select count(*) >= 1 from public.privacy_notices), 'con sesión se leen los avisos');
select pg_temp.assert_true((select count(*) = 0 from public.account_consents), 'aún sin aceptaciones propias');

select pg_temp.expect_error($$select public.accept_privacy_notice('version-vieja')$$, '22023',
  'no se acepta una versión que no es la vigente');
select pg_temp.expect_error(
  $$insert into public.account_consents (user_id, notice_id, source) select '00000000-0000-4000-8000-0000000000e1', id, 'signup' from public.privacy_notices limit 1$$,
  '42501', 'sin INSERT directo en account_consents');

select public.accept_privacy_notice(current_setting('consent.version'), 'signup');
select public.accept_privacy_notice(current_setting('consent.version'), 'renewal');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(source = 'signup') from public.account_consents),
  'aceptar dos veces la misma versión no duplica y conserva el origen');

select pg_temp.expect_error($$update public.account_consents set accepted_at = now()$$, '42501', 'la evidencia no se edita');
select pg_temp.expect_error($$delete from public.account_consents$$, '42501', 'la evidencia no se borra');

-- -------------------------------------------------------------- otra cuenta ---
select pg_temp.login_as('00000000-0000-4000-8000-0000000000e2');
select pg_temp.assert_true((select count(*) = 0 from public.account_consents), 'otra cuenta no ve aceptaciones ajenas');

-- -------------------------------------------------------------- superadmin ---
select pg_temp.login_as('00000000-0000-4000-8000-0000000000e3');
select pg_temp.assert_true(
  (select count(*) = 1 from public.account_consents where user_id = '00000000-0000-4000-8000-0000000000e1'),
  'el superadmin ve las aceptaciones de todos (ARCO)');

-- ------------------------------------------- nueva versión vigente (renovar) --
select pg_temp.logout();
update public.privacy_notices set is_current = false where is_current;
insert into public.privacy_notices (version, title, is_draft, is_current) values ('prueba-2099-01-01', 'Versión de prueba', false, true);
select pg_temp.login_as('00000000-0000-4000-8000-0000000000e1');
select pg_temp.expect_error(
  format($$select public.accept_privacy_notice(%L)$$, current_setting('consent.version')),
  '22023', 'con una versión nueva, la anterior ya no se acepta');
select public.accept_privacy_notice('prueba-2099-01-01');
select pg_temp.assert_true((select count(*) = 2 from public.account_consents), 'la cuenta conserva ambas aceptaciones');

select pg_temp.logout();
select 'consentimientos: todas las pruebas pasaron' as resultado;

rollback;
