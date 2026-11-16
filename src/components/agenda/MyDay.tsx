import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { listAppointments, type AgendaItem } from '@/data/agenda'
import { addDays, DEFAULT_TZ, dayLabel, kindLabel, STATUS, todayIn, zonedParts, zonedToUtc } from '@/lib/agenda'
import { useWorkspace } from '@/workspace/workspace-context'

/**
 * «Mi día» (maqueta Movil-MiDia): citas de hoy de la sucursal activa (un doctor ve solo
 * las suyas), cuántas faltan por confirmar y las siguientes. Las tareas llegan con M8.
 */
export function MyDay() {
  const { branches, activeBranchId } = useWorkspace()
  const branch = branches.find((b) => b.id === activeBranchId) ?? null
  const tz = branch?.timezone ?? DEFAULT_TZ
  const today = todayIn(tz)
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    if (!branch) return
    let current = true
    listAppointments({ branchId: branch.id, from: zonedToUtc(today, '00:00', tz), to: zonedToUtc(addDays(today, 1), '00:00', tz) }).then(
      (r) => {
        if (!current) return
        setFailed(false)
        setItems(r)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [branch, today, tz, attempt])

  if (!branch) return null
  const active = (items ?? []).filter((a) => a.status !== 'cancelada')
  const pending = active.filter((a) => a.status === 'programada' && new Date(a.ends_at).getTime() >= now)
  const next = active.filter((a) => new Date(a.ends_at).getTime() >= now && a.status !== 'no_asistio')

  return (
    <section aria-labelledby="mi-dia" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="mi-dia" className="m-0 text-subtitle">
          Mi día
        </h2>
        <span className="text-caption text-ink-muted">
          {branch.name} · {dayLabel(today).toLowerCase()}
        </span>
      </div>

      {failed ? (
        <LoadError title="No pudimos cargar tus citas de hoy" onRetry={() => setAttempt((n) => n + 1)} />
      ) : items === null ? (
        <Skeleton className="h-32 w-full" label="Cargando tus citas de hoy" />
      ) : (
        <>
          <dl className="m-0 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
              <dt className="text-caption text-ink-muted">Citas hoy</dt>
              <dd className="m-0 font-display text-title">{active.length}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
              <dt className="text-caption text-ink-muted">Sin confirmar</dt>
              <dd className={`m-0 font-display text-title ${pending.length ? 'text-warning' : ''}`}>{pending.length}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-ui font-semibold">Siguientes citas</h3>
            {next.length === 0 ? (
              <p className="m-0 text-ui text-ink-muted">
                No tienes más citas hoy.{' '}
                <Link to="/agenda" className="font-semibold text-violet">
                  Ver la agenda
                </Link>
              </p>
            ) : (
              <ul aria-label="Siguientes citas" className="m-0 flex list-none flex-col gap-2 p-0">
                {next.map((a) => {
                  const t = zonedParts(new Date(a.starts_at), tz).time
                  return (
                    <li key={a.id}>
                      <Link
                        to={`/agenda?${new URLSearchParams({ fecha: today, cita: a.id }).toString()}`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3 hover:border-violet"
                      >
                        <span className="flex w-14 shrink-0 flex-col">
                          <span className="text-ui font-semibold text-ink">{t}</span>
                          <span className="truncate text-caption text-ink-muted">{a.chair_name}</span>
                        </span>
                        <span className="flex min-w-0 grow flex-col">
                          <span className="truncate text-ui font-semibold text-ink">{a.patient_name}</span>
                          <span className="truncate text-caption text-ink-muted">
                            {a.treatment_name ?? kindLabel(a.kind)} · {a.doctor_name}
                          </span>
                        </span>
                        <Badge tone={a.kind === 'valoracion' && a.status === 'programada' ? 'violet' : STATUS[a.status].badge}>
                          {a.kind === 'valoracion' && a.status === 'programada' ? 'Valoración' : STATUS[a.status].label}
                        </Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
