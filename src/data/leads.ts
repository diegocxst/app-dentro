import type { LeadStats, LeadStatus } from '@/lib/leads'
import type { PatientSource, Tables } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export type Lead = Tables<'leads'>
export type LeadActivity = Tables<'lead_activity'> & { actorName: string }
export const LEADS_PER_COLUMN = 50

/** Una columna del Kanban: los más recientes primero, con el total (paginado en el servidor). */
export async function listLeadColumn(opts: { tenantId: string; status: LeadStatus; source?: PatientSource | '' }): Promise<{ rows: Lead[]; total: number }> {
  let q = supabase.from('leads').select('*', { count: 'exact' }).eq('tenant_id', opts.tenantId).eq('status', opts.status)
  if (opts.source) q = q.eq('source', opts.source)
  const { data, error, count } = await q.order('status_changed_at', { ascending: false }).range(0, LEADS_PER_COLUMN - 1)
  if (error) throw error
  return { rows: (data ?? []) as Lead[], total: count ?? 0 }
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Lead | null) ?? null
}

export async function listLeadActivity(leadId: string): Promise<LeadActivity[]> {
  const { data, error } = await supabase.from('lead_activity').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).range(0, 99)
  if (error) throw error
  const rows = (data ?? []) as Tables<'lead_activity'>[]
  const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))]
  let names = new Map<string, string>()
  if (ids.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
    names = new Map(((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]))
  }
  return rows.map((r) => ({ ...r, actorName: (r.actor_id && names.get(r.actor_id)) || 'Equipo' }))
}

export type NewLead = { tenantId: string; fullName: string; phoneE164: string | null; email: string; interest: string; source: PatientSource; assignedTo: string | null; noticeShared: boolean }

export async function createLead(l: NewLead): Promise<Lead> {
  const { data, error } = await supabase.rpc('create_lead', {
    p_tenant: l.tenantId,
    p_full_name: l.fullName,
    p_notice_shared: l.noticeShared,
    ...(l.phoneE164 ? { p_phone_e164: l.phoneE164 } : {}),
    ...(l.email.trim() ? { p_email: l.email.trim() } : {}),
    p_interest: l.interest.trim(),
    p_source: l.source,
    ...(l.assignedTo ? { p_assigned_to: l.assignedTo } : {}),
  })
  if (error) throw error
  return data as Lead
}

/** Solo los campos que cambian ('' borra teléfono, correo o responsable). */
export async function updateLead(id: string, c: { fullName?: string; phoneE164?: string; email?: string; interest?: string; source?: PatientSource; assignedTo?: string }): Promise<void> {
  const { error } = await supabase.rpc('update_lead', {
    p_lead: id,
    ...(c.fullName !== undefined ? { p_full_name: c.fullName } : {}),
    ...(c.phoneE164 !== undefined ? { p_phone_e164: c.phoneE164 } : {}),
    ...(c.email !== undefined ? { p_email: c.email } : {}),
    ...(c.interest !== undefined ? { p_interest: c.interest } : {}),
    ...(c.source !== undefined ? { p_source: c.source } : {}),
    ...(c.assignedTo !== undefined ? { p_assigned_to: c.assignedTo } : {}),
  })
  if (error) throw error
}

export async function setLeadStatus(id: string, status: LeadStatus, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('set_lead_status', { p_lead: id, p_status: status, ...(reason?.trim() ? { p_reason: reason.trim() } : {}) })
  if (error) throw error
}

export async function addLeadNote(id: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('add_lead_note', { p_lead: id, p_body: body.trim() })
  if (error) throw error
}

export async function leadStats(tenantId: string, since: string): Promise<LeadStats> {
  const { data, error } = await supabase.rpc('lead_stats', { p_tenant: tenantId, p_since: since })
  if (error) throw error
  return data as unknown as LeadStats
}
