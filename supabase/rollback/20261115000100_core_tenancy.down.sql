-- =============================================================================
-- ROLLBACK de 20261115000100_core_tenancy.sql
-- Proyecto: dentro-dentistas-app (dev).
-- DESTRUCTIVO: borra perfiles, clínicas, membresías, sucursales, superadmins y
-- auditoría. Solo con aprobación explícita de Diego y respaldo previo si hay datos.
-- =============================================================================
begin;

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.create_tenant(text, public.tenant_kind, text, text, text, text);
drop function if exists public.update_tenant_identity(uuid, text, text, text, text, text);
drop function if exists public.update_my_profile(text, text);
drop function if exists public.create_branch(uuid, text, text);
drop function if exists public.update_branch(uuid, text, text, boolean);
drop function if exists public.set_membership_branches(uuid, uuid[]);
drop function if exists public.admin_set_tenant_status(uuid, public.tenant_status, text);
drop function if exists public.am_i_platform_admin();

-- Al borrar las tablas se eliminan sus políticas, índices y triggers.
drop table if exists public.audit_logs;
drop table if exists public.membership_branches;
drop table if exists public.branches;
drop table if exists public.memberships;
drop table if exists public.tenants;
drop table if exists public.profiles;

drop schema if exists private cascade;

drop type if exists public.membership_status;
drop type if exists public.tenant_role;
drop type if exists public.tenant_status;
drop type if exists public.tenant_kind;

-- Si se aplicó con el CLI, retirar también la versión del historial.
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261115000100';
  end if;
end $$;

commit;
