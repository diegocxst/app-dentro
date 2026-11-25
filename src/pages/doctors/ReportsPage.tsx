import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { doctorQuoteReport } from '@/data/reports'
import { DEFAULT_TZ, todayIn } from '@/lib/agenda'
import { money } from '@/lib/quotes'
import { acceptance, QUOTE_GROUPS, reportPeriods, sumGroups, type QuoteGroups, type QuoteReportRow, type ReportPeriodKey } from '@/lib/reports'
import { ROLE_LABEL } from '@/lib/roles'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'
import { TeamTabs } from './TeamTabs'

/** Reportes del equipo (M6-B2b): presupuestos por doctor del periodo. Solo la dueña o el dueño. */
export function ReportsPage() {
  const { active, branches, activeBranchId } = useWorkspace()
  const tz = branches.find((b) => b.id === activeBranchId)?.timezone ?? DEFAULT_TZ
  const [today] = useState(() => todayIn(tz))
  const periods = reportPeriods(today)
  const [key, setKey] = useState<ReportPeriodKey>('mes')
  const period = periods.find((p) => p.key === key) ?? periods[0]!
  const [rows, setRows] = useState<QuoteReportRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const tenantId = active?.tenant_id

  useEffect(() => {
    if (!tenantId) return
    let current = true
    doctorQuoteReport(tenantId, period.from, period.to).then(
      (r) => {
        if (!current) return
        setFailed(false)
        setRows(r)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, period.from, period.to, attempt])

  if (!active) return null
  const total = rows ? sumGroups(rows) : null

  return (
    <>
      <PageHeader eyebrow="Tu equipo" title="Reportes" description="Presupuestos de cada doctor, por la fecha en que se presentaron." />
      <TeamTabs />
      <div className="mb-6 w-full sm:w-64">
        <Select label="Periodo" options={periods.map((p) => ({ value: p.key, label: p.label }))} value={key} onChange={(e) => setKey(e.target.value as ReportPeriodKey)} />
      </div>

      {failed ? (
        <LoadError title="No pudimos cargar el reporte" onRetry={reload} />
      ) : !rows || !total ? (
        <Skeleton className="h-96 w-full" label="Cargando reporte" />
      ) : rows.length === 0 ? (
        <EmptyState icon="doctores" title="Aún no hay doctores" description="Agrega a tus doctores para ver sus presupuestos." />
      ) : (
        <div className="flex flex-col gap-6">
          <dl aria-label="Totales del periodo" className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {QUOTE_GROUPS.map((g) => (
              <div key={g.key} className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
                <dt className="text-caption text-ink-muted">{g.label}</dt>
                <dd className="m-0 flex flex-col">
                  <span className="font-display text-title">{total[g.key]}</span>
                  <span className="text-caption text-ink-muted">{money(total[`${g.key}_amount`])}</span>
                </dd>
              </div>
            ))}
          </dl>

          {/* Escritorio: tabla. */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-ui">
              <caption className="sr-only">Presupuestos por doctor</caption>
              <thead>
                <tr className="text-left text-caption text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Doctor</th>
                  {QUOTE_GROUPS.map((g) => (
                    <th key={g.key} className="py-2 pr-3 text-right font-medium" title={g.hint}>
                      {g.label}
                    </th>
                  ))}
                  <th className="py-2 text-right font-medium">Aceptación</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.doctor_id ?? 'sin-doctor'} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <DoctorName row={r} />
                    </td>
                    {QUOTE_GROUPS.map((g) => (
                      <td key={g.key} className="py-2 pr-3 text-right whitespace-nowrap">
                        <Cell groups={r} k={g.key} />
                      </td>
                    ))}
                    <td className="py-2 text-right">{pct(r)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2 pr-3">Total</td>
                  {QUOTE_GROUPS.map((g) => (
                    <td key={g.key} className="py-2 pr-3 text-right whitespace-nowrap">
                      <Cell groups={total} k={g.key} />
                    </td>
                  ))}
                  <td className="py-2 text-right">{pct(total)}</td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Móvil: una tarjeta por doctor. */}
          <ul aria-label="Presupuestos por doctor" className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
            {rows.map((r) => (
              <li key={r.doctor_id ?? 'sin-doctor'}>
                <Card className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <DoctorName row={r} />
                    <span className="text-caption text-ink-muted">Aceptación {pct(r)}</span>
                  </div>
                  <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-ui">
                    {QUOTE_GROUPS.map((g) => (
                      <div key={g.key} className="flex flex-col">
                        <dt className="text-caption text-ink-muted">{g.label}</dt>
                        <dd className="m-0">
                          <Cell groups={r} k={g.key} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
          <p className="m-0 text-caption text-ink-muted">
            En espera: presentados o en duda. Sin completar: aceptados o en tratamiento. Un presupuesto aceptado cuenta en «Aceptados» y, mientras no se termine, también en «Sin completar».
          </p>
        </div>
      )}
    </>
  )
}

const pct = (g: QuoteGroups) => {
  const a = acceptance(g)
  return a === null ? '—' : `${a}%`
}

function Cell({ groups, k }: { groups: QuoteGroups; k: (typeof QUOTE_GROUPS)[number]['key'] }) {
  return (
    <span className="inline-flex flex-col items-end max-md:items-start">
      <span>{groups[k]}</span>
      <span className="text-caption text-ink-muted">{money(groups[`${k}_amount`])}</span>
    </span>
  )
}

function DoctorName({ row }: { row: QuoteReportRow }) {
  if (!row.doctor_id) return <span className="font-semibold text-ink-muted">Sin doctor</span>
  return (
    <span className="flex flex-col">
      <Link to={`/doctores/${row.doctor_id}`} className="font-semibold text-violet">
        {row.full_name}
      </Link>
      {row.role && <span className="text-caption text-ink-muted">{ROLE_LABEL[row.role]}</span>}
    </span>
  )
}
