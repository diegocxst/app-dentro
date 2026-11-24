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

export type ItemDraft = { treatmentId: string | null; concept: string; note: string; quantity: number; unitPrice: number }
export const lineTotal = (i: Pick<ItemDraft, 'quantity' | 'unitPrice'>) => Math.round(i.quantity * i.unitPrice * 100) / 100
export const quoteTotal = (items: readonly Pick<ItemDraft, 'quantity' | 'unitPrice'>[]) => Math.round(items.reduce((t, i) => t + lineTotal(i), 0) * 100) / 100

/**
 * Descuento del presupuesto (decisión 2026-11-24): uno solo, al total, en % o en pesos.
 * Se guarda como una partida negativa al final («Descuento 10%» o «Descuento»), así el
 * PDF y la base no cambian.
 */
export type Discount = { kind: 'percent' | 'amount'; value: number }
const round2 = (n: number) => Math.round(n * 100) / 100
const PERCENT_CONCEPT = /^Descuento (\d+(?:\.\d+)?)\s?%$/

/** Pesos que se restan: nunca más que el subtotal. */
export function discountAmount(subtotal: number, d: Discount | null): number {
  if (!d || !(d.value > 0) || subtotal <= 0) return 0
  const raw = d.kind === 'percent' ? (subtotal * Math.min(d.value, 100)) / 100 : d.value
  return round2(Math.min(raw, subtotal))
}

/** ¿Es válido? % entre 0 y 100; monto entre 0 y el subtotal. */
export function discountError(subtotal: number, d: Discount | null): string | null {
  if (!d) return null
  if (!Number.isFinite(d.value) || d.value <= 0) return 'Escribe el descuento.'
  if (d.kind === 'percent' && d.value > 100) return 'El descuento no puede pasar de 100%.'
  if (d.kind === 'amount' && d.value > subtotal) return 'El descuento no puede ser mayor que los tratamientos.'
  return null
}

/** Al abrir un presupuesto: separa las partidas negativas y las junta en un solo descuento. */
export function splitDiscount(items: readonly ItemDraft[]): { items: ItemDraft[]; discount: Discount | null } {
  const negatives = items.filter((i) => i.unitPrice < 0)
  const rest = items.filter((i) => i.unitPrice >= 0)
  if (negatives.length === 0) return { items: rest, discount: null }
  const pct = negatives.length === 1 ? PERCENT_CONCEPT.exec(negatives[0]!.concept.trim()) : null
  if (pct) return { items: rest, discount: { kind: 'percent', value: Number(pct[1]) } }
  return { items: rest, discount: { kind: 'amount', value: round2(-negatives.reduce((t, i) => t + lineTotal(i), 0)) } }
}

/** Al guardar: los tratamientos más la partida del descuento (si hay). */
export function withDiscount(items: readonly ItemDraft[], d: Discount | null): ItemDraft[] {
  const amount = discountAmount(quoteTotal(items), d)
  if (!d || amount <= 0) return [...items]
  const concept = d.kind === 'percent' ? `Descuento ${d.value}%` : 'Descuento'
  return [...items, { treatmentId: null, concept, note: '', quantity: 1, unitPrice: -amount }]
}

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
