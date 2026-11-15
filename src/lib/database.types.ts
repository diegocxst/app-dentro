// ⚠️ PROVISIONAL — escrito a mano a partir de
// supabase/migrations/20261115000100_core_tenancy.sql.
// En E1-B4, al conectar el proyecto dev, se REGENERA con:
//   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string; updated_at: string }

export type TenantKind = 'independent' | 'clinic'
export type TenantStatus = 'active' | 'suspended' | 'cancelled'
export type TenantRole = 'owner' | 'admin' | 'reception' | 'doctor' | 'doctor_collab'
export type MembershipStatus = 'active' | 'invited' | 'revoked'

type ProfileRow = Timestamps & {
  id: string
  full_name: string
  phone_e164: string | null
  avatar_path: string | null
}

type TenantRow = Timestamps & {
  id: string
  kind: TenantKind
  display_name: string
  slug: string
  status: TenantStatus
  owner_display_name: string
  owner_title: string
  logo_path: string | null
  brand_color: string
  onboarding_state: Json
  created_by: string | null
}

type MembershipRow = Timestamps & {
  id: string
  tenant_id: string
  user_id: string
  role: TenantRole
  status: MembershipStatus
}

type BranchRow = Timestamps & {
  id: string
  tenant_id: string
  name: string
  address: string
  is_active: boolean
}

type MembershipBranchRow = {
  tenant_id: string
  membership_id: string
  branch_id: string
  created_at: string
}

type AuditLogRow = {
  id: number
  tenant_id: string | null
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  details: Json
  created_at: string
}

/** Las tablas solo se leen: toda escritura va por RPC (Insert/Update vacíos a propósito). */
type ReadOnlyTable<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      profiles: ReadOnlyTable<ProfileRow>
      tenants: ReadOnlyTable<TenantRow>
      memberships: ReadOnlyTable<MembershipRow>
      branches: ReadOnlyTable<BranchRow>
      membership_branches: ReadOnlyTable<MembershipBranchRow>
      audit_logs: ReadOnlyTable<AuditLogRow>
    }
    Views: Record<never, never>
    Functions: {
      create_tenant: {
        Args: {
          p_display_name: string
          p_kind: TenantKind
          p_slug: string
          p_owner_display_name?: string
          p_owner_title?: string
          p_brand_color?: string | null
        }
        Returns: TenantRow
      }
      update_tenant_identity: {
        Args: {
          p_tenant: string
          p_display_name?: string | null
          p_owner_display_name?: string | null
          p_owner_title?: string | null
          p_logo_path?: string | null
          p_brand_color?: string | null
        }
        Returns: TenantRow
      }
      update_my_profile: {
        Args: { p_full_name?: string | null; p_phone_e164?: string | null }
        Returns: ProfileRow
      }
      create_branch: {
        Args: { p_tenant: string; p_name: string; p_address?: string }
        Returns: BranchRow
      }
      update_branch: {
        Args: { p_branch: string; p_name?: string | null; p_address?: string | null; p_is_active?: boolean | null }
        Returns: BranchRow
      }
      set_membership_branches: {
        Args: { p_membership: string; p_branch_ids: string[] }
        Returns: undefined
      }
      admin_set_tenant_status: {
        Args: { p_tenant: string; p_status: TenantStatus; p_reason: string }
        Returns: TenantRow
      }
      am_i_platform_admin: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      tenant_kind: TenantKind
      tenant_status: TenantStatus
      tenant_role: TenantRole
      membership_status: MembershipStatus
    }
    CompositeTypes: Record<never, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
