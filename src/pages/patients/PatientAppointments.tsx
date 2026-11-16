import { useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import type { AgendaItem } from '@/data/agenda'
import { DEFAULT_TZ, dayLabel, STATUS, zonedParts } from '@/lib/agenda'
import { useWorkspace } from '@/workspace/workspace-context'

const isUpcoming = (a: AgendaItem, now: number) => new Date(a.ends_at).getTime() >= now && a.status !== 'cancelada' && a.status !== 'no_asistio'
/** Cada cita se muestra en la zona horaria de su sucursal. */
function useTzOf() {
  const { branches } = useWorkspace()
  return (a: AgendaItem) => branches.find((b) => b.id === a.branch_id)?.timezone ?? DEFAULT_TZ
}
const when = (a: AgendaItem, tz: string) => {
  const p = zonedParts(new Date(a.starts_at), tz)
  return `${dayLabel(p.date)} · ${p.time}`
}

export function NextAppointment({ items }: { items: AgendaItem[] | null }) {
  const [now] = useState(() => Date.now())
  const tzOf = useTzOf()
  const next = items?.find((a) => isUpcoming(a, now))
  return (
    <span className="text-ui">
      {items === null ? (
        <span className="text-ink-muted">Cargando…</span>
      ) : next ? (
        <Link to={`/agenda?${new URLSearchParams({ fecha: zonedParts(new Date(next.starts_at), tzOf(next)).date, cita: next.id }).toString()}`} className="font-semibold text-violet">
          {when(next, tzOf(next))}
        </Link>
      ) : (
        <span className="text-ink-muted">Sin citas próximas.</span>
      )}
      {next && <span className="block text-caption text-ink-muted">{next.doctor_name} · {STATUS[next.status].label}</span>}
    </span>
  )
}

export function AppointmentsTab({ patientId, items, failed, retry, canSchedule }: { patientId: string; items: AgendaItem[] | null; failed: boolean; retry: () => void; canSchedule: boolean }) {
  const [now] = useState(() => Date.now())
  const tzOf = useTzOf()
  if (failed) return <LoadError title="No pudimos cargar las citas" onRetry={retry} />
  if (items === null) return <Skeleton className="h-40 w-full" label="Cargando citas" />
  const action = canSchedule ? (
    <Link to={`/agenda/nueva?paciente=${patientId}`} className={buttonClasses('primary')}>
      Agendar cita
    </Link>
  ) : undefined
  if (items.length === 0) return <EmptyState icon="agenda" title="Sin citas" description="Este paciente no tiene citas en los últimos 6 meses ni en los próximos." action={action} />
  const upcoming = items.filter((a) => isUpcoming(a, now))
  const past = items.filter((a) => !isUpcoming(a, now)).reverse()
  return (
    <div className="flex flex-col gap-4">
      {action && <div>{action}</div>}
      {[
        { title: 'Próximas', list: upcoming },
        { title: 'Anteriores', list: past },
      ].map(
        (g) =>
          g.list.length > 0 && (
            <Card key={g.title} as="section" aria-label={`Citas ${g.title.toLowerCase()}`} className="flex flex-col gap-2">
              <h2 className="m-0 text-subtitle">{g.title}</h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {g.list.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                    <span className="flex flex-col">
                      <span className="text-ui font-semibold">{when(a, tzOf(a))}</span>
                      <span className="text-caption text-ink-muted">
                        {a.doctor_name} · {a.branch_name} · {a.treatment_name ?? a.chair_name}
                      </span>
                    </span>
                    <Badge tone={STATUS[a.status].badge}>{STATUS[a.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ),
      )}
    </div>
  )
}
