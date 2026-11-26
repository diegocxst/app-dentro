import type { CommissionKind, CommissionLine, CommissionPeriodKind, CommissionRow, TreatmentRule } from '@/lib/commissions'
import { supabase } from '@/lib/supabase'

export const LINES_PAGE_SIZE = 50

/** Resumen del periodo: gerencia ve a todos los doctores; un doctor, solo su fila. */
export async function commissionSummary(tenantId: string, from: string, to: string): Promise<CommissionRow[]> {
  const { data, error } = await supabase.rpc('commission_summary', { p_tenant: tenantId, p_from: from, p_to: to })
  if (error) throw error
  const num = (v: unknown) => (v === null || v === undefined ? v : Number(v)) as number
  return ((data ?? []) as CommissionRow[]).map((r) => ({
    ...r,
    percent: num(r.percent),
    rent_amount: num(r.rent_amount),
    collected: Number(r.collected),
    commission: Number(r.commission),
    pending: Number(r.pending),
    paid: Number(r.paid),
    rent_due: Number(r.rent_due),
  }))
}

/** Movimientos de un doctor en el periodo, paginados en el servidor. */
export async function commissionLines(doctorId: string, from: string, to: string, page = 0): Promise<{ rows: CommissionLine[]; total: number }> {
  const { data, error } = await supabase.rpc('commission_lines', { p_doctor: doctorId, p_from: from, p_to: to, p_limit: LINES_PAGE_SIZE, p_offset: page * LINES_PAGE_SIZE })
  if (error) throw error
  const d = (data ?? { rows: [], total: 0 }) as unknown as { rows: CommissionLine[]; total: number }
  return {
    total: Number(d.total),
    rows: d.rows.map((l) => ({ ...l, base: Number(l.base), rate: Number(l.rate), amount: Number(l.amount), fixed_amount: l.fixed_amount == null ? null : Number(l.fixed_amount) })),
  }
}

export async function payCommissions(doctorId: string, from: string, to: string, notes: string): Promise<void> {
  const { error } = await supabase.rpc('pay_commissions', { p_doctor: doctorId, p_from: from, p_to: to, ...(notes.trim() ? { p_notes: notes.trim() } : {}) })
  if (error) throw error
}

/** `kind` null = sin comisión. */
export async function setCommissionScheme(membershipId: string, kind: CommissionKind | null, value: number | null): Promise<void> {
  const { error } = await supabase.rpc('set_commission_scheme', {
    p_membership: membershipId,
    ...(kind ? { p_kind: kind } : {}),
    ...(kind === 'percent_collected' && value !== null ? { p_percent: value } : {}),
    ...(kind === 'chair_rent' && value !== null ? { p_rent: value } : {}),
  })
  if (error) throw error
}

export async function setCommissionPeriod(tenantId: string, period: CommissionPeriodKind): Promise<void> {
  const { error } = await supabase.rpc('set_commission_period', { p_tenant: tenantId, p_period: period })
  if (error) throw error
}

/** Excepciones por tratamiento de un doctor (la gerencia ve todas; cada doctor, las suyas). */
export async function fetchTreatmentRules(membershipId: string): Promise<TreatmentRule[]> {
  const { data, error } = await supabase.from('commission_treatment_rules').select('id, treatment_id, percent, amount').eq('membership_id', membershipId)
  if (error) throw error
  return (data ?? []).map((r) => ({ ...r, percent: r.percent == null ? null : Number(r.percent), amount: r.amount == null ? null : Number(r.amount) }))
}

/** Pone (% o monto por unidad) o quita (ambos null) la excepción de un tratamiento. Solo gerencia. */
export async function setTreatmentCommission(membershipId: string, treatmentId: string, rule: { percent: number } | { amount: number } | null): Promise<void> {
  const { error } = await supabase.rpc('set_treatment_commission', {
    p_membership: membershipId,
    p_treatment: treatmentId,
    ...(rule && 'percent' in rule ? { p_percent: rule.percent } : {}),
    ...(rule && 'amount' in rule ? { p_amount: rule.amount } : {}),
  })
  if (error) throw error
}
