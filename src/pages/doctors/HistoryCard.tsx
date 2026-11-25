import { useCallback, useEffect, useState } from 'react'
import { LoadError } from '@/components/feedback/LoadError'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { doctorHistory } from '@/data/reports'
import { kindLabel, STATUS, todayIn, zonedParts, dayLabel } from '@/lib/agenda'
import { money } from '@/lib/quotes'
import { QUOTE_GROUPS, reportPeriods, type DoctorHistory, type HistoryAppointment, type ReportPeriodKey } from '@/lib/reports'

/** Historial del doctor en su perfil (M6-B2b). Solo la dueña o el dueño lo ve. */
export function HistoryCard({ doctorId, tz, seesCommission }: { doctorId: string; tz: string; seesCommission: boolean }) {
  const [today] = useState(() => todayIn(tz))
  const periods = reportPeriods(today)
  const [key, setKey] = useState<ReportPeriodKey>('mes')
  const period = periods.find((p) => p.key === key) ?? periods[0]!
  const [data, setData] = useState<DoctorHistory | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let current = true
    doctorHistory(doctorId, period.from, period.to).then(
      (d) => {
        if (!current) return
        setFailed(false)
        setData(d)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [doctorId, period.from, period.to, attempt])

  const stats = data
    ? [
        { label: 'Citas atendidas', value: String(data.appointments.attended) },
        { label: 'Pacientes atendidos', value: String(data.patients) },
        { label: 'Faltas', value: String(data.appointments.no_show) },
        { label: 'Canceladas', value: String(data.appointments.cancelled) },
        { label: 'Cobrado', value: money(data.collected) },
        ...(seesCommission ? [{ label: 'Comisiones', value: money(data.commission) }] : []),
      ]
    : []

  return (
    <Card as="section" aria-labelledby="historial-titulo" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="historial-titulo" className="m-0 text-subtitle">
            Historial
          </h2>
          <p className="m-0 text-caption text-ink-muted">Solo tú lo ves.</p>
        </div>
        <div className="w-full sm:w-60">
          <Select label="Periodo del historial" options={periods.map((p) => ({ value: p.key, label: p.label }))} value={key} onChange={(e) => setKey(e.target.value as ReportPeriodKey)} />
        </div>
      </div>

      {failed ? (
        <LoadError title="No pudimos cargar el historial" onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-64 w-full" label="Cargando historial" />
      ) : (
        <>
          <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <dt className="text-caption text-ink-muted">{s.label}</dt>
                <dd className="m-0 font-display text-subtitle">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-ui font-semibold">Presupuestos</h3>
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-ui sm:grid-cols-5">
              {QUOTE_GROUPS.map((g) => (
                <div key={g.key} className="flex flex-col">
                  <dt className="text-caption text-ink-muted">{g.label}</dt>
                  <dd className="m-0">
                    {data.quotes[g.key]} · {money(data.quotes[`${g.key}_amount`])}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AppointmentList title="Próximas citas" empty="No tiene citas próximas." items={data.upcoming} tz={tz} />
            <AppointmentList title="Últimas citas del periodo" empty="No tuvo citas en este periodo." items={data.recent} tz={tz} />
          </div>
        </>
      )}
    </Card>
  )
}

function AppointmentList({ title, empty, items, tz }: { title: string; empty: string; items: HistoryAppointment[]; tz: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="m-0 text-ui font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="m-0 text-ui text-ink-muted">{empty}</p>
      ) : (
        <ul aria-label={title} className="m-0 flex list-none flex-col p-0">
          {items.map((a) => {
            const at = zonedParts(new Date(a.starts_at), tz)
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 border-t border-border py-2 text-ui first:border-t-0">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{a.patient}</span>
                  <span className="text-caption text-ink-muted">
                    {dayLabel(at.date)} · {at.time} · {a.treatment ?? kindLabel(a.kind)}
                  </span>
                </span>
                <Badge tone={STATUS[a.status].badge}>{STATUS[a.status].label}</Badge>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
