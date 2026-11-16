-- =============================================================================
-- 0007 · Sillones y catálogo de tratamientos (E2-B, base de M10 / M3 / M4)
-- Onboarding pasos 2 (sucursales y sillones) y 4 (tratamientos y precios).
-- Lectura: miembros de la clínica (la agenda y los presupuestos los usan).
-- Escritura: solo por RPC, propietario o administración de una clínica activa.
-- No se borran: se desactivan (los usarán citas y presupuestos).
-- Rollback: supabase/rollback/20261116000200_chairs_treatments.down.sql
-- =============================================================================

create table public.chairs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  branch_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete cascade
);
create unique index chairs_branch_name_idx on public.chairs (tenant_id, branch_id, lower(btrim(name)));

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category text not null check (category in ('preventiva', 'restauracion', 'ortodoncia', 'implantes', 'estetica', 'otros')),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  price_mxn numeric(12, 2) not null check (price_mxn >= 0 and price_mxn <= 10000000),
  -- Duración de UNA cita del tratamiento (la agenda la usa). NULL = varía.
  duration_minutes integer check (duration_minutes between 5 and 600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index treatments_tenant_name_idx on public.treatments (tenant_id, lower(btrim(name)));
create index treatments_tenant_category_idx on public.treatments (tenant_id, category);

create trigger chairs_set_updated_at before update on public.chairs
  for each row execute function private.set_updated_at();
create trigger treatments_set_updated_at before update on public.treatments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

create or replace function public.create_chair(p_branch uuid, p_name text)
returns public.chairs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_chair public.chairs;
begin
  select tenant_id into v_tenant from public.branches where id = p_branch;
  if v_tenant is null then
    raise exception 'Sucursal no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_tenant);

  insert into public.chairs (tenant_id, branch_id, name) values (v_tenant, p_branch, btrim(p_name))
  returning * into v_chair;
  perform private.write_audit(v_tenant, 'chair.created', 'chair', v_chair.id::text);
  return v_chair;
end;
$$;

-- NULL = no cambiar.
create or replace function public.update_chair(p_chair uuid, p_name text default null, p_is_active boolean default null)
returns public.chairs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chair public.chairs;
begin
  select * into v_chair from public.chairs where id = p_chair;
  if v_chair.id is null then
    raise exception 'Sillón no encontrado' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_chair.tenant_id);

  update public.chairs set
    name = coalesce(btrim(p_name), name),
    is_active = coalesce(p_is_active, is_active)
  where id = p_chair
  returning * into v_chair;
  perform private.write_audit(v_chair.tenant_id, 'chair.updated', 'chair', v_chair.id::text,
    jsonb_build_object('is_active', v_chair.is_active));
  return v_chair;
end;
$$;

-- Guarda varios tratamientos a la vez (paso 4). Cada elemento:
--   { "id"?: uuid, "category": text, "name": text, "price_mxn": number,
--     "duration_minutes"?: int|null, "is_active"?: bool }
-- Con id: actualiza ese tratamiento (debe ser de la clínica). Sin id: lo crea.
-- Todo o nada: si un elemento falla, no se guarda ninguno. Devuelve cuántos guardó.
create or replace function public.save_treatments(p_tenant uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_count integer := 0;
begin
  perform private.require_manager(p_tenant);
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'Lista de tratamientos inválida' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_id := nullif(v_item ->> 'id', '')::uuid;
    if v_id is null then
      insert into public.treatments (tenant_id, category, name, price_mxn, duration_minutes, is_active)
      values (
        p_tenant,
        v_item ->> 'category',
        btrim(v_item ->> 'name'),
        (v_item ->> 'price_mxn')::numeric,
        nullif(v_item ->> 'duration_minutes', '')::integer,
        coalesce((v_item ->> 'is_active')::boolean, true)
      );
    else
      update public.treatments set
        category = v_item ->> 'category',
        name = btrim(v_item ->> 'name'),
        price_mxn = (v_item ->> 'price_mxn')::numeric,
        duration_minutes = nullif(v_item ->> 'duration_minutes', '')::integer,
        is_active = coalesce((v_item ->> 'is_active')::boolean, is_active)
      where id = v_id and tenant_id = p_tenant;
      if not found then
        raise exception 'Tratamiento no encontrado en tu clínica' using errcode = 'P0002';
      end if;
    end if;
    v_count := v_count + 1;
  end loop;

  perform private.write_audit(p_tenant, 'treatments.saved', 'tenant', p_tenant::text, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

revoke all on function public.create_chair(uuid, text) from public, anon;
grant execute on function public.create_chair(uuid, text) to authenticated;
revoke all on function public.update_chair(uuid, text, boolean) from public, anon;
grant execute on function public.update_chair(uuid, text, boolean) to authenticated;
revoke all on function public.save_treatments(uuid, jsonb) from public, anon;
grant execute on function public.save_treatments(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.chairs enable row level security;
alter table public.treatments enable row level security;
revoke all on public.chairs, public.treatments from anon, authenticated;
grant select on public.chairs, public.treatments to authenticated;

create policy chairs_select on public.chairs
  for select to authenticated
  using ((select private.is_member(tenant_id)) or (select private.is_platform_admin()));

create policy treatments_select on public.treatments
  for select to authenticated
  using ((select private.is_member(tenant_id)) or (select private.is_platform_admin()));
