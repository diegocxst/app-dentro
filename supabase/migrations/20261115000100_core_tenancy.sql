-- =============================================================================
-- 0001 · Núcleo multiempresa de dentro (E1-B1)
-- Perfiles, clínicas (tenants) con su identidad, membresías con roles de la
-- clínica, sucursales, superadmin de plataforma y bitácora de auditoría.
--
-- Origen: `core-base` (Realt-In, e1_core_tenancy), adaptado según
-- docs/auditoria-core-base.md (§3) y las decisiones D1–D8 del 2026-11-15.
-- Proyecto destino: dentro-dentistas-app (dev). NO se aplica en remoto sin
-- aprobación de Diego. Se prueba antes con `npm run test:db` (PostgreSQL local).
-- Rollback: supabase/rollback/20261115000100_core_tenancy.down.sql
--
-- ATOMICIDAD: sin BEGIN/COMMIT a propósito. `supabase db push` ejecuta cada
-- archivo en una sola transacción junto con su registro en
-- supabase_migrations.schema_migrations. Si se aplica a mano en el SQL Editor,
-- envolverlo en BEGIN; … COMMIT;.
--
-- Convenciones de seguridad (aplican a TODAS las migraciones de dentro):
--   * Toda tabla habilita RLS explícitamente.
--   * Se revocan los privilegios por omisión de `anon` y `authenticated`.
--     `authenticated` solo recibe SELECT (filtrado por RLS). NINGUNA escritura
--     directa: todo INSERT/UPDATE/DELETE pasa por RPC SECURITY DEFINER.
--   * Funciones SECURITY DEFINER con `search_path = ''` y nombres calificados.
--   * Helpers de RLS en el esquema `private` (no expuesto) y siempre envueltos
--     en `(select …)` dentro de las políticas.
--   * Toda tabla de negocio: `tenant_id not null`, `unique (tenant_id, id)` y
--     FK compuestas `(tenant_id, …)` hacia sus padres, para que una fila nunca
--     apunte a otra clínica. Índices que empiezan por `tenant_id`.
--   * `audit_logs.details` NUNCA lleva datos personales en claro: solo
--     nombres de campos, ids y estados.
--   * El superadmin de plataforma ve clínicas, perfiles, membresías,
--     sucursales y auditoría, pero NUNCA entra en las políticas de tablas
--     clínicas (pacientes, documentos, citas, presupuestos, pagos).
--   * Identificadores en inglés; textos visibles en español en el frontend.
--
-- Estatus de la clínica (tenant_status):
--   active     operación normal.
--   suspended  SOLO LECTURA para sus miembros (p. ej. falta de pago).
--   cancelled  SIN ACCESO a los datos; solo ven la ficha (nombre y estatus)
--              para que la app explique la situación. Solo el superadmin
--              cambia el estatus, con motivo y auditoría.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Esquema privado (no expuesto por PostgREST)
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role, supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.tenant_kind as enum ('independent', 'clinic');             -- consultorio | clínica (D2)
create type public.tenant_status as enum ('active', 'suspended', 'cancelled');
create type public.tenant_role as enum ('owner', 'admin', 'reception', 'doctor', 'doctor_collab');
create type public.membership_status as enum ('active', 'invited', 'revoked');

-- -----------------------------------------------------------------------------
-- Utilidades puras
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug = any (array[
    'admin', 'administrador', 'agenda', 'api', 'app', 'assets', 'auth', 'ayuda',
    'blog', 'clinica', 'clinicas', 'configuracion', 'consultorio', 'consultorios',
    'cuenta', 'dashboard', 'dentistas', 'dentro', 'doctores', 'guia', 'ingresar',
    'login', 'pacientes', 'perfil', 'precios', 'privacidad', 'registro', 'soporte',
    'static', 'superadmin', 'terminos', 'www'
  ]);
$$;

-- Contraste WCAG de un color #RRGGBB contra blanco. Misma fórmula que
-- src/lib/color.ts (contrastRatio).
create or replace function private.contrast_with_white(p_hex text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_rgb int[];
  v_lin numeric[] := '{}';
  v_c numeric;
  v_l numeric;
  i int;
begin
  v_rgb := array[
    ('x' || substr(p_hex, 2, 2))::bit(8)::int,
    ('x' || substr(p_hex, 4, 2))::bit(8)::int,
    ('x' || substr(p_hex, 6, 2))::bit(8)::int
  ];
  for i in 1..3 loop
    v_c := v_rgb[i] / 255.0;
    v_lin := v_lin || case when v_c <= 0.03928 then v_c / 12.92
                           else power((v_c + 0.055) / 1.055, 2.4) end;
  end loop;
  v_l := 0.2126 * v_lin[1] + 0.7152 * v_lin[2] + 0.0722 * v_lin[3];
  return 1.05 / (v_l + 0.05);
end;
$$;

-- brand_color de la clínica: si no llega a 4.5:1 con blanco, se oscurece en
-- pasos de 2% (mismo algoritmo que ensureBrandContrast en src/lib/color.ts).
-- Si el valor no es un color válido, devuelve el color `night` de dentro.
create or replace function private.ensure_brand_color(p_hex text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_hex text := upper(btrim(coalesce(p_hex, '')));
  v_r int; v_g int; v_b int;
  v_k numeric;
  v_candidate text;
  v_step int;
begin
  if v_hex !~ '^#[0-9A-F]{6}$' then
    return '#1E1240';
  end if;
  if private.contrast_with_white(v_hex) >= 4.5 then
    return v_hex;
  end if;
  v_r := ('x' || substr(v_hex, 2, 2))::bit(8)::int;
  v_g := ('x' || substr(v_hex, 4, 2))::bit(8)::int;
  v_b := ('x' || substr(v_hex, 6, 2))::bit(8)::int;
  for v_step in 1..50 loop
    v_k := 1 - v_step * 0.02;
    v_candidate := '#' || upper(
      lpad(to_hex(round(v_r * v_k)::int), 2, '0') ||
      lpad(to_hex(round(v_g * v_k)::int), 2, '0') ||
      lpad(to_hex(round(v_b * v_k)::int), 2, '0'));
    if private.contrast_with_white(v_candidate) >= 4.5 then
      return v_candidate;
    end if;
  end loop;
  return '#1E1240';
end;
$$;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

-- Cuenta global de cada usuario (1:1 con auth.users).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_path text check (char_length(avatar_path) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La clínica o consultorio, con su identidad (decisión 2026-11-10).
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  kind public.tenant_kind not null,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  slug text not null unique check (
    slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'
    and position('--' in slug) = 0
    and not private.is_reserved_slug(slug)
  ),
  status public.tenant_status not null default 'active',
  owner_display_name text not null default '' check (char_length(owner_display_name) <= 120),
  owner_title text not null default '' check (char_length(owner_title) <= 60),
  logo_path text check (char_length(logo_path) <= 500),
  -- Siempre normalizado y con contraste AA (lo garantizan las RPC).
  brand_color text not null default '#1E1240' check (brand_color ~ '^#[0-9A-F]{6}$'),
  onboarding_state jsonb not null default '{}'::jsonb check (jsonb_typeof(onboarding_state) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Usuario ↔ clínica ↔ rol.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.tenant_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id)
);
create index memberships_user_status_idx on public.memberships (user_id, status);
-- Exactamente un propietario activo por clínica.
create unique index memberships_one_active_owner_idx
  on public.memberships (tenant_id)
  where role = 'owner' and status = 'active';

-- Sucursales (multi-sucursal en la base desde el MVP; visible según el plan).
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  address text not null default '' check (char_length(address) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index branches_tenant_name_idx on public.branches (tenant_id, lower(btrim(name)));

-- Sucursales permitidas por membresía. Sin filas = todas las sucursales.
create table public.membership_branches (
  tenant_id uuid not null,
  membership_id uuid not null,
  branch_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, branch_id),
  foreign key (tenant_id, membership_id) references public.memberships (tenant_id, id) on delete cascade,
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete cascade
);
create index membership_branches_tenant_branch_idx on public.membership_branches (tenant_id, branch_id);

-- Superadministradores de plataforma. Solo por SQL de operación, nunca desde la app.
create table private.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

-- Bitácora de auditoría (D6). Solo la escriben funciones del servidor.
-- `details` sin datos personales en claro.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  entity text not null check (char_length(entity) <= 80),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_tenant_created_idx on public.audit_logs (tenant_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function private.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();
create trigger branches_set_updated_at before update on public.branches
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Funciones de autorización (usadas por RLS y RPC)
-- -----------------------------------------------------------------------------
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$$;

-- Membresía activa, sin importar el estatus de la clínica (solo para la ficha).
create or replace function private.is_member_any_status(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- LECTURA: membresía activa y clínica no cancelada.
create or replace function private.is_member(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and t.status <> 'cancelled'
  );
$$;

-- LECTURA restringida a ciertos roles (clínica no cancelada).
create or replace function private.has_role(p_tenant uuid, p_roles public.tenant_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (p_roles)
      and t.status <> 'cancelled'
  );
$$;

-- ESCRITURA: membresía activa, rol permitido y clínica ACTIVA.
create or replace function private.can_write(p_tenant uuid, p_roles public.tenant_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (p_roles)
      and t.status = 'active'
  );
$$;

-- ¿El usuario actual comparte alguna clínica no cancelada con p_user?
create or replace function private.shares_tenant_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.tenant_id = mine.tenant_id
    join public.tenants t on t.id = mine.tenant_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = p_user
      and theirs.status = 'active'
      and t.status <> 'cancelled'
  );
$$;

-- Escritura de auditoría: solo desde otras funciones del servidor.
create or replace function private.write_audit(
  p_tenant uuid,
  p_action text,
  p_entity text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  values (p_tenant, (select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Exige sesión; devuelve el uid.
create or replace function private.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Se requiere iniciar sesión' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- Exige ser propietario o administrador de una clínica activa.
create or replace function private.require_manager(p_tenant uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_uid();
  if not private.can_write(p_tenant, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'No tienes permiso para hacer este cambio' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers de negocio
-- -----------------------------------------------------------------------------

-- Crea el perfil al registrarse un usuario en Supabase Auth.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Audita cambios de estatus (motivo solo si lo fija un superadmin).
create or replace function private.audit_tenant_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform private.write_audit(
      new.id, 'tenant.status_changed', 'tenant', new.id::text,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'reason', case when private.is_platform_admin()
                       then nullif(current_setting('dentro.audit_reason', true), '')
                  end
      )
    );
  end if;
  return new;
end;
$$;

create trigger tenants_audit_status
  after update of status on public.tenants
  for each row execute function private.audit_tenant_status();

-- -----------------------------------------------------------------------------
-- RPC públicas (únicas vías de escritura)
-- Errores esperables para el frontend:
--   28000 sin sesión · 42501 sin permiso · 22023 dato inválido ·
--   23505 duplicado (slug, sucursal) · 23514 formato inválido o reservado ·
--   P0001 límite alcanzado · P0002 no encontrado
-- -----------------------------------------------------------------------------

-- Alta de la clínica: crea la clínica, la membresía de propietario y la
-- primera sucursal en una sola transacción. D5: 1 clínica por usuario en el MVP.
create or replace function public.create_tenant(
  p_display_name text,
  p_kind public.tenant_kind,
  p_slug text,
  p_owner_display_name text default '',
  p_owner_title text default '',
  p_brand_color text default null
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
  -- Serializa altas concurrentes del mismo usuario para respetar el límite.
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

  insert into public.tenants (kind, display_name, slug, owner_display_name, owner_title, brand_color, created_by)
  values (
    p_kind,
    btrim(p_display_name),
    lower(btrim(p_slug)),
    left(btrim(coalesce(p_owner_display_name, '')), 120),
    left(btrim(coalesce(p_owner_title, '')), 60),
    private.ensure_brand_color(p_brand_color),
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

-- Identidad de la clínica (P04 paso 1 / M10). Solo propietario o administrador
-- de una clínica activa. NULL = no cambiar ese campo. `p_logo_path` = '' borra el logo.
create or replace function public.update_tenant_identity(
  p_tenant uuid,
  p_display_name text default null,
  p_owner_display_name text default null,
  p_owner_title text default null,
  p_logo_path text default null,
  p_brand_color text default null
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
                       else private.ensure_brand_color(p_brand_color) end
  where id = p_tenant
  returning * into v_new;

  if v_new.display_name is distinct from v_old.display_name then v_changed := array_append(v_changed, 'display_name'); end if;
  if v_new.owner_display_name is distinct from v_old.owner_display_name then v_changed := array_append(v_changed, 'owner_display_name'); end if;
  if v_new.owner_title is distinct from v_old.owner_title then v_changed := array_append(v_changed, 'owner_title'); end if;
  if v_new.logo_path is distinct from v_old.logo_path then v_changed := array_append(v_changed, 'logo_path'); end if;
  if v_new.brand_color is distinct from v_old.brand_color then v_changed := array_append(v_changed, 'brand_color'); end if;

  if cardinality(v_changed) > 0 then
    -- Solo los nombres de los campos: sin datos personales en claro.
    perform private.write_audit(p_tenant, 'tenant.identity_updated', 'tenant', p_tenant::text,
      jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;

  return v_new;
end;
$$;

-- Perfil propio. NULL = no cambiar; '' en el teléfono lo borra.
create or replace function public.update_my_profile(
  p_full_name text default null,
  p_phone_e164 text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_profile public.profiles;
begin
  update public.profiles set
    full_name = coalesce(left(btrim(p_full_name), 120), full_name),
    phone_e164 = case when p_phone_e164 is null then phone_e164
                      else nullif(btrim(p_phone_e164), '') end
  where id = v_uid
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Perfil no encontrado' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

-- Alta de sucursal. Solo propietario o administrador de una clínica activa.
create or replace function public.create_branch(
  p_tenant uuid,
  p_name text,
  p_address text default ''
)
returns public.branches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches;
begin
  perform private.require_manager(p_tenant);

  insert into public.branches (tenant_id, name, address)
  values (p_tenant, btrim(p_name), left(btrim(coalesce(p_address, '')), 300))
  returning * into v_branch;

  perform private.write_audit(p_tenant, 'branch.created', 'branch', v_branch.id::text);
  return v_branch;
end;
$$;

-- Cambios de sucursal. NULL = no cambiar. No se borran: se desactivan.
-- No se puede desactivar la última sucursal activa.
create or replace function public.update_branch(
  p_branch uuid,
  p_name text default null,
  p_address text default null,
  p_is_active boolean default null
)
returns public.branches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_branch public.branches;
begin
  select tenant_id into v_tenant from public.branches where id = p_branch;
  if v_tenant is null then
    raise exception 'Sucursal no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_tenant);

  if p_is_active is false and not exists (
    select 1 from public.branches
    where tenant_id = v_tenant and is_active and id <> p_branch
  ) then
    raise exception 'Tu clínica necesita al menos una sucursal activa' using errcode = '22023';
  end if;

  update public.branches set
    name = coalesce(btrim(p_name), name),
    address = coalesce(left(btrim(p_address), 300), address),
    is_active = coalesce(p_is_active, is_active)
  where id = p_branch
  returning * into v_branch;

  perform private.write_audit(v_tenant, 'branch.updated', 'branch', p_branch::text,
    jsonb_build_object('is_active', v_branch.is_active));
  return v_branch;
end;
$$;

-- Sucursales permitidas de una membresía. Arreglo vacío = todas.
create or replace function public.set_membership_branches(
  p_membership uuid,
  p_branch_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_ids uuid[] := coalesce(p_branch_ids, '{}');
begin
  select tenant_id into v_tenant from public.memberships where id = p_membership;
  if v_tenant is null then
    raise exception 'Membresía no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_manager(v_tenant);

  if exists (
    select 1 from unnest(v_ids) as b(id)
    where not exists (select 1 from public.branches br where br.id = b.id and br.tenant_id = v_tenant)
  ) then
    raise exception 'Alguna sucursal no pertenece a tu clínica' using errcode = '22023';
  end if;

  delete from public.membership_branches where membership_id = p_membership;
  insert into public.membership_branches (tenant_id, membership_id, branch_id)
  select distinct v_tenant, p_membership, b.id from unnest(v_ids) as b(id);

  perform private.write_audit(v_tenant, 'membership.branches_set', 'membership', p_membership::text,
    jsonb_build_object('branches', cardinality(v_ids)));
end;
$$;

-- Cambio de estatus de una clínica: SOLO superadmin, con motivo.
create or replace function public.admin_set_tenant_status(
  p_tenant uuid,
  p_status public.tenant_status,
  p_reason text
)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
begin
  if not private.is_platform_admin() then
    raise exception 'Solo un superadministrador puede cambiar el estatus' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo del cambio de estatus' using errcode = '22023';
  end if;

  perform set_config('dentro.audit_reason', left(btrim(p_reason), 500), true);
  update public.tenants set status = p_status where id = p_tenant
  returning * into v_tenant;
  perform set_config('dentro.audit_reason', '', true);

  if v_tenant.id is null then
    raise exception 'Clínica no encontrada' using errcode = 'P0002';
  end if;
  return v_tenant;
end;
$$;

-- Para que el frontend sepa si mostrar el panel de plataforma.
-- La autorización real siempre se valida en RLS y en las RPC.
create or replace function public.am_i_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_platform_admin();
$$;

-- -----------------------------------------------------------------------------
-- Privilegios de funciones
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_member_any_status(uuid) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.tenant_role[]) to authenticated;
grant execute on function private.can_write(uuid, public.tenant_role[]) to authenticated;
grant execute on function private.shares_tenant_with(uuid) to authenticated;
grant execute on function private.is_reserved_slug(text) to authenticated;  -- usada por el CHECK de tenants
grant execute on function private.handle_new_user() to supabase_auth_admin;

revoke all on function public.create_tenant(text, public.tenant_kind, text, text, text, text) from public, anon;
grant execute on function public.create_tenant(text, public.tenant_kind, text, text, text, text) to authenticated;
revoke all on function public.update_tenant_identity(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_tenant_identity(uuid, text, text, text, text, text) to authenticated;
revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;
revoke all on function public.create_branch(uuid, text, text) from public, anon;
grant execute on function public.create_branch(uuid, text, text) to authenticated;
revoke all on function public.update_branch(uuid, text, text, boolean) from public, anon;
grant execute on function public.update_branch(uuid, text, text, boolean) to authenticated;
revoke all on function public.set_membership_branches(uuid, uuid[]) from public, anon;
grant execute on function public.set_membership_branches(uuid, uuid[]) to authenticated;
revoke all on function public.admin_set_tenant_status(uuid, public.tenant_status, text) from public, anon;
grant execute on function public.admin_set_tenant_status(uuid, public.tenant_status, text) to authenticated;
revoke all on function public.am_i_platform_admin() from public, anon;
grant execute on function public.am_i_platform_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- RLS y privilegios de tablas: `authenticated` SOLO lee. Sin escrituras directas.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.branches enable row level security;
alter table public.membership_branches enable row level security;
alter table public.audit_logs enable row level security;
alter table private.platform_admins enable row level security;

revoke all on public.profiles, public.tenants, public.memberships, public.branches,
  public.membership_branches, public.audit_logs from anon, authenticated;
revoke all on private.platform_admins from public, anon, authenticated;

grant select on public.profiles, public.tenants, public.memberships, public.branches,
  public.membership_branches, public.audit_logs to authenticated;

-- profiles: el propio, los de compañeros de clínicas no canceladas y el superadmin.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.shares_tenant_with(id))
    or (select private.is_platform_admin())
  );

-- tenants: sus miembros ven la ficha incluso suspendida o cancelada (para el aviso).
create policy tenants_select on public.tenants
  for select to authenticated
  using (
    (select private.is_member_any_status(id))
    or (select private.is_platform_admin())
  );

-- memberships: las propias; las de la clínica para sus miembros; el superadmin todas.
create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_member(tenant_id))
    or (select private.is_platform_admin())
  );

-- branches y membership_branches: miembros de la clínica y superadmin.
create policy branches_select on public.branches
  for select to authenticated
  using (
    (select private.is_member(tenant_id))
    or (select private.is_platform_admin())
  );

create policy membership_branches_select on public.membership_branches
  for select to authenticated
  using (
    (select private.is_member(tenant_id))
    or (select private.is_platform_admin())
  );

-- audit_logs: propietario/administrador de una clínica no cancelada y superadmin.
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    (tenant_id is not null
      and (select private.has_role(tenant_id, array['owner', 'admin']::public.tenant_role[])))
    or (select private.is_platform_admin())
  );
