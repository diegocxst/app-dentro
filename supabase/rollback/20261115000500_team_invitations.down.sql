-- =============================================================================
-- ROLLBACK de 20261115000500_team_invitations.sql
-- DESTRUCTIVO: borra las invitaciones. Las membresías creadas al aceptarlas se
-- conservan (son parte del núcleo). Solo con aprobación de Diego.
-- =============================================================================
begin;

drop function if exists public.create_invitation(uuid, text, public.tenant_role, uuid[]);
drop function if exists public.revoke_invitation(uuid);
drop function if exists public.accept_my_invitations();
drop function if exists public.update_member_role(uuid, public.tenant_role);
drop function if exists public.revoke_member(uuid);
drop function if exists private.assignable_role(public.tenant_role);
drop function if exists private.branches_belong(uuid, uuid[]);
drop table if exists public.invitations;
drop type if exists public.invitation_status;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261115000500';
  end if;
end $$;

commit;
