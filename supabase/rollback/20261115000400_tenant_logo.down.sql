-- =============================================================================
-- ROLLBACK de 20261115000400_tenant_logo.sql
-- Quita las políticas y el bucket (debe estar VACÍO: los archivos se borran antes
-- desde la API de Storage) y restaura update_tenant_identity de 0002.
-- Solo con aprobación de Diego.
-- =============================================================================
begin;

drop policy if exists tenant_branding_select on storage.objects;
drop policy if exists tenant_branding_insert on storage.objects;
drop policy if exists tenant_branding_update on storage.objects;
drop policy if exists tenant_branding_delete on storage.objects;

-- Versión de 20261115000200_tenant_contact.sql
create or replace function public.update_tenant_identity(
  p_tenant uuid,
  p_display_name text default null,
  p_owner_display_name text default null,
  p_owner_title text default null,
  p_logo_path text default null,
  p_brand_color text default null,
  p_whatsapp_e164 text default null,
  p_city text default null
)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.tenants;
  v_new public.tenants;
  v_changed text[] := '{}';
begin
  perform private.require_manager(p_tenant);

  select * into v_old from public.tenants where id = p_tenant;

  update public.tenants set
    display_name = coalesce(btrim(p_display_name), display_name),
    owner_display_name = coalesce(left(btrim(p_owner_display_name), 120), owner_display_name),
    owner_title = coalesce(left(btrim(p_owner_title), 60), owner_title),
    logo_path = case when p_logo_path is null then logo_path
                     else nullif(btrim(p_logo_path), '') end,
    brand_color = case when p_brand_color is null then brand_color
                       else private.ensure_brand_color(p_brand_color) end,
    whatsapp_e164 = case when p_whatsapp_e164 is null then whatsapp_e164
                         else nullif(btrim(p_whatsapp_e164), '') end,
    city = coalesce(left(btrim(p_city), 80), city)
  where id = p_tenant
  returning * into v_new;

  if v_new.display_name is distinct from v_old.display_name then v_changed := array_append(v_changed, 'display_name'); end if;
  if v_new.owner_display_name is distinct from v_old.owner_display_name then v_changed := array_append(v_changed, 'owner_display_name'); end if;
  if v_new.owner_title is distinct from v_old.owner_title then v_changed := array_append(v_changed, 'owner_title'); end if;
  if v_new.logo_path is distinct from v_old.logo_path then v_changed := array_append(v_changed, 'logo_path'); end if;
  if v_new.brand_color is distinct from v_old.brand_color then v_changed := array_append(v_changed, 'brand_color'); end if;
  if v_new.whatsapp_e164 is distinct from v_old.whatsapp_e164 then v_changed := array_append(v_changed, 'whatsapp_e164'); end if;
  if v_new.city is distinct from v_old.city then v_changed := array_append(v_changed, 'city'); end if;

  if cardinality(v_changed) > 0 then
    -- Solo los nombres de los campos: sin datos personales en claro.
    perform private.write_audit(p_tenant, 'tenant.identity_updated', 'tenant', p_tenant::text,
      jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;

  return v_new;
end;
$$;

revoke all on function public.update_tenant_identity(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_tenant_identity(uuid, text, text, text, text, text, text, text) to authenticated;

drop function if exists private.is_tenant_logo_path(uuid, text);
drop function if exists private.branding_tenant(text);

update public.tenants set logo_path = null where logo_path is not null;
-- Storage bloquea los DELETE directos salvo con este ajuste (solo en esta transacción).
set local storage.allow_delete_query = 'true';
delete from storage.buckets where id = 'tenant-branding';

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261115000400';
  end if;
end $$;

commit;
