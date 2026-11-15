-- =============================================================================
-- PRUEBAS · 20261115000200_tenant_contact (WhatsApp y ciudad de la clínica)
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

-- Sin sobrecargas viejas: una sola firma por RPC.
select pg_temp.assert_true(
  (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_tenant')
  and (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'update_tenant_identity'),
  'create_tenant y update_tenant_identity tienen una sola firma');
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.create_tenant(text,public.tenant_kind,text,text,text,text,text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_tenant_identity(uuid,text,text,text,text,text,text,text)', 'EXECUTE'),
  'anon no ejecuta las RPC nuevas');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated',
   'owner.contact@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner Contacto Prueba"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000d2', 'authenticated', 'authenticated',
   'otra.contact@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Otra Contacto Prueba"}', now(), now(), '', '', '', '');

select pg_temp.login_as('00000000-0000-4000-8000-0000000000d1');
select pg_temp.expect_error(
  $$select public.create_tenant('Clínica Contacto', 'clinic', 'contact-test-x', p_whatsapp_e164 => '5512345678')$$,
  '23514', 'el WhatsApp debe venir en formato internacional');
select set_config('contact.tenant',
  (public.create_tenant('Clínica Contacto Prueba', 'clinic', 'contact-test-a',
     p_whatsapp_e164 => '+525512345678', p_city => ' Ciudad de México ')).id::text, true);
select pg_temp.assert_true(
  (select whatsapp_e164 = '+525512345678' and city = 'Ciudad de México'
   from public.tenants where id = current_setting('contact.tenant')::uuid),
  'create_tenant guarda WhatsApp y ciudad');

select public.update_tenant_identity(current_setting('contact.tenant')::uuid, p_city => 'Guadalajara', p_whatsapp_e164 => '');
select pg_temp.assert_true(
  (select city = 'Guadalajara' and whatsapp_e164 is null from public.tenants where id = current_setting('contact.tenant')::uuid),
  'update_tenant_identity cambia la ciudad y borra el WhatsApp con cadena vacía');
select pg_temp.assert_true(
  (select details -> 'fields' ? 'city' and details -> 'fields' ? 'whatsapp_e164' and details::text not like '%Guadalajara%'
   from public.audit_logs where tenant_id = current_setting('contact.tenant')::uuid and action = 'tenant.identity_updated'
   order by id desc limit 1),
  'la auditoría registra los campos sin sus valores');

select pg_temp.login_as('00000000-0000-4000-8000-0000000000d2');
select pg_temp.expect_error(
  format($$select public.update_tenant_identity(%L, p_city => 'Intrusa')$$, current_setting('contact.tenant')),
  '42501', 'otra persona no cambia la ciudad de una clínica ajena');

select set_config('role', 'none', true);
select 'contacto: todas las pruebas pasaron' as resultado;

rollback;
