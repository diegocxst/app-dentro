-- =============================================================================
-- Verificación posterior a aplicar 20261115000100_core_tenancy (solo lectura).
-- Uso en dev (con aprobación): pegar en el SQL Editor o
--   supabase db query --linked -f supabase/tests/core_post_apply_check.sql
-- =============================================================================
select json_build_object(
  'tablas', (select json_agg(json_build_object(
                'tabla', n.nspname || '.' || c.relname,
                'rls', c.relrowsecurity) order by n.nspname, c.relname)
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where c.relkind = 'r' and n.nspname in ('public', 'private')),
  'funciones_sin_search_path', (select coalesce(json_agg(n.nspname || '.' || p.proname), '[]')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname in ('public', 'private')
               and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'politicas', (select json_agg(tablename || ':' || policyname || ' (' || cmd || ')' order by 1)
             from pg_policies where schemaname in ('public', 'private')),
  'privilegios_anon', (select coalesce(json_agg(table_schema || '.' || table_name || ':' || privilege_type), '[]')
             from information_schema.role_table_grants
             where grantee = 'anon' and table_schema in ('public', 'private')),
  'escrituras_authenticated', (select coalesce(json_agg(table_name || ':' || privilege_type), '[]')
             from information_schema.role_table_grants
             where grantee = 'authenticated' and table_schema in ('public', 'private')
               and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  'anon_usage_private', has_schema_privilege('anon', 'private', 'USAGE'),
  'datos', json_build_object(
     'usuarios', (select count(*) from auth.users),
     'clinicas', (select count(*) from public.tenants),
     'auditoria', (select count(*) from public.audit_logs))
) as verificacion_core;
