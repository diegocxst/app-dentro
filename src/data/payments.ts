import { balanceAfter, type PatientAccount, type PaymentMethod, type PaymentStats } from '@/lib/payments'
import type { Database, Tables } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export type Payment = Tables<'payments'>
export type PaymentRow = Payment & { patientName: string }
export type Receivable = Database['public']['Functions']['receivables']['Returns'][number]
export const PAYMENTS_PAGE_SIZE = 25

/** Pagos de la clínica, del más reciente al más antiguo, paginados en el servidor. */
export async function listPayments(opts: { tenantId: string; page: number; from?: string }): Promise<{ rows: PaymentRow[]; total: number }> {
  const start = opts.page * PAYMENTS_PAGE_SIZE
  let q = supabase.from('payments').select('*', { count: 'exact' }).eq('tenant_id', opts.tenantId)
  if (opts.from) q = q.gte('paid_at', opts.from)
  const { data, error, count } = await q.order('paid_at', { ascending: false }).range(start, start + PAYMENTS_PAGE_SIZE - 1)
  if (error) throw error
  const rows = (data ?? []) as Payment[]
  const ids = [...new Set(rows.map((r) => r.patient_id))]
  let names = new Map<string, string>()
  if (ids.length) {
    const { data: ps, error: pErr } = await supabase.from('patients').select('id, full_name').in('id', ids)
    if (pErr) throw pErr
    names = new Map(((ps ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]))
  }
  return { rows: rows.map((r) => ({ ...r, patientName: names.get(r.patient_id) ?? 'Paciente' })), total: count ?? 0 }
}

/** Pagos del paciente (RLS: el doctor solo los de sus pacientes). */
export async function listPatientPayments(patientId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('*').eq('patient_id', patientId).order('paid_at', { ascending: false }).range(0, 99)
  if (error) throw error
  return (data ?? []) as Payment[]
}

export async function patientAccount(patientId: string): Promise<PatientAccount> {
  const { data, error } = await supabase.rpc('patient_account', { p_patient: patientId })
  if (error) throw error
  const a = data as unknown as PatientAccount
  return { ...a, paid_total: Number(a.paid_total), balance: Number(a.balance), quotes: a.quotes.map((q) => ({ ...q, total: Number(q.total), down_payment: Number(q.down_payment), paid: Number(q.paid), balance: Number(q.balance) })) }
}

export type NewPayment = { patientId: string; quoteId: string | null; amount: number; method: PaymentMethod; paidAt: string; reference: string; notes: string }

export async function registerPayment(p: NewPayment): Promise<Payment> {
  const { data, error } = await supabase.rpc('register_payment', {
    p_patient: p.patientId,
    p_amount: p.amount,
    p_method: p.method,
    p_paid_at: p.paidAt,
    ...(p.quoteId ? { p_quote: p.quoteId } : {}),
    ...(p.reference.trim() ? { p_reference: p.reference.trim() } : {}),
    ...(p.notes.trim() ? { p_notes: p.notes.trim() } : {}),
  })
  if (error) throw error
  return data as Payment
}

export async function voidPayment(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_payment', { p_payment: id, p_reason: reason.trim() })
  if (error) throw error
}

export async function paymentStats(tenantId: string, dayStart: string, monthStart: string): Promise<PaymentStats> {
  const { data, error } = await supabase.rpc('payment_stats', { p_tenant: tenantId, p_day_start: dayStart, p_month_start: monthStart })
  if (error) throw error
  const s = data as unknown as PaymentStats
  return { today: Number(s.today), month: Number(s.month), month_count: Number(s.month_count), receivable: Number(s.receivable) }
}

export async function listReceivables(tenantId: string): Promise<Receivable[]> {
  const { data, error } = await supabase.rpc('receivables', { p_tenant: tenantId })
  if (error) throw error
  return ((data ?? []) as Receivable[]).map((r) => ({ ...r, balance: Number(r.balance) }))
}

/** Pagos de un presupuesto (RLS: quien ve al paciente). */
export async function listQuotePayments(quoteId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('*').eq('quote_id', quoteId).order('paid_at', { ascending: false }).range(0, 99)
  if (error) throw error
  return (data ?? []) as Payment[]
}

export type Receipt = {
  payment: Payment
  patientName: string
  patientPhone: string | null
  quote: { id: string; folio: number; title: string; total: number } | null
  /** Saldo del presupuesto después de este pago (null si fue un abono suelto). */
  balance: number | null
}

/** Datos del comprobante de un pago. `null` si no existe o no se puede ver (RLS). */
export async function getReceipt(paymentId: string): Promise<Receipt | null> {
  const { data, error } = await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const payment = data as Payment
  const { data: patient, error: pErr } = await supabase.from('patients').select('full_name, phone_e164').eq('id', payment.patient_id).maybeSingle()
  if (pErr) throw pErr
  const p = patient as { full_name: string; phone_e164: string | null } | null
  let quote: Receipt['quote'] = null
  let balance: number | null = null
  if (payment.quote_id) {
    const [{ data: q, error: qErr }, quotePayments] = await Promise.all([
      supabase.from('quotes').select('id, folio, title, total').eq('id', payment.quote_id).maybeSingle(),
      listQuotePayments(payment.quote_id),
    ])
    if (qErr) throw qErr
    if (q) {
      const row = q as { id: string; folio: number; title: string; total: number | string }
      quote = { id: row.id, folio: row.folio, title: row.title, total: Number(row.total) }
      balance = balanceAfter(quote.total, quotePayments, payment.id)
    }
  }
  return { payment, patientName: p?.full_name ?? 'Paciente', patientPhone: p?.phone_e164 ?? null, quote, balance }
}
