// Alias de los tipos generados de la base (src/lib/database.types.ts).
import type { Database, Enums, Json, Tables } from './database.types'

export type { Database, Json, Tables }
export type TenantKind = Enums<'tenant_kind'>
export type TenantStatus = Enums<'tenant_status'>
export type TenantRole = Enums<'tenant_role'>
export type MembershipStatus = Enums<'membership_status'>
