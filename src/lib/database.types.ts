// Generado con: npx supabase gen types typescript --remote --schema public
// Proyecto dev dentro-dentistas-app · migraciones 0001–0004 · 2026-11-15. NO editar a mano: regenerar tras cada migración.
// ⚠️ PROVISIONAL: invitations y sus RPC (migración 0005) agregados a mano hasta aplicarla en dev.
// Nota: las tablas traen Insert/Update, pero la base NO da escrituras directas (todo por RPC).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      invitations: {
        Row: { accepted_at: string | null; accepted_by: string | null; branch_ids: string[]; created_at: string; email: string; expires_at: string; id: string; invited_by: string | null; role: Database["public"]["Enums"]["tenant_role"]; status: Database["public"]["Enums"]["invitation_status"]; tenant_id: string; updated_at: string }
        Insert: { email: string; role: Database["public"]["Enums"]["tenant_role"]; tenant_id: string }
        Update: { status?: Database["public"]["Enums"]["invitation_status"] }
        Relationships: []
      }
      account_consents: {
        Row: {
          accepted_at: string
          id: number
          notice_id: string
          source: Database["public"]["Enums"]["consent_source"]
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: never
          notice_id: string
          source: Database["public"]["Enums"]["consent_source"]
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: never
          notice_id?: string
          source?: Database["public"]["Enums"]["consent_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_consents_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "privacy_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_branches: {
        Row: {
          branch_id: string
          created_at: string
          membership_id: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          membership_id: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          membership_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_branches_tenant_id_branch_id_fkey"
            columns: ["tenant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "membership_branches_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["tenant_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_notices: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          is_draft: boolean
          published_at: string
          title: string
          url_path: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          is_draft?: boolean
          published_at?: string
          title: string
          url_path?: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          is_draft?: boolean
          published_at?: string
          title?: string
          url_path?: string
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string
          id: string
          phone_e164: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone_e164?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone_e164?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          brand_color: string
          city: string
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          kind: Database["public"]["Enums"]["tenant_kind"]
          logo_path: string | null
          onboarding_state: Json
          owner_display_name: string
          owner_title: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
          whatsapp_e164: string | null
        }
        Insert: {
          brand_color?: string
          city?: string
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          kind: Database["public"]["Enums"]["tenant_kind"]
          logo_path?: string | null
          onboarding_state?: Json
          owner_display_name?: string
          owner_title?: string
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
          whatsapp_e164?: string | null
        }
        Update: {
          brand_color?: string
          city?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["tenant_kind"]
          logo_path?: string | null
          onboarding_state?: Json
          owner_display_name?: string
          owner_title?: string
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
          whatsapp_e164?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_my_invitations: { Args: never; Returns: number }
      create_invitation: {
        Args: { p_branch_ids?: string[]; p_email: string; p_role: Database["public"]["Enums"]["tenant_role"]; p_tenant: string }
        Returns: Database["public"]["Tables"]["invitations"]["Row"]
      }
      revoke_invitation: { Args: { p_invitation: string }; Returns: Database["public"]["Tables"]["invitations"]["Row"] }
      revoke_member: { Args: { p_membership: string }; Returns: Database["public"]["Tables"]["memberships"]["Row"] }
      update_member_role: {
        Args: { p_membership: string; p_role: Database["public"]["Enums"]["tenant_role"] }
        Returns: Database["public"]["Tables"]["memberships"]["Row"]
      }
      accept_privacy_notice: {
        Args: {
          p_source?: Database["public"]["Enums"]["consent_source"]
          p_version: string
        }
        Returns: {
          accepted_at: string
          id: number
          notice_id: string
          source: Database["public"]["Enums"]["consent_source"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "account_consents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_tenant_status: {
        Args: {
          p_reason: string
          p_status: Database["public"]["Enums"]["tenant_status"]
          p_tenant: string
        }
        Returns: {
          brand_color: string
          city: string
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          kind: Database["public"]["Enums"]["tenant_kind"]
          logo_path: string | null
          onboarding_state: Json
          owner_display_name: string
          owner_title: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
          whatsapp_e164: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      am_i_platform_admin: { Args: never; Returns: boolean }
      create_branch: {
        Args: { p_address?: string; p_name: string; p_tenant: string }
        Returns: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_tenant: {
        Args: {
          p_brand_color?: string
          p_city?: string
          p_display_name: string
          p_kind: Database["public"]["Enums"]["tenant_kind"]
          p_owner_display_name?: string
          p_owner_title?: string
          p_slug: string
          p_whatsapp_e164?: string
        }
        Returns: {
          brand_color: string
          city: string
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          kind: Database["public"]["Enums"]["tenant_kind"]
          logo_path: string | null
          onboarding_state: Json
          owner_display_name: string
          owner_title: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
          whatsapp_e164: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_membership_branches: {
        Args: { p_branch_ids: string[]; p_membership: string }
        Returns: undefined
      }
      update_branch: {
        Args: {
          p_address?: string
          p_branch: string
          p_is_active?: boolean
          p_name?: string
        }
        Returns: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_profile: {
        Args: { p_full_name?: string; p_phone_e164?: string }
        Returns: {
          avatar_path: string | null
          created_at: string
          full_name: string
          id: string
          phone_e164: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_tenant_identity: {
        Args: {
          p_brand_color?: string
          p_city?: string
          p_display_name?: string
          p_logo_path?: string
          p_owner_display_name?: string
          p_owner_title?: string
          p_tenant: string
          p_whatsapp_e164?: string
        }
        Returns: {
          brand_color: string
          city: string
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          kind: Database["public"]["Enums"]["tenant_kind"]
          logo_path: string | null
          onboarding_state: Json
          owner_display_name: string
          owner_title: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
          whatsapp_e164: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      invitation_status: "pending" | "accepted" | "revoked"
      consent_source: "signup" | "invite" | "renewal"
      membership_status: "active" | "invited" | "revoked"
      tenant_kind: "independent" | "clinic"
      tenant_role: "owner" | "admin" | "reception" | "doctor" | "doctor_collab"
      tenant_status: "active" | "suspended" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      consent_source: ["signup", "invite", "renewal"],
      membership_status: ["active", "invited", "revoked"],
      tenant_kind: ["independent", "clinic"],
      tenant_role: ["owner", "admin", "reception", "doctor", "doctor_collab"],
      tenant_status: ["active", "suspended", "cancelled"],
    },
  },
} as const
