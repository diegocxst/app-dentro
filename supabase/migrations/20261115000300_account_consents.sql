-- =============================================================================
-- 0003 · Aviso de privacidad versionado y consentimiento de las cuentas (E1-B5a)
-- LFPDPPP: consentimiento expreso con la versión del aviso que se aceptó.
--
-- Alcance: el aviso de dentro (responsable de los datos de las CUENTAS: dueños,
-- doctores y recepción). El consentimiento de los PACIENTES es de cada clínica y
-- llega con M2 (tabla `patient_consents`, por tenant).
--
-- Rollback: supabase/rollback/20261115000300_account_consents.down.sql
-- Sin BEGIN/COMMIT: `supabase db push` ejecuta el archivo en una transacción.
-- =============================================================================

create type public.consent_source as enum ('signup', 'invite', 'renewal');

-- Versiones del aviso. Una sola vigente a la vez. Se publican por SQL de
-- operación (nunca desde la app) y no se borran: son evidencia.
create table public.privacy_notices (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (version ~ '^[a-z0-9][a-z0-9.-]{2,40}$'),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  -- Ruta pública del texto (la página del aviso en la app).
  url_path text not null default '/aviso-de-privacidad' check (url_path ~ '^/[a-z0-9/-]*$'),
  is_draft boolean not null default true,
  is_current boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index privacy_notices_one_current_idx on public.privacy_notices ((true)) where is_current;

-- Evidencia de aceptación por cuenta y versión. Solo se agrega; nunca se edita.
create table public.account_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  notice_id uuid not null references public.privacy_notices (id),
  source public.consent_source not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, notice_id)
);
create index account_consents_user_idx on public.account_consents (user_id, accepted_at desc);

-- Versión vigente hoy: el borrador mientras el abogado revisa el definitivo (P5).
insert into public.privacy_notices (version, title, is_draft, is_current)
values ('borrador-2026-11-15', 'Aviso de privacidad de dentro (borrador)', true, true);

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Acepta la versión VIGENTE del aviso. Si la app manda otra versión (p. ej. la
-- pantalla quedó abierta y se publicó una nueva), se rechaza para que la persona
-- vea la vigente. Idempotente: aceptar dos veces la misma versión no duplica.
create or replace function public.accept_privacy_notice(
  p_version text,
  p_source public.consent_source default 'renewal'
)
returns public.account_consents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_notice public.privacy_notices;
  v_consent public.account_consents;
begin
  select * into v_notice from public.privacy_notices where is_current;
  if v_notice.id is null or v_notice.version is distinct from p_version then
    raise exception 'El aviso de privacidad cambió. Revisa la versión vigente.' using errcode = '22023';
  end if;

  insert into public.account_consents (user_id, notice_id, source)
  values (v_uid, v_notice.id, p_source)
  on conflict (user_id, notice_id) do nothing;

  select * into v_consent from public.account_consents where user_id = v_uid and notice_id = v_notice.id;
  return v_consent;
end;
$$;

revoke all on function public.accept_privacy_notice(text, public.consent_source) from public, anon;
grant execute on function public.accept_privacy_notice(text, public.consent_source) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS y privilegios: `authenticated` solo lee; escritura por RPC.
-- -----------------------------------------------------------------------------
alter table public.privacy_notices enable row level security;
alter table public.account_consents enable row level security;

revoke all on public.privacy_notices, public.account_consents from anon, authenticated;
grant select on public.privacy_notices, public.account_consents to authenticated;

-- Cualquiera con sesión puede leer las versiones del aviso (son públicas).
create policy privacy_notices_select on public.privacy_notices
  for select to authenticated
  using (true);

-- Cada quien ve sus aceptaciones; el superadmin todas (ARCO y auditoría).
create policy account_consents_select on public.account_consents
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_platform_admin())
  );
