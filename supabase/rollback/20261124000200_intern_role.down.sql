-- =============================================================================
-- ROLLBACK de 20261124000200_intern_role.sql
-- SOLO en desarrollo con datos ficticios y con aprobación explícita de Diego. NUNCA en
-- producción. Postgres no puede quitar un valor de un enum: 'doctor_intern' se queda en
-- public.tenant_role (no estorba si nadie lo usa) y desaparece al revertir la 0001, que
-- borra el tipo. Se niega si alguien tiene o fue invitado con ese rol.
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.memberships where role::text = 'doctor_intern')
     or exists (select 1 from public.invitations where role::text = 'doctor_intern') then
    raise exception 'Hay pasantes o invitaciones de pasante: cámbialos de rol antes de revertir';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261124000200';
  end if;
end $$;

commit;
