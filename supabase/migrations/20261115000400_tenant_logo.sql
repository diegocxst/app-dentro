-- =============================================================================
-- 0004 · Logo de la clínica en Storage privado (E1-B5b)
-- Bucket privado `tenant-branding`: <tenant_id>/logo-<id>.<png|jpg|webp>.
-- Solo propietario o administrador de una clínica ACTIVA sube, cambia o borra;
-- los miembros (y el superadmin) lo ven con URL firmada temporal.
-- SVG no se permite: puede llevar código; PNG, JPG y WebP bastan para un logo.
-- update_tenant_identity solo acepta un logo que sea de esa misma clínica.
-- Rollback: supabase/rollback/20261115000400_tenant_logo.down.sql
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-branding', 'tenant-branding', false, 1048576, array['image/png', 'image/jpeg', 'image/webp']);

-- ¿La ruta tiene la forma <tenant>/logo-<id>.<ext> de ESTA clínica?
create or replace function private.is_tenant_logo_path(p_tenant uuid, p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name ~ ('^' || p_tenant::text || '/logo-[a-z0-9-]{8,64}\.(png|jpg|webp)$');
$$;

-- Clínica dueña de un objeto del bucket (primer segmento de la ruta), o NULL.
create or replace function private.branding_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

grant execute on function private.is_tenant_logo_path(uuid, text) to authenticated;
grant execute on function private.branding_tenant(text) to authenticated;

-- Lectura: miembros de la clínica (no cancelada) y superadmin.
create policy tenant_branding_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tenant-branding'
    and (
      (select private.is_member(private.branding_tenant(name)))
      or (select private.is_platform_admin())
    )
  );

-- Alta: propietario o administrador de una clínica activa, con la ruta correcta.
create policy tenant_branding_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tenant-branding'
    and (select private.can_write(private.branding_tenant(name), array['owner', 'admin']::public.tenant_role[]))
    and (select private.is_tenant_logo_path(private.branding_tenant(name), name))
  );

create policy tenant_branding_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'tenant-branding'
    and (select private.can_write(private.branding_tenant(name), array['owner', 'admin']::public.tenant_role[]))
  )
  with check (
    bucket_id = 'tenant-branding'
    and (select private.can_write(private.branding_tenant(name), array['owner', 'admin']::public.tenant_role[]))
    and (select private.is_tenant_logo_path(private.branding_tenant(name), name))
  );

create policy tenant_branding_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tenant-branding'
    and (select private.can_write(private.branding_tenant(name), array['owner', 'admin']::public.tenant_role[]))
  );

-- update_tenant_identity: misma firma que 0002 + validación de la ruta del logo.
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

  -- El logo solo puede apuntar a un archivo de ESTA clínica en el bucket de marca.
  if p_logo_path is not null and btrim(p_logo_path) <> ''
     and not private.is_tenant_logo_path(p_tenant, btrim(p_logo_path)) then
    raise exception 'El logo no pertenece a esta clínica' using errcode = '22023';
  end if;

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
