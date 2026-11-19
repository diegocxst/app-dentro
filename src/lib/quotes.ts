import type { Enums } from '@/lib/database.types'

export type QuoteStatus = Enums<'quote_status'>

/** Columnas del Kanban (maqueta P18) con su color del sistema "dentro". */
export const QUOTE_COLUMNS: readonly { value: QuoteStatus; label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'violet' | 'error'; bar: string }[] = [
  { value: 'borrador', label: 'Borrador', tone: 'neutral', bar: 'bg-border-strong' },
  { value: 'presentado', label: 'Presentado', tone: 'info', bar: 'bg-info' },
  { value: 'en_duda', label: 'En duda', tone: 'warning', bar: 'bg-warning' },
  { value: 'aceptado', label: 'Aceptado', tone: 'success', bar: 'bg-success' },
  { value: 'en_tratamiento', label: 'En tratamiento', tone: 'violet', bar: 'bg-violet' },
  { value: 'terminado', label: 'Terminado', tone: 'neutral', bar: 'bg-ink-muted' },
  { value: 'perdido', label: 'Perdido', tone: 'error', bar: 'bg-error' },
]
export const quoteColumn = (s: QuoteStatus) => QUOTE_COLUMNS.find((c) => c.value === s) ?? QUOTE_COLUMNS[0]!
export const EDITABLE: readonly QuoteStatus[] = ['borrador', 'presentado', 'en_duda']

/** Siguientes etapas posibles (las mismas que valida la base). */
export const NEXT_STAGES: Record<QuoteStatus, { to: QuoteStatus; label: string }[]> = {
  borrador: [{ to: 'presentado', label: 'Marcar presentado' }],
  presentado: [
    { to: 'aceptado', label: 'Aceptó' },
    { to: 'en_duda', label: 'Pasar a «En duda»' },
  ],
  en_duda: [
    { to: 'aceptado', label: 'Aceptó' },
    { to: 'presentado', label: 'Volver a «Presentado»' },
  ],
  aceptado: [{ to: 'en_tratamiento', label: 'Empezó el tratamiento' }],
  en_tratamiento: [{ to: 'terminado', label: 'Tratamiento terminado' }],
  terminado: [],
  perdido: [{ to: 'presentado', label: 'Reabrir' }],
}
export const canLose = (s: QuoteStatus) => s === 'borrador' || s === 'presentado' || s === 'en_duda' || s === 'aceptado'

const mxn0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const mxn2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
/** «$38,000» (o «$1,234.50» si hay centavos); negativo como «−$850». */
export function money(n: number): string {
  const abs = Math.abs(n)
  const s = Number.isInteger(abs) ? mxn0.format(abs) : mxn2.format(abs)
  return n < 0 ? `−${s}` : s
}

/** `discount`: solo para la interfaz; el precio se guarda negativo. */
export type ItemDraft = { treatmentId: string | null; concept: string; note: string; quantity: number; unitPrice: number; discount?: boolean }
export const lineTotal = (i: Pick<ItemDraft, 'quantity' | 'unitPrice'>) => Math.round(i.quantity * i.unitPrice * 100) / 100
export const quoteTotal = (items: readonly Pick<ItemDraft, 'quantity' | 'unitPrice'>[]) => Math.round(items.reduce((t, i) => t + lineTotal(i), 0) * 100) / 100

/** Mensualidad redondeada hacia arriba al peso (el paciente nunca paga de menos). */
export const monthly = (total: number, downPayment: number, installments: number) =>
  installments > 0 ? Math.ceil(Math.max(0, total - downPayment) / installments) : 0

export function planText(total: number, downPayment: number, installments: number): string {
  if (installments <= 0) return `De contado: ${money(total)}`
  const m = monthly(total, downPayment, installments)
  return `${downPayment > 0 ? `${money(downPayment)} de anticipo y ` : ''}${installments} ${installments === 1 ? 'mensualidad' : 'mensualidades'} de ${money(m)}`
}

export const folioLabel = (folio: number) => `P-${String(folio).padStart(4, '0')}`

const DAY = 86_400_000
/** Etiqueta de seguimiento de la tarjeta: «Enviado hace 2 días», «Sin respuesta 9 días». */
export function followupTag(q: { status: QuoteStatus; sent_at: string | null; last_followup_at: string | null }, now: number = Date.now()): { text: string; tone: 'info' | 'warning' | 'error' } | null {
  if (q.status !== 'presentado' && q.status !== 'en_duda') return null
  const ref = q.last_followup_at ?? q.sent_at
  if (!ref) return null
  const days = Math.floor((now - new Date(ref).getTime()) / DAY)
  if (q.status === 'presentado' && days < 3) return { text: days === 0 ? 'Enviado hoy' : `Enviado hace ${days} ${days === 1 ? 'día' : 'días'}`, tone: 'info' }
  return { text: `Sin respuesta ${days} ${days === 1 ? 'día' : 'días'}`, tone: days >= 7 ? 'error' : 'warning' }
}

export type QuoteStats = { won: number; decided: number; in_doubt_total: number; avg_ticket: number; collected?: number }
export const PLAN_OPTIONS = [0, 6, 12, 18, 24] as const
