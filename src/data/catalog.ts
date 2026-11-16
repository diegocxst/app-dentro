import type { Tables } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export type Chair = Tables<'chairs'>
export type Treatment = Tables<'treatments'>
export type Branch = Tables<'branches'>

/** Todas las sucursales (activas e inactivas) para editarlas. */
export async function fetchAllBranches(tenantId: string): Promise<Branch[]> {
  const { data, error } = await supabase.from('branches').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Branch[]
}

export async function fetchChairs(tenantId: string): Promise<Chair[]> {
  const { data, error } = await supabase.from('chairs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Chair[]
}

export async function createBranch(tenantId: string, name: string, address: string): Promise<void> {
  const { error } = await supabase.rpc('create_branch', { p_tenant: tenantId, p_name: name, p_address: address })
  if (error) throw error
}

export async function updateBranch(branchId: string, values: { name?: string; address?: string; isActive?: boolean }): Promise<void> {
  const { error } = await supabase.rpc('update_branch', {
    p_branch: branchId,
    ...(values.name !== undefined ? { p_name: values.name } : {}),
    ...(values.address !== undefined ? { p_address: values.address } : {}),
    ...(values.isActive !== undefined ? { p_is_active: values.isActive } : {}),
  })
  if (error) throw error
}

export async function createChair(branchId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('create_chair', { p_branch: branchId, p_name: name })
  if (error) throw error
}

export async function setChairActive(chairId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc('update_chair', { p_chair: chairId, p_is_active: isActive })
  if (error) throw error
}

export async function fetchTreatments(tenantId: string): Promise<Treatment[]> {
  const { data, error } = await supabase.from('treatments').select('*').eq('tenant_id', tenantId).order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Treatment[]
}

export type TreatmentInput = {
  id?: string
  category: string
  name: string
  price_mxn: number
  duration_minutes: number | null
  is_active: boolean
}

/** Guarda varios tratamientos a la vez (todo o nada). */
export async function saveTreatments(tenantId: string, items: TreatmentInput[]): Promise<number> {
  const { data, error } = await supabase.rpc('save_treatments', { p_tenant: tenantId, p_items: items })
  if (error) throw error
  return typeof data === 'number' ? data : 0
}

export async function setTenantWhatsapp(tenantId: string, whatsappE164: string): Promise<void> {
  const { error } = await supabase.rpc('update_tenant_identity', { p_tenant: tenantId, p_whatsapp_e164: whatsappE164 })
  if (error) throw error
}

export async function setBranchHours(branchId: string, hours: Record<string, [string, string][]>): Promise<void> {
  const { error } = await supabase.rpc('set_branch_hours', { p_branch: branchId, p_hours: hours })
  if (error) throw error
}
