import type { Json, Tables } from '@/lib/db'
import type { ItemDraft, QuoteStats, QuoteStatus } from '@/lib/quotes'
import { supabase } from '@/lib/supabase'

export type Quote = Tables<'quotes'>
export type QuoteItem = Tables<'quote_items'>
export type QuoteCard = Quote & { patientName: string; patientPhone: string | null }
export const QUOTES_PER_COLUMN = 50

async function withPatientNames(rows: Quote[]): Promise<QuoteCard[]> {
  const ids = [...new Set(rows.map((r) => r.patient_id))]
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('patients').select('id, full_name, phone_e164').in('id', ids)
  if (error) throw error
  const byId = new Map(((data ?? []) as { id: string; full_name: string; phone_e164: string | null }[]).map((p) => [p.id, p]))
  return rows.map((r) => ({ ...r, patientName: byId.get(r.patient_id)?.full_name ?? 'Paciente', patientPhone: byId.get(r.patient_id)?.phone_e164 ?? null }))
}

/** Una columna del Kanban (RLS: el doctor ve solo los de sus pacientes). Paginada en el servidor. */
export async function listQuoteColumn(opts: { tenantId: string; status: QuoteStatus; doctorId?: string }): Promise<{ rows: QuoteCard[]; total: number }> {
  let q = supabase.from('quotes').select('*', { count: 'exact' }).eq('tenant_id', opts.tenantId).eq('status', opts.status)
  if (opts.doctorId) q = q.eq('doctor_id', opts.doctorId)
  const { data, error, count } = await q.order('status_changed_at', { ascending: false }).range(0, QUOTES_PER_COLUMN - 1)
  if (error) throw error
  return { rows: await withPatientNames((data ?? []) as Quote[]), total: count ?? 0 }
}

export async function listPatientQuotes(patientId: string): Promise<Quote[]> {
  const { data, error } = await supabase.from('quotes').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).range(0, 49)
  if (error) throw error
  return (data ?? []) as Quote[]
}

export async function getQuote(id: string): Promise<{ quote: QuoteCard; items: QuoteItem[] } | null> {
  const { data, error } = await supabase.from('quotes').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: items, error: iErr } = await supabase.from('quote_items').select('*').eq('quote_id', id).order('position', { ascending: true })
  if (iErr) throw iErr
  const [quote] = await withPatientNames([data as Quote])
  return { quote: quote!, items: (items ?? []) as QuoteItem[] }
}

export type QuoteInput = {
  patientId: string
  doctorId: string | null
  title: string
  items: ItemDraft[]
  downPayment: number
  installments: number
  validUntil: string
  notes: string
}

export async function saveQuote(id: string | null, i: QuoteInput): Promise<Quote> {
  const { data, error } = await supabase.rpc('save_quote', {
    // NULL = crear nuevo / sin doctor. El generador de tipos no modela NULL en argumentos sin default.
    p_quote: id as string,
    p_patient: i.patientId,
    p_doctor: i.doctorId as string,
    p_items: i.items.map((x) => ({
      ...(x.treatmentId ? { treatment_id: x.treatmentId } : {}),
      concept: x.concept.trim(),
      note: x.note.trim(),
      quantity: x.quantity,
      unit_price: x.discount ? -Math.abs(x.unitPrice) : x.unitPrice,
    })) as unknown as Json,
    p_title: i.title.trim(),
    p_down_payment: i.installments > 0 ? i.downPayment : 0,
    p_installments: i.installments,
    p_valid_until: i.validUntil,
    ...(i.notes.trim() ? { p_notes: i.notes.trim() } : {}),
  })
  if (error) throw error
  return data as Quote
}

export async function setQuoteStatus(id: string, status: QuoteStatus, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('set_quote_status', { p_quote: id, p_status: status, ...(reason?.trim() ? { p_reason: reason.trim() } : {}) })
  if (error) throw error
}

export async function markQuoteFollowup(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_quote_followup', { p_quote: id })
  if (error) throw error
}

export async function quoteStats(tenantId: string, since: string, doctorId?: string): Promise<QuoteStats> {
  const { data, error } = await supabase.rpc('quote_stats', { p_tenant: tenantId, p_since: since, ...(doctorId ? { p_doctor: doctorId } : {}) })
  if (error) throw error
  return data as unknown as QuoteStats
}
