import type { Tables, TenantKind } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

// Consultas del núcleo. Lecturas con RLS; escrituras solo por RPC. Origen: core-base.

export type Tenant = Tables<'tenants'>
export type Branch = Tables<'branches'>
export type Profile = Tables<'profiles'>
export type MyMembership = Pick<Tables<'memberships'>, 'id' | 'role' | 'status' | 'tenant_id'> & { tenant: Tenant }

export async function fetchMyMemberships(userId: string): Promise<MyMembership[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, role, status, tenant_id, tenant:tenants(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as (Omit<MyMembership, 'tenant'> & { tenant: Tenant | null })[]).filter(
    (m): m is MyMembership => m.tenant !== null,
  )
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function fetchIsPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('am_i_platform_admin')
  if (error) throw error
  return data === true
}

/** Sucursales activas de la clínica, en orden alfabético. */
export async function fetchBranches(tenantId: string): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Branch[]
}

export type CreateClinicInput = {
  displayName: string
  kind: TenantKind
  slug: string
  ownerDisplayName: string
  ownerTitle: string
  brandColor: string
}

/** Alta de la clínica (P04 paso 1): crea la clínica, la membresía de dueño y la «Sucursal principal». */
export async function createClinic(input: CreateClinicInput): Promise<Tenant> {
  const { data, error } = await supabase.rpc('create_tenant', {
    p_display_name: input.displayName,
    p_kind: input.kind,
    p_slug: input.slug,
    p_owner_display_name: input.ownerDisplayName,
    p_owner_title: input.ownerTitle,
    p_brand_color: input.brandColor,
  })
  if (error) throw error
  return data as Tenant
}
