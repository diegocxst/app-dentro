import type { Database, Enums } from '@/lib/database.types'
import { money } from '@/lib/quotes'

export type CommissionKind = Enums<'commission_kind'>
export type CommissionPeriodKind = 'quincenal' | 'mensual'
export type CommissionRow = Database['public']['Functions']['commission_summary']['Returns'][number]
export type CommissionLine = {
  id: string
  kind: 'comision' | 'ajuste'
  base: number
  rate: number
  amount: number
  period_date: string
  paid: boolean
  /** Esquema con que se calculó (obs. 18); null en movimientos de un esquema ya borrado. */
  scheme_kind?: CommissionKind | null
  folio: number
  patient: string
  quote_title: string | null
  quote_folio: number | null
}

export const PERIOD_KINDS: readonly { value: CommissionPeriodKind; label: string }[] = [
  { value: 'quincenal', label: 'Quincenal (1–15 y 16–fin de mes)' },
  { value: 'mensual', label: 'Mensual' },
]

export type Period = { from: string; to: string; label: string }

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pad = (n: number) => String(n).padStart(2, '0')
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Periodo de corte que contiene la fecha `YYYY-MM-DD`. */
export function periodFor(date: string, kind: CommissionPeriodKind): Period {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const end = lastDay(y, m)
  const [a, b] = kind === 'mensual' ? [1, end] : d <= 15 ? [1, 15] : [16, end]
  const mon = MONTHS[m - 1]
  return { from: `${y}-${pad(m)}-${pad(a)}`, to: `${y}-${pad(m)}-${pad(b)}`, label: kind === 'mensual' ? `${mon} ${y}` : `${a}–${b} ${mon} ${y}` }
}

/** El periodo actual y los `count - 1` anteriores, del más reciente al más antiguo. */
export function recentPeriods(today: string, kind: CommissionPeriodKind, count = 6): Period[] {
  const out: Period[] = []
  let p = periodFor(today, kind)
  for (let i = 0; i < count; i++) {
    out.push(p)
    const [y, m, d] = p.from.split('-').map(Number) as [number, number, number]
    // Un día antes del inicio cae en el periodo anterior.
    const prev = d > 1 ? `${y}-${pad(m)}-${pad(d - 1)}` : m > 1 ? `${y}-${pad(m - 1)}-${pad(lastDay(y, m - 1))}` : `${y - 1}-12-31`
    p = periodFor(prev, kind)
  }
  return out
}

export function schemeLabel(r: { scheme_kind: CommissionKind | null; percent: number | null; rent_amount: number | null }): string {
  if (r.scheme_kind === 'percent_collected') return `${Number(r.percent)}% de lo cobrado`
  if (r.scheme_kind === 'chair_rent') return `Renta de ${money(Number(r.rent_amount))} por periodo`
  return 'Sin comisión'
}

/** Lo que falta pagarle al doctor en el periodo (negativo: queda a favor de la clínica). */
export const toPay = (r: Pick<CommissionRow, 'pending' | 'rent_due'>) => Math.round((Number(r.pending) - Number(r.rent_due)) * 100) / 100

export type CommissionStatus = { label: string; tone: 'neutral' | 'warning' | 'success' }

export function commissionStatus(r: CommissionRow): CommissionStatus {
  if (!r.scheme_kind && Number(r.commission) === 0 && Number(r.pending) === 0) return { label: 'No aplica', tone: 'neutral' }
  if (Number(r.pending) !== 0 || Number(r.rent_due) > 0) return { label: 'Por pagar', tone: 'warning' }
  if (r.last_paid_at) return { label: 'Pagada', tone: 'success' }
  return { label: 'Sin movimientos', tone: 'neutral' }
}

/** Indicadores del periodo. «Queda para la clínica»: lo cobrado menos comisiones, más rentas. */
export function periodTotals(rows: readonly CommissionRow[]) {
  const collected = rows.reduce((t, r) => t + Number(r.collected), 0)
  const commission = rows.reduce((t, r) => t + Number(r.commission), 0)
  const pending = rows.reduce((t, r) => t + Math.max(0, toPay(r)), 0)
  const rent = rows.reduce((t, r) => t + (r.scheme_kind === 'chair_rent' ? Number(r.rent_amount) : 0), 0)
  const round = (n: number) => Math.round(n * 100) / 100
  return { collected: round(collected), commission: round(commission), pending: round(pending), clinic: round(collected - commission + rent) }
}

/** CSV del resumen (se abre en Excel con acentos gracias al BOM). */
export function commissionsCsv(rows: readonly CommissionRow[], period: Period): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = ['Periodo', 'Doctor', 'Esquema', 'Pacientes', 'Cobrado', 'Comisión', 'Por pagar', 'Estado']
  const body = rows.map((r) => [period.label, r.full_name, schemeLabel(r), r.patients, Number(r.collected), Number(r.commission), toPay(r), commissionStatus(r).label])
  return '﻿' + [head, ...body].map((l) => l.map(cell).join(',')).join('\n')
}
