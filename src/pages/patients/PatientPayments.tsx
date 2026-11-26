import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { PaymentList } from '@/components/payments/PaymentList'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { listPatientPayments, patientAccount, type Payment } from '@/data/payments'
import type { PatientAccount } from '@/lib/payments'
import { folioLabel, money, quoteColumn, type QuoteStatus } from '@/lib/quotes'

/** Pestaña Pagos de la ficha: cuenta (pagado y saldo por presupuesto) y pagos. */
export function PatientPayments({ patientId, canRegister, canVoid }: { patientId: string; canRegister: boolean; canVoid: boolean }) {
  const [account, setAccount] = useState<PatientAccount | null>(null)
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let current = true
    Promise.all([patientAccount(patientId), listPatientPayments(patientId)]).then(
      ([a, p]) => {
        if (!current) return
        setFailed(false)
        setAccount(a)
        setPayments(p)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [patientId, attempt])

  if (failed) return <LoadError title="No pudimos cargar los pagos" onRetry={reload} />
  if (!account || !payments) return <Skeleton className="h-40 w-full" label="Cargando pagos" />
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <dl className={account.credit > 0 ? 'm-0 grid grow grid-cols-2 gap-3 sm:max-w-xl sm:grid-cols-3' : 'm-0 grid grow grid-cols-2 gap-3 sm:max-w-md'}>
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
            <dt className="text-caption text-ink-muted">Pagado</dt>
            <dd className="m-0 font-display text-subtitle">{money(account.paid_total)}</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
            <dt className="text-caption text-ink-muted">Saldo</dt>
            <dd className={account.balance > 0 ? 'm-0 font-display text-subtitle text-warning' : 'm-0 font-display text-subtitle'}>{money(account.balance)}</dd>
          </div>
          {account.credit > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
              <dt className="text-caption text-ink-muted">Saldo a favor</dt>
              <dd className="m-0 font-display text-subtitle text-success">{money(account.credit)}</dd>
            </div>
          )}
        </dl>
        {canRegister && (
          <Link to={`/cobros/nuevo?paciente=${patientId}&volver=/pacientes/${patientId}`} className={buttonClasses('primary')}>
            Registrar pago
          </Link>
        )}
      </div>
      {account.credit > 0 && (
        <p className="m-0 text-caption text-ink-muted">El saldo a favor se aplica solo en cuanto el paciente acepte un presupuesto, empezando por el más antiguo.</p>
      )}
      {account.quotes.length > 0 && (
        <Card as="section" aria-label="Saldo por presupuesto" className="flex flex-col gap-2">
          <h2 className="m-0 text-subtitle">Por presupuesto</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {account.quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                <Link to={`/presupuestos/${q.id}`} className="flex flex-col">
                  <span className="text-ui font-semibold text-ink hover:text-violet">{q.title || 'Presupuesto'}</span>
                  <span className="text-caption text-ink-muted">
                    {folioLabel(q.folio)} · {quoteColumn(q.status as QuoteStatus).label} · total {money(q.total)}
                  </span>
                </Link>
                <span className="text-right text-caption">
                  Pagado {money(q.paid)}
                  <br />
                  <span className="font-semibold">Saldo {money(q.balance)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card as="section" aria-label="Pagos del paciente" className="flex flex-col gap-2">
        <h2 className="m-0 text-subtitle">Pagos</h2>
        <PaymentList payments={payments} canVoid={canVoid} onChanged={reload} label="Lista de pagos" />
      </Card>
    </div>
  )
}

/** Tarjeta «Cuenta» del Resumen de la ficha. */
export function AccountSummary({ patientId }: { patientId: string }) {
  const [account, setAccount] = useState<PatientAccount | null>(null)
  useEffect(() => {
    let current = true
    patientAccount(patientId).then(
      (a) => current && setAccount(a),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [patientId])
  if (!account) return <span className="text-ui text-ink-muted">Cargando…</span>
  if (account.paid_total === 0 && account.balance === 0) return <span className="text-ui text-ink-muted">Sin pagos todavía.</span>
  return (
    <span className="text-ui">
      Saldo <span className={account.balance > 0 ? 'font-semibold text-warning' : 'font-semibold'}>{money(account.balance)}</span>
      <span className="block text-caption text-ink-muted">Pagado {money(account.paid_total)}</span>
      {account.credit > 0 && <span className="block text-caption text-success">A favor {money(account.credit)}</span>}
    </span>
  )
}
