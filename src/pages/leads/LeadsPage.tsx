import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { leadStats, listLeadColumn, type Lead } from '@/data/leads'
import { DEFAULT_TZ, todayIn, zonedToUtc } from '@/lib/agenda'
import { cn } from '@/lib/cn'
import type { PatientSource } from '@/lib/db'
import { formatMinutes, isLate, LEAD_COLUMNS, LEAD_SOURCES, leadSource, relativeAge, type LeadStats, type LeadStatus } from '@/lib/leads'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

type Column = { rows: Lead[]; total: number }

/** P11 · Kanban de leads con indicadores del mes. Solo gerencia y recepción. */
export function LeadsPage() {
  const { active, branches, activeBranchId } = useWorkspace()
  const tz = branches.find((b) => b.id === activeBranchId)?.timezone ?? DEFAULT_TZ
  const [source, setSource] = useState<PatientSource | ''>('')
  const [columns, setColumns] = useState<Record<LeadStatus, Column> | null>(null)
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [now] = useState(() => Date.now())
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const tenantId = active?.tenant_id
  const canWork = active?.role === 'owner' || active?.role === 'admin' || active?.role === 'reception'

  useEffect(() => {
    if (!tenantId || !canWork) return
    let current = true
    const monthStart = zonedToUtc(`${todayIn(tz).slice(0, 8)}01`, '00:00', tz)
    Promise.all([Promise.all(LEAD_COLUMNS.map((c) => listLeadColumn({ tenantId, status: c.value, source }))), leadStats(tenantId, monthStart)]).then(
      ([cols, s]) => {
        if (!current) return
        setFailed(false)
        setColumns(Object.fromEntries(LEAD_COLUMNS.map((c, i) => [c.value, cols[i]!])) as Record<LeadStatus, Column>)
        setStats(s)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, canWork, source, tz, attempt])

  if (!active) return null
  if (!canWork) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="leads"
        title="Los leads los trabaja recepción"
        description="La dueña, la administración y recepción dan seguimiento a los interesados. Cuando un lead tenga cita contigo, lo verás en tu agenda."
      />
    )
  }

  const pct = stats && stats.leads > 0 ? `${Math.round((stats.reached_valoracion / stats.leads) * 100)}%` : '—'
  const kpis = [
    { label: 'Leads este mes', value: stats ? String(stats.leads) : '—' },
    { label: 'Llegaron a valoración', value: pct },
    { label: 'Tiempo de respuesta', value: formatMinutes(stats?.median_response_minutes), hint: 'Mediana del mes' },
    { label: 'Sin contestar hace más de 24 h', value: stats ? String(stats.unanswered_24h) : '—', alert: Boolean(stats?.unanswered_24h) },
  ]

  return (
    <>
      <PageHeader
        title="Leads"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-48">
              <Select
                label="Origen"
                options={[{ value: '', label: 'Todos' }, ...LEAD_SOURCES.map(({ value, label }) => ({ value, label }))]}
                value={source}
                onChange={(e) => setSource(e.target.value as PatientSource | '')}
              />
            </div>
            {active.tenant.status === 'active' && (
              <Link to="/leads/nuevo" className={buttonClasses('primary')}>
                Nuevo lead
              </Link>
            )}
          </div>
        }
      />
      <p className="-mt-4 mb-6 text-ui text-ink-muted lg:-mt-6">Personas interesadas que todavía no son pacientes.</p>

      {failed ? (
        <LoadError title="No pudimos cargar los leads" onRetry={reload} />
      ) : !columns ? (
        <Skeleton className="h-96 w-full" label="Cargando leads" />
      ) : (
        <div className="flex flex-col gap-6">
          <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
                <dt className="text-caption text-ink-muted">{k.label}</dt>
                <dd className={cn('m-0 font-display text-title', k.alert && 'text-error')}>{k.value}</dd>
                {k.hint && <span className="text-caption text-ink-muted">{k.hint}</span>}
              </div>
            ))}
          </dl>

          <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            <div className="grid snap-x snap-mandatory auto-cols-[minmax(260px,1fr)] grid-flow-col gap-3">
              {LEAD_COLUMNS.map((c) => {
                const col = columns[c.value]
                return (
                  <section key={c.value} aria-label={c.label} className="flex snap-start flex-col gap-2 rounded-lg bg-surface p-2">
                    <header className="flex items-center gap-2 px-1 py-1">
                      <span aria-hidden="true" className={cn('size-2.5 rounded-pill', c.bar)} />
                      <h2 className="m-0 grow text-ui font-semibold">{c.label}</h2>
                      <span className="text-caption text-ink-muted">{col.total}</span>
                    </header>
                    {col.rows.length === 0 && <p className="m-0 px-1 py-3 text-caption text-ink-muted">Sin leads.</p>}
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {col.rows.map((l) => {
                        const late = isLate(l, now)
                        const src = leadSource(l.source)
                        return (
                          <li key={l.id}>
                            <Link to={`/leads/${l.id}`} className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-raised p-3 hover:border-violet">
                              <span className="flex items-start justify-between gap-2">
                                <span className="text-ui font-semibold text-ink">{l.full_name}</span>
                                <span className={cn('shrink-0 text-caption', late ? 'font-semibold text-error' : 'text-ink-muted')}>
                                  {relativeAge(c.value === 'nuevo' ? l.created_at : l.status_changed_at, now)}
                                </span>
                              </span>
                              {(c.value === 'perdido' ? l.lost_reason : l.interest) && (
                                <span className="line-clamp-2 text-caption text-ink-muted">{c.value === 'perdido' ? l.lost_reason : l.interest}</span>
                              )}
                              <span>
                                <Badge tone={src.badge}>{src.label}</Badge>
                              </span>
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
