import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { commissionSummary, setCommissionPeriod } from '@/data/commissions'
import { DEFAULT_TZ, todayIn } from '@/lib/agenda'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/doctors'
import { commissionsCsv, commissionStatus, PERIOD_KINDS, periodTotals, recentPeriods, schemeLabel, type CommissionPeriodKind, type CommissionRow } from '@/lib/commissions'
import { money } from '@/lib/quotes'
import { canSeeCommissions } from '@/lib/access'
import { ROLE_LABEL } from '@/lib/roles'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'
import { CommissionDetail } from './CommissionDetail'
import { TeamTabs } from './TeamTabs'

/** P28 · Comisiones de doctores por periodo. Gerencia: todos; cada doctor: las suyas. */
export function CommissionsPage() {
  const { active, branches, activeBranchId } = useWorkspace()
  const tz = branches.find((b) => b.id === activeBranchId)?.timezone ?? DEFAULT_TZ
  const [kind, setKind] = useState<CommissionPeriodKind>(active?.tenant.commission_period === 'mensual' ? 'mensual' : 'quincenal')
  const [periodIdx, setPeriodIdx] = useState(0)
  const [rows, setRows] = useState<CommissionRow[] | null>(null)
  const [params] = useSearchParams()
  const [picked, setPicked] = useState<string | null>(params.get('doctor'))
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [periodError, setPeriodError] = useState<string | null>(null)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const tenantId = active?.tenant_id
  const role = active?.role
  const isManager = role === 'owner' || role === 'admin'
  const canSee = canSeeCommissions(role)
  const canManage = isManager && active?.tenant.status === 'active'
  const periods = recentPeriods(todayIn(tz), kind, 6)
  const period = periods[periodIdx] ?? periods[0]!

  useEffect(() => {
    if (!tenantId || !canSee) return
    let current = true
    commissionSummary(tenantId, period.from, period.to).then(
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
  }, [tenantId, canSee, period.from, period.to, attempt])

  if (!active) return null
  if (!canSee) {
    return (
      <>
        <TeamTabs />
        <EmptyState headingLevel="h1" icon="doctores" title="Las comisiones las ve la gerencia" description="La dueña y la administración ven las comisiones de todos. Cada doctor ve solo las suyas." />
      </>
    )
  }

  const changeKind = async (k: CommissionPeriodKind) => {
    setPeriodError(null)
    try {
      await setCommissionPeriod(active.tenant_id, k)
      setKind(k)
      setPeriodIdx(0)
    } catch {
      setPeriodError('No pudimos cambiar el corte. Intenta de nuevo.')
    }
  }

  const exportCsv = () => {
    if (!rows || typeof URL.createObjectURL !== 'function') return
    const url = URL.createObjectURL(new Blob([commissionsCsv(rows, period)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `comisiones-${period.from}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selected = rows?.find((r) => r.doctor_id === picked) ?? rows?.find((r) => r.scheme_kind) ?? rows?.[0] ?? null
  const totals = rows ? periodTotals(rows) : null
  const kpis = isManager
    ? [
        { label: 'Cobrado en el periodo', value: totals ? money(totals.collected) : '—' },
        { label: 'Comisiones por pagar', value: totals ? money(totals.pending) : '—', alert: Boolean(totals?.pending) },
        { label: 'Queda para la clínica', value: totals ? money(totals.clinic) : '—' },
      ]
    : [
        { label: 'Cobrado a tus pacientes', value: totals ? money(totals.collected) : '—' },
        { label: 'Tu comisión del periodo', value: totals ? money(totals.commission) : '—' },
        { label: 'Por pagarte', value: totals ? money(totals.pending) : '—', alert: Boolean(totals?.pending) },
      ]

  return (
    <>
      <PageHeader
        eyebrow="Tu equipo"
        title="Comisiones"
        description="Se calculan sobre lo cobrado, no sobre lo presupuestado."
        actions={
          isManager &&
          rows &&
          rows.length > 0 && (
            <Button variant="secondary" onClick={exportCsv}>
              Exportar
            </Button>
          )
        }
      />
      <TeamTabs />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-56">
          <Select label="Periodo" options={periods.map((p, i) => ({ value: String(i), label: p.label }))} value={String(periodIdx)} onChange={(e) => setPeriodIdx(Number(e.target.value))} />
        </div>
        {canManage && (
          <div className="w-full sm:w-72">
            <Select label="Corte de la clínica" options={PERIOD_KINDS} value={kind} onChange={(e) => void changeKind(e.target.value as CommissionPeriodKind)} />
          </div>
        )}
      </div>
      {periodError && (
        <Alert tone="error" className="mb-4">
          {periodError}
        </Alert>
      )}

      {failed ? (
        <LoadError title="No pudimos cargar las comisiones" onRetry={reload} />
      ) : !rows ? (
        <Skeleton className="h-96 w-full" label="Cargando comisiones" />
      ) : rows.length === 0 ? (
        <EmptyState icon="doctores" title="Aún no hay doctores" description="Agrega a tus doctores para asignarles su esquema de comisión." />
      ) : (
        <div className="flex flex-col gap-6">
          <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.label} className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
                <dt className="text-caption text-ink-muted">{k.label}</dt>
                <dd className={cn('m-0 font-display text-title', k.alert && 'text-warning')}>{k.value}</dd>
              </div>
            ))}
          </dl>

          {isManager && rows.every((r) => r.role === 'owner') && (
            <Alert tone="info">
              La dueña no lleva comisión. Para asignar un esquema,{' '}
              <Link to="/doctores/nuevo" className="font-semibold text-violet">
                agrega a un doctor
              </Link>
              , con o sin correo.
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {isManager && (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-ui">
                  <caption className="sr-only">Comisiones por doctor</caption>
                  <thead>
                    <tr className="text-left text-caption text-ink-muted">
                      <th className="py-2 pr-3 font-medium">Doctor</th>
                      <th className="py-2 pr-3 font-medium">Esquema</th>
                      <th className="py-2 pr-3 text-right font-medium">Pacientes</th>
                      <th className="py-2 pr-3 text-right font-medium">Cobrado</th>
                      <th className="py-2 pr-3 text-right font-medium">Comisión</th>
                      <th className="py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const st = commissionStatus(r)
                      const on = selected?.doctor_id === r.doctor_id
                      return (
                        <tr key={r.doctor_id} className={cn('border-t border-border', on && 'bg-lavender')}>
                          <td className="py-2 pr-3">
                            <button type="button" onClick={() => setPicked(r.doctor_id)} aria-pressed={on} className="flex min-h-11 items-center gap-2 text-left">
                              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-pill bg-night text-caption font-semibold text-on-night">
                                {initials(r.full_name)}
                              </span>
                              <span className="flex flex-col">
                                <span className="font-semibold text-ink">{r.full_name}</span>
                                <span className="text-caption text-ink-muted">{ROLE_LABEL[r.role]}</span>
                              </span>
                            </button>
                          </td>
                          <td className="py-2 pr-3 text-ink-muted">{schemeLabel(r)}</td>
                          <td className="py-2 pr-3 text-right">{r.patients}</td>
                          <td className="py-2 pr-3 text-right whitespace-nowrap">{money(r.collected)}</td>
                          <td className="py-2 pr-3 text-right whitespace-nowrap">{r.scheme_kind ? money(r.commission) : '—'}</td>
                          <td className="py-2">
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            )}
            {selected && (
              <div className={cn(!isManager && '2xl:col-span-2')}>
                <CommissionDetail key={`${selected.doctor_id}-${period.from}`} row={selected} period={period} canManage={canManage} onChanged={reload} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
