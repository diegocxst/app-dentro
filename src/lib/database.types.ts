// Generado con: npx supabase gen types typescript --remote --schema public
// Proyecto dev dentro-dentistas-app · migraciones 0001–0012 · 2026-11-16. NO editar a mano: regenerar tras cada migración.
// ⚠️ PROVISIONAL: leads, lead_activity, sus RPC y el enum lead_status (migración 0013) agregados a mano hasta aplicarla en dev.
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
      appointments: {
        Row: {
          branch_id: string
          cancel_reason: string | null
          chair_id: string
          created_at: string
          created_by: string | null
          doctor_id: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["appointment_kind"]
          notes: string | null
          patient_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          treatment_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          cancel_reason?: string | null
          chair_id: string
          created_at?: string
          created_by?: string | null
          doctor_id: string
          ends_at: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          notes?: string | null
          patient_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          treatment_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cancel_reason?: string | null
          chair_id?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string
          ends_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          notes?: string | null
          patient_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id?: string
          treatment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_tenant_id_branch_id_chair_id_fkey"
            columns: ["tenant_id", "branch_id", "chair_id"]
            isOneToOne: false
            referencedRelation: "chairs"
            referencedColumns: ["tenant_id", "branch_id", "id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_branch_id_fkey"
            columns: ["tenant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_doctor_id_fkey"
            columns: ["tenant_id", "doctor_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_patient_id_fkey"
            columns: ["tenant_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_treatment_id_fkey"
            columns: ["tenant_id", "treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      arco_requests: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          details: string | null
          due_on: string
          id: string
          patient_id: string
          received_on: string
          resolved_at: string | null
          resolved_by: string | null
          response: string | null
          right: Database["public"]["Enums"]["arco_right"]
          status: Database["public"]["Enums"]["arco_status"]
          tenant_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          due_on: string
          id?: string
          patient_id: string
          received_on: string
          resolved_at?: string | null
          resolved_by?: string | null
          response?: string | null
          right: Database["public"]["Enums"]["arco_right"]
          status?: Database["public"]["Enums"]["arco_status"]
          tenant_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          due_on?: string
          id?: string
          patient_id?: string
          received_on?: string
          resolved_at?: string | null
          resolved_by?: string | null
          response?: string | null
          right?: Database["public"]["Enums"]["arco_right"]
          status?: Database["public"]["Enums"]["arco_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arco_requests_tenant_id_patient_id_fkey"
            columns: ["tenant_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["tenant_id", "id"]
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
          opening_hours: Json
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          opening_hours?: Json
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          opening_hours?: Json
          tenant_id?: string
          timezone?: string
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
      chairs: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chairs_tenant_id_branch_id_fkey"
            columns: ["tenant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "chairs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          document_id: string
          id: number
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          document_id: string
          id?: never
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          document_id?: string
          id?: never
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_tenant_id_document_id_fkey"
            columns: ["tenant_id", "document_id"]
            isOneToOne: false
            referencedRelation: "patient_documents"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          branch_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          branch_ids?: string[]
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          branch_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_tenant_id_fkey"
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
      lead_activity: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: number
          kind: string
          lead_id: string
          tenant_id: string
          to_status: Database["public"]["Enums"]["lead_status"] | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: number
          kind?: string
          lead_id?: string
          tenant_id?: string
          to_status?: Database["public"]["Enums"]["lead_status"] | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: number
          kind?: string
          lead_id?: string
          tenant_id?: string
          to_status?: Database["public"]["Enums"]["lead_status"] | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          converted_patient_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_response_at: string | null
          full_name: string
          id: string
          interest: string
          lost_reason: string | null
          notice_version: string
          phone_e164: string | null
          source: Database["public"]["Enums"]["patient_source"]
          status: Database["public"]["Enums"]["lead_status"]
          status_changed_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          converted_patient_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_response_at?: string | null
          full_name?: string
          id?: string
          interest?: string
          lost_reason?: string | null
          notice_version?: string
          phone_e164?: string | null
          source?: Database["public"]["Enums"]["patient_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          status_changed_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          converted_patient_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_response_at?: string | null
          full_name?: string
          id?: string
          interest?: string
          lost_reason?: string | null
          notice_version?: string
          phone_e164?: string | null
          source?: Database["public"]["Enums"]["patient_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          status_changed_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
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
      patient_access_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          patient_id: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          patient_id: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          patient_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_access_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_access_log_tenant_id_patient_id_fkey"
            columns: ["tenant_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      patient_consents: {
        Row: {
          id: string
          method: Database["public"]["Enums"]["consent_method"]
          notice_version: string
          patient_id: string
          recorded_at: string
          recorded_by: string | null
          tenant_id: string
        }
        Insert: {
          id?: string
          method: Database["public"]["Enums"]["consent_method"]
          notice_version: string
          patient_id: string
          recorded_at?: string
          recorded_by?: string | null
          tenant_id: string
        }
        Update: {
          id?: string
          method?: Database["public"]["Enums"]["consent_method"]
          notice_version?: string
          patient_id?: string
          recorded_at?: string
          recorded_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_tenant_id_patient_id_fkey"
            columns: ["tenant_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime: string
          name: string
          patient_id: string
          retain_until: string
          size_bytes: number
          storage_path: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime: string
          name: string
          patient_id: string
          retain_until?: string
          size_bytes: number
          storage_path: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime?: string
          name?: string
          patient_id?: string
          retain_until?: string
          size_bytes?: number
          storage_path?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_tenant_id_patient_id_fkey"
            columns: ["tenant_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      patient_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          patient_id: string
          tenant_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          patient_id: string
          tenant_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          patient_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_notes_tenant_id_patient_id_fkey"
            columns: ["tenant_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      patients: {
        Row: {
          archived_at: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          phone_e164: string | null
          primary_doctor_id: string | null
          source: Database["public"]["Enums"]["patient_source"]
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone_e164?: string | null
          primary_doctor_id?: string | null
          source?: Database["public"]["Enums"]["patient_source"]
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone_e164?: string | null
          primary_doctor_id?: string | null
          source?: Database["public"]["Enums"]["patient_source"]
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_tenant_id_primary_doctor_id_fkey"
            columns: ["tenant_id", "primary_doctor_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["tenant_id", "id"]
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
          patient_notice_version: string
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
          patient_notice_version?: string
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
          patient_notice_version?: string
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
          whatsapp_e164?: string | null
        }
        Relationships: []
      }
      treatments: {
        Row: {
          category: string
          created_at: string
          duration_minutes: number | null
          id: string
          is_active: boolean
          name: string
          price_mxn: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name: string
          price_mxn: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price_mxn?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_my_invitations: { Args: never; Returns: number }
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
      add_patient_note: {
        Args: { p_body: string; p_patient: string }
        Returns: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          patient_id: string
          tenant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "patient_notes"
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
          patient_notice_version: string
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
      add_lead_note: { Args: { p_body: string; p_lead: string }; Returns: undefined }
      create_lead: {
        Args: {
          p_assigned_to?: string
          p_email?: string
          p_full_name: string
          p_interest?: string
          p_notice_shared: boolean
          p_phone_e164?: string
          p_source?: Database["public"]["Enums"]["patient_source"]
          p_tenant: string
        }
        Returns: {
          assigned_to: string | null
          converted_patient_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_response_at: string | null
          full_name: string
          id: string
          interest: string
          lost_reason: string | null
          notice_version: string
          phone_e164: string | null
          source: Database["public"]["Enums"]["patient_source"]
          status: Database["public"]["Enums"]["lead_status"]
          status_changed_at: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lead_stats: { Args: { p_since: string; p_tenant: string }; Returns: Json }
      set_lead_status: {
        Args: {
          p_lead: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["lead_status"]
        }
        Returns: {
          assigned_to: string | null
          converted_patient_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_response_at: string | null
          full_name: string
          id: string
          interest: string
          lost_reason: string | null
          notice_version: string
          phone_e164: string | null
          source: Database["public"]["Enums"]["patient_source"]
          status: Database["public"]["Enums"]["lead_status"]
          status_changed_at: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_lead: {
        Args: {
          p_assigned_to?: string
          p_email?: string
          p_full_name?: string
          p_interest?: string
          p_lead: string
          p_phone_e164?: string
          p_source?: Database["public"]["Enums"]["patient_source"]
        }
        Returns: {
          assigned_to: string | null
          converted_patient_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_response_at: string | null
          full_name: string
          id: string
          interest: string
          lost_reason: string | null
          notice_version: string
          phone_e164: string | null
          source: Database["public"]["Enums"]["patient_source"]
          status: Database["public"]["Enums"]["lead_status"]
          status_changed_at: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      authorize_document_access: {
        Args: { p_action: string; p_document: string }
        Returns: Json
      }
      create_appointment: {
        Args: {
          p_branch: string
          p_chair: string
          p_doctor: string
          p_ends_at: string
          p_kind?: Database["public"]["Enums"]["appointment_kind"]
          p_notes?: string
          p_patient: string
          p_starts_at: string
          p_treatment?: string
        }
        Returns: {
          branch_id: string
          cancel_reason: string | null
          chair_id: string
          created_at: string
          created_by: string | null
          doctor_id: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["appointment_kind"]
          notes: string | null
          patient_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          treatment_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_arco_request: {
        Args: {
          p_channel: string
          p_details?: string
          p_patient: string
          p_received_on: string
          p_right: Database["public"]["Enums"]["arco_right"]
        }
        Returns: string
      }
      create_branch: {
        Args: { p_address?: string; p_name: string; p_tenant: string }
        Returns: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          opening_hours: Json
          tenant_id: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_chair: {
        Args: { p_branch: string; p_name: string }
        Returns: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "chairs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invitation: {
        Args: {
          p_branch_ids?: string[]
          p_email: string
          p_role: Database["public"]["Enums"]["tenant_role"]
          p_tenant: string
        }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          branch_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_patient: {
        Args: {
          p_birth_date?: string
          p_consent_method: Database["public"]["Enums"]["consent_method"]
          p_email?: string
          p_full_name: string
          p_phone_e164?: string
          p_primary_doctor?: string
          p_source?: Database["public"]["Enums"]["patient_source"]
          p_tags?: string[]
          p_tenant: string
        }
        Returns: {
          archived_at: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          phone_e164: string | null
          primary_doctor_id: string | null
          source: Database["public"]["Enums"]["patient_source"]
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patients"
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
          patient_notice_version: string
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
      export_patient_data: { Args: { p_patient: string }; Returns: Json }
      list_appointments: {
        Args: {
          p_branch?: string
          p_from: string
          p_patient?: string
          p_to: string
        }
        Returns: {
          branch_id: string
          branch_name: string
          cancel_reason: string
          chair_id: string
          chair_name: string
          doctor_id: string
          doctor_name: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["appointment_kind"]
          notes: string
          patient_id: string
          patient_name: string
          patient_phone: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          treatment_id: string
          treatment_name: string
        }[]
      }
      open_patient: { Args: { p_patient: string }; Returns: Json }
      register_document: {
        Args: {
          p_kind: Database["public"]["Enums"]["document_kind"]
          p_name: string
          p_patient: string
          p_storage_path: string
        }
        Returns: {
          archived_at: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime: string
          name: string
          patient_id: string
          retain_until: string
          size_bytes: number
          storage_path: string
          tenant_id: string
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "patient_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_invitation: {
        Args: { p_invitation: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          branch_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_member: {
        Args: { p_membership: string }
        Returns: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_treatments: {
        Args: { p_items: Json; p_tenant: string }
        Returns: number
      }
      set_appointment_status: {
        Args: {
          p_appointment: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: {
          branch_id: string
          cancel_reason: string | null
          chair_id: string
          created_at: string
          created_by: string | null
          doctor_id: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["appointment_kind"]
          notes: string | null
          patient_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          treatment_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_branch_hours: {
        Args: { p_branch: string; p_hours: Json }
        Returns: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          opening_hours: Json
          tenant_id: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_branch_timezone: {
        Args: { p_branch: string; p_timezone: string }
        Returns: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          opening_hours: Json
          tenant_id: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_document_archived: {
        Args: { p_archived: boolean; p_document: string }
        Returns: {
          archived_at: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime: string
          name: string
          patient_id: string
          retain_until: string
          size_bytes: number
          storage_path: string
          tenant_id: string
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "patient_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_membership_branches: {
        Args: { p_branch_ids: string[]; p_membership: string }
        Returns: undefined
      }
      set_onboarding_task: {
        Args: { p_done: boolean; p_task: string; p_tenant: string }
        Returns: Json
      }
      set_patient_archived: {
        Args: { p_archived: boolean; p_patient: string }
        Returns: {
          archived_at: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          phone_e164: string | null
          primary_doctor_id: string | null
          source: Database["public"]["Enums"]["patient_source"]
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_appointment: {
        Args: {
          p_appointment: string
          p_branch: string
          p_chair: string
          p_doctor: string
          p_ends_at: string
          p_kind: Database["public"]["Enums"]["appointment_kind"]
          p_notes?: string
          p_starts_at: string
          p_treatment?: string
        }
        Returns: {
          branch_id: string
          cancel_reason: string | null
          chair_id: string
          created_at: string
          created_by: string | null
          doctor_id: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["appointment_kind"]
          notes: string | null
          patient_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          treatment_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_arco_request: {
        Args: {
          p_request: string
          p_response?: string
          p_status: Database["public"]["Enums"]["arco_status"]
        }
        Returns: {
          channel: string
          created_at: string
          created_by: string | null
          details: string | null
          due_on: string
          id: string
          patient_id: string
          received_on: string
          resolved_at: string | null
          resolved_by: string | null
          response: string | null
          right: Database["public"]["Enums"]["arco_right"]
          status: Database["public"]["Enums"]["arco_status"]
          tenant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "arco_requests"
          isOneToOne: true
          isSetofReturn: false
        }
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
          opening_hours: Json
          tenant_id: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_chair: {
        Args: { p_chair: string; p_is_active?: boolean; p_name?: string }
        Returns: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "chairs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_member_role: {
        Args: {
          p_membership: string
          p_role: Database["public"]["Enums"]["tenant_role"]
        }
        Returns: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
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
      update_patient: {
        Args: {
          p_birth_date?: string
          p_email?: string
          p_full_name?: string
          p_patient: string
          p_phone_e164?: string
          p_primary_doctor?: string
          p_source?: Database["public"]["Enums"]["patient_source"]
          p_tags?: string[]
        }
        Returns: {
          archived_at: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          phone_e164: string | null
          primary_doctor_id: string | null
          source: Database["public"]["Enums"]["patient_source"]
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patients"
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
          patient_notice_version: string
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
      appointment_kind: "valoracion" | "tratamiento" | "revision"
      appointment_status:
        | "programada"
        | "confirmada"
        | "llego"
        | "no_asistio"
        | "cancelada"
      arco_right: "acceso" | "rectificacion" | "cancelacion" | "oposicion"
      arco_status: "recibida" | "en_proceso" | "atendida" | "improcedente"
      consent_method: "papel" | "digital"
      consent_source: "signup" | "invite" | "renewal"
      document_kind:
        | "radiografia"
        | "foto"
        | "receta"
        | "consentimiento"
        | "presupuesto"
        | "formulario"
        | "modelo"
        | "otro"
      invitation_status: "pending" | "accepted" | "revoked"
      lead_status: "nuevo" | "contactado" | "valoracion" | "convertido" | "perdido"
      membership_status: "active" | "invited" | "revoked"
      patient_source:
        | "meta"
        | "perfil"
        | "referido"
        | "whatsapp"
        | "manual"
        | "otro"
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
      appointment_kind: ["valoracion", "tratamiento", "revision"],
      appointment_status: [
        "programada",
        "confirmada",
        "llego",
        "no_asistio",
        "cancelada",
      ],
      arco_right: ["acceso", "rectificacion", "cancelacion", "oposicion"],
      arco_status: ["recibida", "en_proceso", "atendida", "improcedente"],
      consent_method: ["papel", "digital"],
      consent_source: ["signup", "invite", "renewal"],
      document_kind: [
        "radiografia",
        "foto",
        "receta",
        "consentimiento",
        "presupuesto",
        "formulario",
        "modelo",
        "otro",
      ],
      invitation_status: ["pending", "accepted", "revoked"],
      lead_status: ["nuevo", "contactado", "valoracion", "convertido", "perdido"],
      membership_status: ["active", "invited", "revoked"],
      patient_source: [
        "meta",
        "perfil",
        "referido",
        "whatsapp",
        "manual",
        "otro",
      ],
      tenant_kind: ["independent", "clinic"],
      tenant_role: ["owner", "admin", "reception", "doctor", "doctor_collab"],
      tenant_status: ["active", "suspended", "cancelled"],
    },
  },
} as const
