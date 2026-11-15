-- =============================================================================
-- 0002 · WhatsApp y ciudad de la clínica (E1-B4)
-- Decisión 2026-11-15 (E1-B3): el mockup Onboarding-Identidad los pide.
-- Agrega las columnas y amplía create_tenant y update_tenant_identity.
-- Rollback: supabase/rollback/20261115000200_tenant_contact.down.sql
-- Sin BEGIN/COMMIT: `supabase db push` ejecuta el archivo en una transacción.
-- =============================================================================

alter table public.tenants
  add column whatsapp_e164 text check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  add column city text not null default '' check (char_length(city) <= 80);

-- Firmas nuevas: se reemplazan las de 0001 (no se dejan sobrecargas).
drop function public.create_tenant(text, public.tenant_kind, text, text, text, text);
drop function public.update_tenant_identity(uuid, text, text, text, text, text);

create or replace function public.create_tenant(
  p_display_name text,
  p_kind public.tenant_kind,
  p_slug text,
  p_owner_display_name text default '',
  p_owner_title text default '',
  p_brand_color text default null,
  p_whatsapp_e164 text default null,
  p_city text default ''
)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_owned int;
  v_tenant public.tenants;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select count(*) into v_owned
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = v_uid
    and m.role = 'owner'
    and m.status = 'active'
    and t.status <> 'cancelled';

  if v_owned >= 1 then
    raise exception 'Ya tienes una clínica registrada' using errcode = 'P0001';
  end if;

  insert into public.tenants (kind, display_name, slug, owner_display_name, owner_title, brand_color, whatsapp_e164, city, created_by)
  values (
    p_kind,
    btrim(p_display_name),
    lower(btrim(p_slug)),
    left(btrim(coalesce(p_owner_display_name, '')), 120),
    left(btrim(coalesce(p_owner_title, '')), 60),
    private.ensure_brand_color(p_brand_color),
    nullif(btrim(coalesce(p_whatsapp_e164, '')), ''),
    left(btrim(coalesce(p_city, '')), 80),
    v_uid
  )
  returning * into v_tenant;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_tenant.id, v_uid, 'owner');

  insert into public.branches (tenant_id, name)
  values (v_tenant.id, 'Sucursal principal');

  perform private.write_audit(
    v_tenant.id, 'tenant.created', 'tenant', v_tenant.id::text,
    jsonb_build_object('kind', p_kind)
  );

  return v_tenant;
end;
$$;

-- NULL = no cambiar. '' en logo o WhatsApp lo borra.
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

revoke all on function public.create_tenant(text, public.tenant_kind, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_tenant(text, public.tenant_kind, text, text, text, text, text, text) to authenticated;
revoke all on function public.update_tenant_identity(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_tenant_identity(uuid, text, text, text, text, text, text, text) to authenticated;
