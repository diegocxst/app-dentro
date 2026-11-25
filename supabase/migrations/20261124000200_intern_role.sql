-- =============================================================================
-- 0020 · Rol «Pasante» (E3 · M6-B2a)
--
-- Reglas (aprobadas por Diego el 2026-11-24):
--   * Nuevo valor del enum tenant_role: 'doctor_intern' («Pasante»).
--   * Va solo en este archivo: Postgres no deja usar un valor nuevo de un enum en la
--     misma transacción en la que se agrega. Sus permisos se definen en la 0021.
-- Rollback: supabase/rollback/20261124000200_intern_role.down.sql
-- =============================================================================

alter type public.tenant_role add value if not exists 'doctor_intern' after 'doctor_collab';
