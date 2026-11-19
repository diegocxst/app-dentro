import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { PaymentList } from '@/components/payments/PaymentList'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { listPayments, listReceivables, paymentStats, PAYMENTS_PAGE_SIZE, type PaymentRow, type Receivable } from '@/data/payments'
import { useFlashNotice } from '@/hooks/useFlashNotice'
import { DEFAULT_TZ, todayIn, zonedToUtc } from '@/lib/agenda'
import { cn } from '@/lib/cn'
import type { PaymentStats } from '@/lib/payments'
import { formatPhone } from '@/lib/phone'
import { money } from '@/lib/quotes'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
type Tab = 'pagos' | 'saldos'

/** P21 · Cobros y saldos. Solo gerencia y recepción. */
export function CobrosPage() {
  const { active, branches, activeBranchId } = useWorkspace()
  const tz = branches.find((b) => b.id === activeBranchId)?.timezone ?? DEFAULT_TZ
  const flash = useFlashNotice()
  const [tab, setTab] = useState<Tab>('pagos')
  const [page, setPage] = useState(0)
  const [payments, setPayments] = useState<{ rows: PaymentRow[]; total: number } | null>(null)
  const [receivables, setReceivables] = useState<Receivable[] | null>(null)
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const tenantId = active?.tenant_id
  const canWork = active?.role === 'owner' || active?.role === 'admin' || active?.role === 'reception'
  const canVoid = (active?.role === 'owner' || active?.role === 'admin') && active?.tenant.status === 'active'

  useEffect(() => {
    if (!tenantId || !canWork) return
    let current = true
    const today = todayIn(tz)
    Promise.all([
      listPayments({ tenantId, page }),
      listReceivables(tenantId),
      paymentStats(tenantId, zonedToUtc(today, '00:00', tz), zonedToUtc(`${today.slice(0, 8)}01`, '00:00', tz)),
    ]).then(
      ([p, r, s]) => {
        if (!current) return
        setFailed(false)
        setPayments(p)
        setReceivables(r)
        setStats(s)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, canWork, page, tz, attempt])

  if (!active) return null
  if (!canWork) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="cobros"
        title="Los cobros los lleva recepción"
        description="La dueña, la administración y recepción registran los pagos. Verás los de tus pacientes en su ficha y tus comisiones en Doctores."
      />
    )
  }

  const kpis = [
    { label: 'Cobrado hoy', value: stats ? money(stats.today) : '—' },
    { label: 'Cobrado este mes', value: stats ? money(stats.month) : '—', hint: stats ? `${stats.month_count} ${stats.month_count === 1 ? 'pago' : 'pagos'}` : undefined },
    { label: 'Por cobrar', value: stats ? money(stats.receivable) : '—', hint: 'Saldos de presupuestos aceptados', alert: Boolean(stats?.receivable) },
  ]
  const pages = payments ? Math.max(1, Math.ceil(payments.total / PAYMENTS_PAGE_SIZE)) : 1

  return (
    <>
      <PageHeader
        title="Cobros"
        description="Pagos y abonos de tus pacientes. El dinero llega directo a la clínica."
        actions={
          active.tenant.status === 'active' && (
            <Link to="/cobros/nuevo" className={buttonClasses('primary')}>
              Registrar pago
            </Link>
          )
        }
      />
      {flash && (
        <Alert tone="success" className="mb-4">
          {flash}
        </Alert>
      )}
      {failed ? (
        <LoadError title="No pudimos cargar los cobros" onRetry={reload} />
      ) : !stats || !payments || !receivables ? (
        <Skeleton className="h-96 w-full" label="Cargando cobros" />
      ) : (
        <div className="flex flex-col gap-6">
          <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.label} className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
                <dt className="text-caption text-ink-muted">{k.label}</dt>
                <dd className={cn('m-0 font-display text-title', k.alert && 'text-warning')}>{k.value}</dd>
                {k.hint && <span className="text-caption text-ink-muted">{k.hint}</span>}
              </div>
            ))}
          </dl>

          <div role="tablist" aria-label="Secciones de cobros" className="flex gap-1 border-b border-border">
            {(
              [
                ['pagos', `Pagos (${payments.total})`],
                ['saldos', `Saldos (${receivables.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn('min-h-11 px-3 text-ui', tab === id ? 'font-semibold text-ink shadow-[inset_0_-2px_0_var(--violet)]' : 'font-medium text-ink-muted hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'pagos' ? (
            <Card className="flex flex-col gap-3">
              <PaymentList payments={payments.rows} canVoid={canVoid} onChanged={reload} label="Pagos de la clínica" />
              {pages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Anteriores
                  </Button>
                  <span className="text-caption text-ink-muted">
                    Página {page + 1} de {pages}
                  </span>
                  <Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                    Siguientes
                  </Button>
                </div>
              )}
            </Card>
          ) : receivables.length === 0 ? (
            <EmptyState icon="cobros" title="Nadie te debe" description="Aquí verás a los pacientes con saldo de presupuestos aceptados." />
          ) : (
            <Card>
              <ul aria-label="Pacientes con saldo" className="m-0 flex list-none flex-col gap-2 p-0">
                {receivables.map((r) => (
                  <li key={r.patient_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                    <span className="flex flex-col">
                      <Link to={`/pacientes/${r.patient_id}`} className="text-ui font-semibold text-ink hover:text-violet">
                        {r.full_name}
                      </Link>
                      <span className="text-caption text-ink-muted">
                        {[r.phone_e164 ? formatPhone(r.phone_e164) : null, r.last_payment_at ? `Último pago: ${dateFmt.format(new Date(r.last_payment_at))}` : 'Sin pagos'].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-ui font-semibold">{money(r.balance)}</span>
                      {active.tenant.status === 'active' && (
                        <Link to={`/cobros/nuevo?paciente=${r.patient_id}&volver=/cobros`} className={buttonClasses('secondary', 'sm')} aria-label={`Registrar pago de ${r.full_name}`}>
                          Registrar pago
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
