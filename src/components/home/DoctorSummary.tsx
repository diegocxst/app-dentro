import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Skeleton } from '@/components/ui/Skeleton'
import { listAppointments } from '@/data/agenda'
import { listPatients } from '@/data/patients'
import { quoteStats } from '@/data/quotes'
import { addDays, addMonths, DEFAULT_TZ, kindLabel, todayIn, weekStart, zonedParts, zonedToUtc } from '@/lib/agenda'
import { money, type QuoteStats } from '@/lib/quotes'
import { useWorkspace } from '@/workspace/workspace-context'

type Summary = {
  week: number
  patients: number
  stats: QuoteStats
  treatments: { name: string; count: number }[]
}

/** Lo que cuenta como atendido o por atender (sin canceladas ni faltas). */
const COUNTS = (status: string) => status !== 'cancelada' && status !== 'no_asistio'

/**
 * Resumen del doctor en Inicio (Ajustes-D): sus citas de la semana, sus pacientes,
 * sus presupuestos del mes y los tratamientos que más agenda. El servidor ya filtra
 * todo a lo suyo (RLS y `list_appointments`).
 */
export function DoctorSummary() {
  const { active, branches, activeBranchId } = useWorkspace()
  const tz = branches.find((b) => b.id === activeBranchId)?.timezone ?? DEFAULT_TZ
  const tenantId = active?.tenant_id
  const doctorId = active?.id
  const today = todayIn(tz)
  const [data, setData] = useState<Summary | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!tenantId || !doctorId) return
    let current = true
    const week = weekStart(today)
    const weekEnd = addDays(week, 7)
    const month = `${today.slice(0, 8)}01`
    const monthEnd = addMonths(month, 1)
    const from = week < month ? week : month
    const to = weekEnd > monthEnd ? weekEnd : monthEnd
    Promise.all([
      listAppointments({ from: zonedToUtc(from, '00:00', tz), to: zonedToUtc(to, '00:00', tz) }),
      listPatients({ tenantId, page: 0 }),
      quoteStats(tenantId, zonedToUtc(month, '00:00', tz), doctorId),
    ]).then(
      ([appts, patients, stats]) => {
        if (!current) return
        const mine = appts.filter((a) => a.doctor_id === doctorId && COUNTS(a.status))
        const dateOf = (iso: string) => zonedParts(new Date(iso), tz).date
        const byTreatment = new Map<string, number>()
        for (const a of mine) {
          const d = dateOf(a.starts_at)
          if (d < month || d >= monthEnd) continue
          const name = a.treatment_name ?? kindLabel(a.kind)
          byTreatment.set(name, (byTreatment.get(name) ?? 0) + 1)
        }
        setFailed(false)
        setData({
          week: mine.filter((a) => {
            const d = dateOf(a.starts_at)
            return d >= week && d < weekEnd
          }).length,
          patients: patients.total,
          stats,
          treatments: [...byTreatment].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5),
        })
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, doctorId, today, tz, attempt])

  if (failed) return <LoadError title="No pudimos cargar tu resumen" onRetry={() => setAttempt((n) => n + 1)} />
  if (!data) return <Skeleton className="h-40 w-full" label="Cargando tu resumen" />

  const kpis = [
    { label: 'Citas esta semana', value: String(data.week), to: `/agenda?vista=semana` },
    { label: 'Mis pacientes', value: String(data.patients), to: '/pacientes' },
    { label: 'Presupuestos aceptados este mes', value: String(data.stats.won), to: '/presupuestos' },
    { label: 'En duda, por recuperar', value: money(data.stats.in_doubt_total), to: '/presupuestos' },
  ]

  return (
    <section aria-labelledby="mi-resumen" className="flex flex-col gap-4">
      <h2 id="mi-resumen" className="m-0 text-subtitle">
        Mi resumen
      </h2>
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="relative flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4 hover:border-violet">
            <dt className="text-caption text-ink-muted">
              <Link to={k.to} className="text-ink-muted no-underline after:absolute after:inset-0">
                {k.label}
              </Link>
            </dt>
            <dd className="m-0 font-display text-title tabular">{k.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-ui font-semibold">Tratamientos del mes</h3>
        {data.treatments.length === 0 ? (
          <p className="m-0 text-ui text-ink-muted">Aún no tienes citas este mes.</p>
        ) : (
          <ul aria-label="Tratamientos del mes" className="m-0 flex list-none flex-col p-0">
            {data.treatments.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0">
                <span className="truncate text-ui">{t.name}</span>
                <span className="shrink-0 text-ui font-semibold tabular">{t.count === 1 ? '1 cita' : `${t.count} citas`}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/doctores/comisiones" className="text-ui font-semibold text-violet">
          Ver mis comisiones
        </Link>
      </div>
    </section>
  )
}
