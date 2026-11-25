import { supabase } from '@/lib/supabase'
import { EMPTY_GROUPS, type DoctorHistory, type QuoteGroups, type QuoteReportRow } from '@/lib/reports'

const groups = <T extends QuoteGroups>(r: T): T => {
  const out = { ...r }
  for (const k of Object.keys(EMPTY_GROUPS) as (keyof QuoteGroups)[]) (out as QuoteGroups)[k] = Number(r[k] ?? 0)
  return out
}

/** Presupuestos por doctor del periodo. Solo la dueña o el dueño. */
export async function doctorQuoteReport(tenantId: string, from: string, to: string): Promise<QuoteReportRow[]> {
  const { data, error } = await supabase.rpc('doctor_quote_report', { p_tenant: tenantId, p_from: from, p_to: to })
  if (error) throw error
  return ((data ?? []) as QuoteReportRow[]).map(groups)
}

/** Historial de un doctor en el periodo. Solo la dueña o el dueño. */
export async function doctorHistory(doctorId: string, from: string, to: string): Promise<DoctorHistory> {
  const { data, error } = await supabase.rpc('doctor_history', { p_doctor: doctorId, p_from: from, p_to: to })
  if (error) throw error
  const d = data as unknown as DoctorHistory
  return {
    ...d,
    collected: Number(d.collected),
    commission: Number(d.commission),
    patients: Number(d.patients),
    quotes: groups({ ...EMPTY_GROUPS, ...d.quotes }),
  }
}
