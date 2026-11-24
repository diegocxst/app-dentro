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
    when 'owner_a' then 'e1' when 'reception_a' then 'e2' when 'doctor_a' then 'e3' when 'doctor2_a' then 'e4'
    when 'owner_b' then 'e5' when 'super' then 'e6' when 'nuevo' then 'e7' end)::uuid;
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

create function pg_temp.v(k text) returns uuid language sql stable as $$ select current_setting('dr.' || k)::uuid $$;
-- ---------------------------------------------------------------- entorno ----
select pg_temp.assert_true((select relrowsecurity from pg_class where oid = 'public.doctor_settings'::regclass), 'RLS habilitada en doctor_settings');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(k), 'authenticated', 'authenticated', k || '.dr@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest(array['owner_a', 'reception_a', 'doctor_a', 'doctor2_a', 'owner_b', 'super']) as k;
insert into private.platform_admins (user_id, note) values (pg_temp.uid('super'), 'prueba doctores');
update public.profiles set full_name = 'Cuenta Doctor Dos' where id = pg_temp.uid('doctor2_a');

select pg_temp.login_as('owner_a');
select set_config('dr.a', (public.create_tenant('Clínica Doctores A', 'clinic', 'dr-test-a')).id::text, true);
select pg_temp.login_as('owner_b');
select set_config('dr.b', (public.create_tenant('Clínica Doctores B', 'clinic', 'dr-test-b')).id::text, true);
select pg_temp.logout();
insert into public.memberships (tenant_id, user_id, role) values
  (pg_temp.v('a'), pg_temp.uid('reception_a'), 'reception'),
  (pg_temp.v('a'), pg_temp.uid('doctor_a'), 'doctor_collab'),
  (pg_temp.v('a'), pg_temp.uid('doctor2_a'), 'doctor');
select set_config('dr.d1', (select id::text from public.memberships where user_id = pg_temp.uid('doctor_a')), true);
select set_config('dr.d2', (select id::text from public.memberships where user_id = pg_temp.uid('doctor2_a')), true);
select set_config('dr.own', (select id::text from public.memberships where user_id = pg_temp.uid('owner_a')), true);
select set_config('dr.ownb', (select id::text from public.memberships where user_id = pg_temp.uid('owner_b')), true);

-- ---------------------------------------------------- doctor sin acceso ------
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.create_doctor(%L, 'Dra. Prueba')$$, pg_temp.v('a')), '42501', 'recepción no da de alta doctores');
select pg_temp.login_as('doctor_a');
select pg_temp.expect_error(format($$select public.create_doctor(%L, 'Dra. Prueba')$$, pg_temp.v('a')), '42501', 'un doctor no da de alta doctores');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.create_doctor(%L, 'Dra. Prueba')$$, pg_temp.v('a')), '42501', 'otra clínica no da de alta doctores');
select pg_temp.login_as('super');
select pg_temp.expect_error(format($$select public.create_doctor(%L, 'Dra. Prueba')$$, pg_temp.v('a')), '42501', 'el superadmin no da de alta doctores');
select pg_temp.login_as('owner_a');
select pg_temp.expect_error(format($$select public.create_doctor(%L, 'Recepción X', 'reception')$$, pg_temp.v('a')), '22023', 'sin acceso solo doctores');
select pg_temp.expect_error(format($$select public.create_doctor(%L, 'Admin X', 'admin')$$, pg_temp.v('a')), '22023', 'sin acceso no puede ser administración');
select pg_temp.expect_error(format($$select public.create_doctor(%L, '  ')$$, pg_temp.v('a')), '22023', 'nombre obligatorio');
select pg_temp.expect_error(format($$select public.create_doctor(%L, 'Dra. Prueba', p_color => 'rosa')$$, pg_temp.v('a')), '22023', 'color de la paleta');
select pg_temp.expect_error(format($$select public.create_doctor(%L, 'Dra. Prueba', p_phone => '5512345678')$$, pg_temp.v('a')), '22023', 'teléfono en formato internacional');
select pg_temp.expect_error(format($$select public.create_doctor(%L, 'Dra. Prueba', p_specialty => repeat('x', 81))$$, pg_temp.v('a')), '22023', 'especialidad corta');
select set_config('dr.off', (public.create_doctor(pg_temp.v('a'), '  Dra. Sin Acceso ', 'doctor', 'Ortodoncia', 'turquoise', '+525512345678')).id::text, true);
select pg_temp.assert_true(
  (select m.user_id is null and m.status = 'active' and m.display_name = 'Dra. Sin Acceso' and s.specialty = 'Ortodoncia' and s.calendar_color = 'turquoise'
   from public.memberships m join public.doctor_settings s on s.membership_id = m.id where m.id = pg_temp.v('off')),
  'el doctor sin acceso queda activo, con nombre y perfil');

-- Se le asignan pacientes y comisiones como a cualquier doctor.
select pg_temp.login_as('reception_a');
select set_config('dr.p1', (public.create_patient(pg_temp.v('a'), 'Paciente Doctor Sin Acceso', 'papel', p_primary_doctor => pg_temp.v('off'))).id::text, true);
select pg_temp.login_as('owner_a');
select public.set_commission_scheme(pg_temp.v('off'), 'percent_collected', 30);
select pg_temp.login_as('reception_a');
select set_config('dr.x1', (public.register_payment(pg_temp.v('p1'), 1000, 'efectivo')).id::text, true);
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  (select full_name = 'Dra. Sin Acceso' and commission = 300
   from public.commission_summary(pg_temp.v('a'), current_date - 30, current_date + 1) where doctor_id = pg_temp.v('off')),
  'comisiones del doctor sin acceso con su nombre');
select pg_temp.assert_true(
  (select public.export_patient_data(pg_temp.v('p1'))::text like '%Dra. Sin Acceso%'),
  'la exportación ARCO usa el nombre en la clínica');

-- Sin cuenta: nunca puede ser propietaria, administración ni recepción.
select pg_temp.expect_error(format($$select public.update_member_role(%L, 'reception')$$, pg_temp.v('off')), '22023', 'sin acceso no pasa a recepción');
select public.update_member_role(pg_temp.v('off'), 'doctor_collab');
select public.update_member_role(pg_temp.v('off'), 'doctor');
select pg_temp.logout();
select pg_temp.expect_error(format($$insert into public.memberships (tenant_id, user_id, role) values (%L, null, 'admin')$$, pg_temp.v('a')), '23514', 'CHECK: sin cuenta solo doctores');

-- ------------------------------------------------------ perfil y nombre ------
select pg_temp.login_as('reception_a');
select pg_temp.expect_error(format($$select public.update_doctor_profile(%L, 'Otro nombre')$$, pg_temp.v('d2')), '42501', 'recepción no edita perfiles');
select pg_temp.login_as('doctor2_a');
select pg_temp.expect_error(format($$select public.update_doctor_profile(%L, 'Otro nombre')$$, pg_temp.v('d2')), '42501', 'un doctor no edita su perfil de la clínica');
select pg_temp.login_as('owner_b');
select pg_temp.expect_error(format($$select public.update_doctor_profile(%L, 'Otro nombre')$$, pg_temp.v('d2')), 'P0002', 'otra clínica no ve el perfil');
select pg_temp.login_as('super');
select pg_temp.expect_error(format($$select public.update_doctor_profile(%L, 'Otro nombre')$$, pg_temp.v('d2')), 'P0002', 'el superadmin no edita perfiles');
select pg_temp.login_as('owner_a');
select pg_temp.expect_error(format($$select public.update_doctor_profile(%L, '')$$, pg_temp.v('off')), '22023', 'el doctor sin acceso necesita nombre');
select pg_temp.expect_error(format($$select public.update_doctor_profile(%L, 'X')$$, pg_temp.v('d2')), '22023', 'nombre de al menos 2 letras');
select public.update_doctor_profile(pg_temp.v('d2'), 'Dr. Nombre Clínica', 'Endodoncia', 'orange');
select pg_temp.assert_true(
  (select full_name = 'Dr. Nombre Clínica' from public.commission_summary(pg_temp.v('a'), current_date - 30, current_date + 1) where doctor_id = pg_temp.v('d2')),
  'el nombre en la clínica manda sobre el de la cuenta');
select pg_temp.assert_true((select full_name = 'Cuenta Doctor Dos' from public.profiles where id = pg_temp.uid('doctor2_a')), 'la cuenta del doctor no cambia');
select public.update_doctor_profile(pg_temp.v('d2'), '', 'Endodoncia', 'orange');
select pg_temp.assert_true(
  (select full_name = 'Cuenta Doctor Dos' from public.commission_summary(pg_temp.v('a'), current_date - 30, current_date + 1) where doctor_id = pg_temp.v('d2')),
  'nombre vacío: se usa el de la cuenta');

-- Lectura: miembros de la clínica sí; otra clínica no; sin escritura directa.
select pg_temp.login_as('reception_a');
select pg_temp.assert_true((select count(*) = 2 from public.doctor_settings), 'recepción ve los perfiles de su clínica');
select pg_temp.assert_true((select count(*) = 1 from public.memberships where user_id is null), 'recepción ve al doctor sin acceso');
select pg_temp.login_as('owner_b');
select pg_temp.assert_true((select count(*) = 0 from public.doctor_settings), 'otra clínica no ve perfiles');
select pg_temp.assert_true((select count(*) = 0 from public.memberships where tenant_id = pg_temp.v('a')), 'otra clínica no ve al equipo');
select pg_temp.login_as('owner_a');
select pg_temp.expect_error(format($$insert into public.doctor_settings (membership_id, tenant_id) values (%L, %L)$$, pg_temp.v('d1'), pg_temp.v('a')), '42501', 'sin INSERT directo');
select pg_temp.expect_error(format($$update public.doctor_settings set specialty = 'x' where membership_id = %L$$, pg_temp.v('off')), '42501', 'sin UPDATE directo');
select pg_temp.expect_error(format($$update public.memberships set display_name = 'x' where id = %L$$, pg_temp.v('d2')), '42501', 'sin UPDATE directo del nombre');

-- ------------------------------------------- invitarlo y ligar su cuenta -----
select pg_temp.expect_error(format($$select public.create_invitation(%L, 'nuevo.dr@example.test', 'reception', '{}', %L)$$, pg_temp.v('a'), pg_temp.v('off')), '22023', 'la invitación ligada es de doctor');
select pg_temp.expect_error(format($$select public.create_invitation(%L, 'nuevo.dr@example.test', 'doctor', '{}', %L)$$, pg_temp.v('a'), pg_temp.v('d2')), 'P0002', 'solo se liga a un doctor sin acceso');
select pg_temp.expect_error(format($$select public.create_invitation(%L, 'nuevo.dr@example.test', 'doctor', '{}', %L)$$, pg_temp.v('a'), pg_temp.v('ownb')), 'P0002', 'no se liga a un miembro de otra clínica');
select public.create_invitation(pg_temp.v('a'), 'otro.correo@example.test', 'doctor', '{}', pg_temp.v('off'));
select public.create_invitation(pg_temp.v('a'), 'nuevo.dr@example.test', 'doctor', '{}', pg_temp.v('off'));
-- «Reenviar» (sin doctor) conserva el vínculo.
select public.create_invitation(pg_temp.v('a'), 'nuevo.dr@example.test', 'doctor');
select pg_temp.assert_true(
  (select membership_id = pg_temp.v('off') from public.invitations where email = 'nuevo.dr@example.test' and status = 'pending'),
  'reenviar conserva el doctor ligado');
select pg_temp.assert_true(
  (select count(*) filter (where status = 'pending') = 1 and count(*) filter (where status = 'revoked') = 1
   from public.invitations where membership_id = pg_temp.v('off')),
  'una sola invitación pendiente por doctor sin acceso');

select pg_temp.logout();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', pg_temp.uid('nuevo'), 'authenticated', 'authenticated', 'nuevo.dr@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
select pg_temp.login_as('nuevo');
select pg_temp.assert_true(public.accept_my_invitations() = 1, 'acepta la invitación');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(id = pg_temp.v('off') and role = 'doctor' and display_name = 'Dra. Sin Acceso')
   from public.memberships where user_id = pg_temp.uid('nuevo')),
  'su cuenta queda ligada al mismo doctor');
select pg_temp.assert_true((select count(*) = 1 from public.patients where id = pg_temp.v('p1')), 'ya ve a su paciente');
select pg_temp.assert_true((select count(*) = 1 from public.commission_entries where doctor_id = pg_temp.v('off')), 'ya ve su comisión');
select pg_temp.assert_true((select count(*) = 0 from public.memberships where tenant_id = pg_temp.v('a') and user_id is null), 'ya no queda sin acceso');

-- ------------------------------------------------------------- auditoría -----
select pg_temp.login_as('owner_a');
select pg_temp.assert_true(
  (select count(*) >= 4 and bool_and(details - 'role' - 'access' = '{}'::jsonb)
   from public.audit_logs where tenant_id = pg_temp.v('a') and action in ('membership.doctor_created', 'membership.profile_updated', 'membership.role_changed')),
  'auditoría sin nombres ni teléfonos');
select pg_temp.logout();

select 'doctores: todas las pruebas pasaron' as resultado;

rollback;
