import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-styles'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { listQuoteColumn, quoteStats, type QuoteCard } from '@/data/quotes'
import { useDoctors } from '@/hooks/useDoctors'
import { DEFAULT_TZ, todayIn, zonedToUtc } from '@/lib/agenda'
import { cn } from '@/lib/cn'
import { followupTag, folioLabel, money, QUOTE_COLUMNS, type QuoteStats, type QuoteStatus } from '@/lib/quotes'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

type Column = { rows: QuoteCard[]; total: number }

/** P18 · Kanban de presupuestos con indicadores del mes. */
export function QuotesPage() {
  const { active, branches, activeBranchId } = useWorkspace()
  const tz = branches.find((b) => b.id === activeBranchId)?.timezone ?? DEFAULT_TZ
  const doctors = useDoctors(active?.tenant_id)
  const isDoctor = active?.role === 'doctor' || active?.role === 'doctor_collab'
  const [doctorId, setDoctorId] = useState('')
  const [columns, setColumns] = useState<Record<QuoteStatus, Column> | null>(null)
  const [stats, setStats] = useState<QuoteStats | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [now] = useState(() => Date.now())
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const tenantId = active?.tenant_id

  useEffect(() => {
    if (!tenantId) return
    let current = true
    const monthStart = zonedToUtc(`${todayIn(tz).slice(0, 8)}01`, '00:00', tz)
    const filter = doctorId ? { doctorId } : {}
    Promise.all([Promise.all(QUOTE_COLUMNS.map((c) => listQuoteColumn({ tenantId, status: c.value, ...filter }))), quoteStats(tenantId, monthStart, doctorId || undefined)]).then(
      ([cols, s]) => {
        if (!current) return
        setFailed(false)
        setColumns(Object.fromEntries(QUOTE_COLUMNS.map((c, i) => [c.value, cols[i]!])) as Record<QuoteStatus, Column>)
        setStats(s)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, doctorId, tz, attempt])

  if (!active) return null
  const doctorName = (id: string | null) => doctors.find((d) => d.id === id)?.name ?? ''
  const rate = stats && stats.decided > 0 ? `${Math.round((stats.won / stats.decided) * 100)}%` : '—'
  const kpis = [
    { label: 'Tasa de aceptación', value: rate, hint: 'Del mes, entre los ya decididos' },
    { label: 'En duda, por recuperar', value: stats ? money(stats.in_doubt_total) : '—', alert: Boolean(stats?.in_doubt_total) },
    { label: 'Ticket promedio', value: stats && stats.avg_ticket > 0 ? money(stats.avg_ticket) : '—', hint: 'Aceptados del mes' },
  ]

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description="Que ningún presupuesto se pierda. Muévelo de etapa desde su detalle."
        actions={
          active.tenant.status === 'active' && (
            <Link to="/presupuestos/nuevo" className={buttonClasses('primary')}>
              Nuevo presupuesto
            </Link>
          )
        }
      />

      {failed ? (
        <LoadError title="No pudimos cargar los presupuestos" onRetry={reload} />
      ) : !columns ? (
        <Skeleton className="h-96 w-full" label="Cargando presupuestos" />
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

          {!isDoctor && (
            <div className="w-full sm:w-64">
              <Select
                label="Doctor"
                options={[{ value: '', label: 'Todos' }, ...doctors.map((d) => ({ value: d.id, label: d.name }))]}
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              />
            </div>
          )}

          <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            <div className="grid snap-x snap-mandatory auto-cols-[minmax(260px,1fr)] grid-flow-col gap-3">
              {QUOTE_COLUMNS.map((c) => {
                const col = columns[c.value]
                const sum = col.rows.reduce((t, q) => t + Number(q.total), 0)
                return (
                  <section key={c.value} aria-label={c.label} className="flex snap-start flex-col gap-2 rounded-lg bg-surface p-2">
                    <header className="flex items-center gap-2 px-1 py-1">
                      <span aria-hidden="true" className={cn('size-2.5 rounded-pill', c.bar)} />
                      <h2 className="m-0 grow text-ui font-semibold">{c.label}</h2>
                      <span className="text-caption text-ink-muted">
                        {col.total}
                        {sum > 0 ? ` · ${money(sum)}` : ''}
                      </span>
                    </header>
                    {col.rows.length === 0 && <p className="m-0 px-1 py-3 text-caption text-ink-muted">Sin presupuestos.</p>}
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {col.rows.map((q) => {
                        const tag = followupTag(q, now)
                        return (
                          <li key={q.id}>
                            <Link to={`/presupuestos/${q.id}`} className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-raised p-3 hover:border-violet">
                              <span className="flex items-start justify-between gap-2">
                                <span className="text-ui font-semibold text-ink">{q.patientName}</span>
                                <span className="shrink-0 text-ui font-semibold text-ink">{Number(q.total) > 0 ? money(Number(q.total)) : '—'}</span>
                              </span>
                              <span className="text-caption text-ink-muted">
                                {[q.title || folioLabel(q.folio), doctorName(q.doctor_id)].filter(Boolean).join(' · ')}
                              </span>
                              {c.value === 'perdido' && q.lost_reason && <span className="line-clamp-2 text-caption text-ink-muted">{q.lost_reason}</span>}
                              {tag && (
                                <span>
                                  <Badge tone={tag.tone}>{tag.text}</Badge>
                                </span>
                              )}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                    {col.total > col.rows.length && <p className="m-0 px-1 text-caption text-ink-muted">y {col.total - col.rows.length} más</p>}
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
