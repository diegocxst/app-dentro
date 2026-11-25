import type { Database } from '@/lib/database.types'
import type { AppointmentKind, AppointmentStatus } from '@/lib/agenda'
import type { CommissionRow } from '@/lib/commissions'

/** Fila del reporte de presupuestos por doctor (M6-B2b, obs. 11). */
export type QuoteReportRow = Database['public']['Functions']['doctor_quote_report']['Returns'][number]
export type QuoteGroups = Pick<
  QuoteReportRow,
  'presented' | 'presented_amount' | 'accepted' | 'accepted_amount' | 'waiting' | 'waiting_amount' | 'unfinished' | 'unfinished_amount' | 'lost' | 'lost_amount'
>

export const QUOTE_GROUPS: readonly { key: 'presented' | 'accepted' | 'waiting' | 'unfinished' | 'lost'; label: string; hint: string }[] = [
  { key: 'presented', label: 'Presentados', hint: 'Todo lo que no es borrador' },
  { key: 'accepted', label: 'Aceptados', hint: 'Aceptados, en tratamiento o terminados' },
  { key: 'waiting', label: 'En espera', hint: 'Presentados o en duda' },
  { key: 'unfinished', label: 'Sin completar', hint: 'Aceptados o en tratamiento' },
  { key: 'lost', label: 'Perdidos', hint: 'Marcados como perdidos' },
]

export const EMPTY_GROUPS: QuoteGroups = {
  presented: 0, presented_amount: 0, accepted: 0, accepted_amount: 0, waiting: 0, waiting_amount: 0,
  unfinished: 0, unfinished_amount: 0, lost: 0, lost_amount: 0,
}

/** Suma de todas las filas (renglón «Total»). */
export function sumGroups(rows: readonly QuoteGroups[]): QuoteGroups {
  const t = { ...EMPTY_GROUPS }
  for (const r of rows) for (const k of Object.keys(t) as (keyof QuoteGroups)[]) t[k] += Number(r[k])
  for (const k of Object.keys(t) as (keyof QuoteGroups)[]) t[k] = Math.round(t[k] * 100) / 100
  return t
}

/** % de presentados que se aceptaron (null si no hubo presentados). */
export const acceptance = (g: QuoteGroups) => (g.presented > 0 ? Math.round((g.accepted / g.presented) * 100) : null)

export type ReportPeriodKey = 'mes' | 'mes_pasado' | 'tres_meses' | 'anio'
export type ReportPeriod = { key: ReportPeriodKey; label: string; from: string; to: string }

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)

/** Periodos del historial y los reportes, relativos a hoy (fecha local de la clínica). */
export function reportPeriods(today: string): ReportPeriod[] {
  const [y, m] = today.split('-').map(Number) as [number, number]
  const mi = m - 1
  return [
    { key: 'mes', label: 'Este mes', from: iso(y, mi, 1), to: iso(y, mi + 1, 0) },
    { key: 'mes_pasado', label: 'El mes pasado', from: iso(y, mi - 1, 1), to: iso(y, mi, 0) },
    { key: 'tres_meses', label: 'Los últimos 3 meses', from: iso(y, mi - 2, 1), to: iso(y, mi + 1, 0) },
    { key: 'anio', label: 'Este año', from: iso(y, 0, 1), to: iso(y, 11, 31) },
  ]
}

/** Desglose de lo que le queda a la clínica (obs. 15). */
export function clinicBreakdown(rows: readonly CommissionRow[]) {
  const round = (n: number) => Math.round(n * 100) / 100
  const collected = round(rows.reduce((t, r) => t + Number(r.collected), 0))
  const commissions = round(rows.reduce((t, r) => t + Number(r.commission), 0))
  const rent = round(rows.reduce((t, r) => t + (r.scheme_kind === 'chair_rent' ? Number(r.rent_amount) : 0), 0))
  const owner = round(rows.filter((r) => r.role === 'owner').reduce((t, r) => t + Number(r.collected), 0))
  return { collected, commissions, rent, clinic: round(collected - commissions + rent), owner }
}

export type HistoryAppointment = { id: string; starts_at: string; status: AppointmentStatus; kind: AppointmentKind; patient: string; treatment: string | null }
export type DoctorHistory = {
  appointments: { attended: number; no_show: number; cancelled: number; total: number }
  patients: number
  collected: number
  commission: number
  quotes: QuoteGroups
  upcoming: HistoryAppointment[]
  recent: HistoryAppointment[]
}
