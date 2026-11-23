import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { voidPayment, type Payment } from '@/data/payments'
import { rpcErrorMessage } from '@/lib/errors'
import { methodLabel, receiptFolio } from '@/lib/payments'
import { money } from '@/lib/quotes'

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

type Props = {
  payments: (Payment & { patientName?: string })[]
  /** La gerencia puede anular (con motivo). */
  canVoid: boolean
  onChanged: () => void
  label?: string
}

/** Lista de pagos (Cobros y ficha). Los anulados se muestran tachados y con su motivo. */
export function PaymentList({ payments, canVoid, onChanged, label = 'Pagos' }: Props) {
  if (payments.length === 0) return <p className="m-0 text-ui text-ink-muted">Aún no hay pagos.</p>
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col gap-2 p-0">
      {payments.map((p) => (
        <PaymentItem key={p.id} p={p} canVoid={canVoid} onChanged={onChanged} />
      ))}
    </ul>
  )
}

function PaymentItem({ p, canVoid, onChanged }: { p: Payment & { patientName?: string }; canVoid: boolean; onChanged: () => void }) {
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const voided = Boolean(p.voided_at)

  const confirm = async () => {
    if (!reason.trim()) return setError('Escribe por qué se anula.')
    setBusy(true)
    setError(null)
    try {
      await voidPayment(p.id, reason)
      onChanged()
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          {p.patientName && (
            <Link to={`/pacientes/${p.patient_id}`} className="text-ui font-semibold text-ink hover:text-violet">
              {p.patientName}
            </Link>
          )}
          <span className="text-caption text-ink-muted">
            {receiptFolio(p.folio)} · {dateFmt.format(new Date(p.paid_at))} · {methodLabel(p.method)}
            {p.reference ? ` · ${p.reference}` : ''}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {voided && <Badge tone="neutral">Anulado</Badge>}
          <span className={voided ? 'text-ui font-semibold text-ink-muted line-through' : 'text-ui font-semibold'}>{money(Number(p.amount))}</span>
        </span>
      </div>
      {voided && p.void_reason && <span className="text-caption text-ink-muted">Motivo: {p.void_reason}</span>}
      {!voided && !voiding && (
        <div className="flex flex-wrap gap-4">
          <Link to={`/cobros/${p.id}/comprobante`} className="flex min-h-9 items-center text-caption font-semibold text-violet" aria-label={`Comprobante del pago ${receiptFolio(p.folio)}`}>
            Comprobante
          </Link>
          {canVoid && (
            <button type="button" onClick={() => setVoiding(true)} className="min-h-9 text-caption font-semibold text-error" aria-label={`Anular pago ${receiptFolio(p.folio)}`}>
              Anular
            </button>
          )}
        </div>
      )}
      {voiding && (
        <div className="flex flex-col gap-2">
          <Input label="¿Por qué se anula?" value={reason} maxLength={300} placeholder="Ej. Se capturó dos veces" error={error ?? undefined} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" loading={busy} onClick={() => void confirm()}>
              Sí, anular
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVoiding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
