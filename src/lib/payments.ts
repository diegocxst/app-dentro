import type { Enums } from '@/lib/database.types'
import { monthly } from '@/lib/quotes'

export type PaymentMethod = Enums<'payment_method'>

export const PAYMENT_METHODS: readonly { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta_debito', label: 'Tarjeta de débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta de crédito' },
  { value: 'otro', label: 'Otro' },
]
export const methodLabel = (m: PaymentMethod) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m

export const receiptFolio = (folio: number) => `R-${String(folio).padStart(4, '0')}`

export type AccountQuote = {
  id: string
  folio: number
  title: string
  status: string
  total: number
  down_payment: number
  installments: number
  paid: number
  balance: number
}
export type PatientAccount = { quotes: AccountQuote[]; paid_total: number; balance: number; last_payment_at: string | null }
export type PaymentStats = { today: number; month: number; month_count: number; receivable: number }

/**
 * Monto sugerido al cobrar un presupuesto: el anticipo si aún no se paga nada; si no,
 * una mensualidad; nunca más que el saldo.
 */
export function suggestedAmount(q: Pick<AccountQuote, 'total' | 'down_payment' | 'installments' | 'paid' | 'balance'>): number {
  if (q.balance <= 0) return 0
  if (q.paid === 0 && q.down_payment > 0) return Math.min(q.down_payment, q.balance)
  if (q.installments > 0) return Math.min(monthly(q.total, q.down_payment, q.installments), q.balance)
  return q.balance
}
