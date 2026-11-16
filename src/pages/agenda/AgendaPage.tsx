import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import { listAppointments, type AgendaItem } from '@/data/agenda'
import { useDoctors } from '@/hooks/useDoctors'
import { addDays, DEFAULT_TZ, dayLabel, fromMinutes, hoursFor, STATUS, todayIn, toMinutes, zonedParts, zonedToUtc, type Hours } from '@/lib/agenda'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'
import { AppointmentDetail } from './AppointmentDetail'

const PX_PER_MIN = 1.2
const LEGEND = (['confirmada', 'programada', 'llego', 'no_asistio'] as const).map((s) => ({ s, ...STATUS[s] }))

/** P08 · Agenda del día por doctor (M3-A). Semana y Por sillón llegan con M3-B. */
export function AgendaPage() {
  const { active, branches, activeBranchId } = useWorkspace()
  const branch = branches.find((b) => b.id === activeBranchId) ?? null
  const tz = branch?.timezone ?? DEFAULT_TZ
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const today = todayIn(tz)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('fecha') ?? '') ? (params.get('fecha') as string) : today
  const selectedId = params.get('cita')
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const allDoctors = useDoctors(active?.tenant_id)
  const isDoctor = active?.role === 'doctor' || active?.role === 'doctor_collab'
  const canWrite = active?.tenant.status === 'active'

  useEffect(() => {
    if (!branch) return
    let current = true
    listAppointments({ branchId: branch.id, from: zonedToUtc(date, '00:00', tz), to: zonedToUtc(addDays(date, 1), '00:00', tz) }).then(
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
  }, [branch, date, tz, attempt])

  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }

  const ranges = hoursFor(branch?.opening_hours as Hours | null, date)
  const doctors = useMemo(() => {
    const list = isDoctor ? allDoctors.filter((d) => d.id === active?.id) : allDoctors
    // Siempre incluir a quien tenga citas ese día (aunque ya no esté en la lista).
    const extra = (items ?? []).filter((a) => !list.some((d) => d.id === a.doctor_id)).map((a) => ({ id: a.doctor_id, name: a.doctor_name }))
    return [...list, ...extra.filter((d, i) => extra.findIndex((x) => x.id === d.id) === i)]
  }, [allDoctors, items, isDoctor, active?.id])

  if (!active) return null
  if (!branch) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="sucursal"
        title="Agrega una sucursal para usar la agenda"
        description="La agenda se organiza por sucursal, sillón y doctor."
        action={
          <Link to="/configuracion/sucursales" className={buttonClasses('primary')}>
            Ir a Sucursales
          </Link>
        }
      />
    )
  }

  const shown = (items ?? []).filter((a) => a.status !== 'cancelada')
  const selected = (items ?? []).find((a) => a.id === selectedId) ?? null
  const newHref = (extra: Record<string, string> = {}) => `/agenda/nueva?${new URLSearchParams({ fecha: date, ...extra }).toString()}`

  return (
    <>
      <PageHeader
        eyebrow={branch.name}
        title="Agenda"
        actions={
          canWrite && (
            <Link to={newHref()} className={buttonClasses('primary')}>
              Nueva cita
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => go({ fecha: addDays(date, -1), cita: null })} aria-label="Día anterior" className={buttonClasses('secondary', 'sm')}>
          <Icon name="chevronRight" className="size-4 rotate-180" />
        </button>
        <button type="button" onClick={() => go({ fecha: today, cita: null })} className={buttonClasses('secondary', 'sm')} aria-pressed={date === today}>
          Hoy
        </button>
        <button type="button" onClick={() => go({ fecha: addDays(date, 1), cita: null })} aria-label="Día siguiente" className={buttonClasses('secondary', 'sm')}>
          <Icon name="chevronRight" className="size-4" />
        </button>
        <h2 className="m-0 grow text-subtitle">{date === today ? `Hoy, ${dayLabel(date).toLowerCase()}` : dayLabel(date)}</h2>
        <label className="flex items-center gap-2 text-caption text-ink-muted">
          <span className="sr-only">Ir a la fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && go({ fecha: e.target.value, cita: null })}
            className="h-9 rounded-sm border border-border bg-surface-raised px-2 text-ui text-ink"
          />
        </label>
      </div>

      <ul aria-label="Estados de cita" className="m-0 mb-4 flex list-none flex-wrap gap-3 p-0 text-caption text-ink-muted">
        {LEGEND.map((l) => (
          <li key={l.s} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-3 rounded-xs border-l-4', l.block)} />
            {l.label}
          </li>
        ))}
      </ul>

      {failed ? (
        <LoadError title="No pudimos cargar la agenda" onRetry={reload} />
      ) : items === null ? (
        <Skeleton className="h-96 w-full" label="Cargando la agenda" />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            {ranges.length === 0 && (
              <Card className="mb-4 flex flex-col gap-1">
                <span className="text-ui font-semibold">La sucursal no abre este día.</span>
                <span className="text-caption text-ink-muted">
                  No se agendan citas fuera del horario. Si hace falta, escribe a la clínica o al doctor para revisar el caso.
                </span>
              </Card>
            )}
            {ranges.length > 0 && (
              <DayGrid
                date={date}
                tz={tz}
                ranges={ranges}
                doctors={doctors}
                items={shown}
                selectedId={selectedId}
                onSelect={(id) => go({ cita: id })}
                onSlot={canWrite ? (doctorId, time) => navigate(newHref({ doctor: doctorId, hora: time })) : undefined}
              />
            )}
            <DayList items={shown} tz={tz} selectedId={selectedId} onSelect={(id) => go({ cita: id })} className={ranges.length > 0 ? 'md:hidden' : ''} />
            {shown.length === 0 && ranges.length > 0 && <p className="m-0 mt-3 text-ui text-ink-muted md:hidden">No hay citas este día.</p>}
          </div>
          <aside aria-label="Cita seleccionada" className="min-w-0">
            {selected ? (
              <AppointmentDetail
                key={selected.id}
                item={selected}
                tz={tz}
                clinicName={active.tenant.display_name}
                canWrite={canWrite}
                onChanged={reload}
                onClose={() => go({ cita: null })}
              />
            ) : (
              <Card className="hidden flex-col gap-1 xl:flex">
                <span className="text-ui font-semibold">Elige una cita</span>
                <span className="text-caption text-ink-muted">Verás sus datos y podrás confirmarla, marcar la llegada o reagendarla.</span>
              </Card>
            )}
          </aside>
        </div>
      )}
    </>
  )
}

type GridProps = {
  date: string
  tz: string
  ranges: [string, string][]
  doctors: { id: string; name: string }[]
  items: AgendaItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onSlot: ((doctorId: string, time: string) => void) | undefined
}

/** Cuadrícula por doctor (escritorio y tableta). En celular se usa la lista. */
function DayGrid({ tz, ranges, doctors, items, selectedId, onSelect, onSlot }: GridProps) {
  const local = items.map((a) => ({ a, from: toMinutes(zonedParts(new Date(a.starts_at), tz).time), to: toMinutes(zonedParts(new Date(a.ends_at), tz).time) || 24 * 60 }))
  const open = Math.min(...ranges.map(([a]) => toMinutes(a)), ...local.map((x) => x.from))
  const close = Math.max(...ranges.map(([, b]) => toMinutes(b)), ...local.map((x) => x.to))
  const start = Math.floor(open / 60) * 60
  const end = Math.ceil(close / 60) * 60
  const hours = Array.from({ length: (end - start) / 60 }, (_, i) => start + i * 60)
  const slots = Array.from({ length: (end - start) / 30 }, (_, i) => start + i * 30)
  const isOpen = (m: number) => ranges.some(([a, b]) => m >= toMinutes(a) && m + 30 <= toMinutes(b))
  const height = (end - start) * PX_PER_MIN

  return (
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface-raised md:block">
      <div className="grid min-w-[560px]" style={{ gridTemplateColumns: `64px repeat(${Math.max(doctors.length, 1)}, minmax(160px, 1fr))` }}>
        <div className="sticky left-0 border-b border-border bg-surface-raised" />
        {doctors.map((d) => (
          <div key={d.id} className="border-b border-l border-border px-3 py-2">
            <span className="block truncate text-ui font-semibold">{d.name}</span>
            <span className="text-caption text-ink-muted">
              {items.filter((a) => a.doctor_id === d.id).length} {items.filter((a) => a.doctor_id === d.id).length === 1 ? 'cita' : 'citas'}
            </span>
          </div>
        ))}
        {doctors.length === 0 && <div className="border-b border-l border-border px-3 py-2 text-caption text-ink-muted">Sin doctores</div>}

        <div className="relative border-border" style={{ height }}>
          {hours.map((h) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-caption text-ink-muted first:translate-y-0" style={{ top: (h - start) * PX_PER_MIN }}>
              {fromMinutes(h)}
            </span>
          ))}
        </div>
        {doctors.map((d) => (
          <div key={d.id} className="relative border-l border-border" style={{ height }}>
            {slots.map((m) =>
              isOpen(m) && onSlot ? (
                <button
                  key={m}
                  type="button"
                  aria-label={`Agendar a las ${fromMinutes(m)} con ${d.name}`}
                  onClick={() => onSlot(d.id, fromMinutes(m))}
                  className="absolute inset-x-0 border-t border-border/60 hover:bg-lavender/60 focus-visible:bg-lavender"
                  style={{ top: (m - start) * PX_PER_MIN, height: 30 * PX_PER_MIN }}
                />
              ) : (
                <div
                  key={m}
                  aria-hidden="true"
                  className={cn('absolute inset-x-0 border-t border-border/60', !isOpen(m) && 'bg-surface')}
                  style={{ top: (m - start) * PX_PER_MIN, height: 30 * PX_PER_MIN }}
                />
              ),
            )}
            {local
              .filter((x) => x.a.doctor_id === d.id)
              .map(({ a, from, to }) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a.id)}
                  aria-label={`${fromMinutes(from)} ${a.patient_name} · ${STATUS[a.status].label}`}
                  aria-current={a.id === selectedId ? 'true' : undefined}
                  className={cn(
                    'absolute inset-x-1 z-10 flex flex-col overflow-hidden rounded-sm border-l-4 px-2 py-1 text-left',
                    STATUS[a.status].block,
                    a.kind === 'valoracion' && 'ring-1 ring-violet/40',
                    a.id === selectedId && 'outline-2 outline-violet',
                  )}
                  style={{ top: (from - start) * PX_PER_MIN + 1, height: Math.max((to - from) * PX_PER_MIN - 2, 22) }}
                >
                  <span className="truncate text-caption font-semibold text-ink">{a.patient_name}</span>
                  <span className="truncate text-caption text-ink-muted">
                    {fromMinutes(from)} · {a.treatment_name ?? (a.kind === 'valoracion' ? 'Valoración' : a.kind === 'revision' ? 'Revisión' : 'Tratamiento')}
                  </span>
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayList({ items, tz, selectedId, onSelect, className }: { items: AgendaItem[]; tz: string; selectedId: string | null; onSelect: (id: string) => void; className?: string }) {
  if (items.length === 0) return null
  return (
    <ul aria-label="Citas del día" className={cn('m-0 flex list-none flex-col gap-2 p-0', className)}>
      {items.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onSelect(a.id)}
            aria-current={a.id === selectedId ? 'true' : undefined}
            className={cn('flex w-full items-center gap-3 rounded-md border-l-4 px-3 py-2.5 text-left', STATUS[a.status].block)}
          >
            <span className="w-12 shrink-0 text-ui font-semibold">{zonedParts(new Date(a.starts_at), tz).time}</span>
            <span className="flex min-w-0 grow flex-col">
              <span className="truncate text-ui font-semibold text-ink">{a.patient_name}</span>
              <span className="truncate text-caption text-ink-muted">
                {a.doctor_name} · {a.chair_name}
              </span>
            </span>
            <span className="shrink-0 text-caption text-ink-muted">{STATUS[a.status].label}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
