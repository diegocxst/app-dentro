import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import { listAppointments, type AgendaItem } from '@/data/agenda'
import { fetchChairs, type Chair } from '@/data/catalog'
import { useDoctors } from '@/hooks/useDoctors'
import {
  addDays,
  assignLanes,
  DEFAULT_TZ,
  dayLabel,
  fromMinutes,
  hoursFor,
  STATUS,
  todayIn,
  toMinutes,
  weekStart,
  zonedParts,
  zonedToUtc,
  type Hours,
} from '@/lib/agenda'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'
import { AppointmentDetail } from './AppointmentDetail'

const PX_PER_MIN = 1.2
const LEGEND = (['confirmada', 'programada', 'llego', 'no_asistio'] as const).map((s) => ({ s, ...STATUS[s] }))
type View = 'dia' | 'semana' | 'sillon'
const VIEWS: { id: View; label: string }[] = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'sillon', label: 'Por unidad' },
]
const shortDay = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

/** P08 · Agenda: Día (por doctor), Semana y Por unidad. */
export function AgendaPage() {
  const { active, branches, activeBranchId } = useWorkspace()
  const branch = branches.find((b) => b.id === activeBranchId) ?? null
  const tz = branch?.timezone ?? DEFAULT_TZ
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const today = todayIn(tz)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('fecha') ?? '') ? (params.get('fecha') as string) : today
  const view: View = (['semana', 'sillon'] as const).find((v) => v === params.get('vista')) ?? 'dia'
  const selectedId = params.get('cita')
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [chairs, setChairs] = useState<Chair[]>([])
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const allDoctors = useDoctors(active?.tenant_id)
  const isDoctor = active?.role === 'doctor' || active?.role === 'doctor_collab'
  const canWrite = active?.tenant.status === 'active'
  const from = view === 'semana' ? weekStart(date) : date
  const days = view === 'semana' ? 7 : 1

  useEffect(() => {
    if (!branch) return
    let current = true
    listAppointments({ branchId: branch.id, from: zonedToUtc(from, '00:00', tz), to: zonedToUtc(addDays(from, days), '00:00', tz) }).then(
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
  }, [branch, from, days, tz, attempt])

  useEffect(() => {
    if (!active?.tenant_id) return
    let current = true
    fetchChairs(active.tenant_id).then(
      (c) => current && setChairs(c),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [active?.tenant_id])

  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }

  const doctors = useMemo(() => {
    const list = isDoctor ? allDoctors.filter((d) => d.id === active?.id) : allDoctors
    // Siempre incluir a quien tenga citas (aunque ya no esté en la lista).
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
        description="La agenda se organiza por sucursal, unidad dental y doctor."
        action={
          <Link to="/configuracion/sucursales" className={buttonClasses('primary')}>
            Ir a Sucursales
          </Link>
        }
      />
    )
  }

  const hours = branch.opening_hours as Hours | null
  const shown = (items ?? []).filter((a) => a.status !== 'cancelada')
  const selected = (items ?? []).find((a) => a.id === selectedId) ?? null
  const newHref = (extra: Record<string, string> = {}) => `/agenda/nueva?${new URLSearchParams({ fecha: date, ...extra }).toString()}`
  const step = view === 'semana' ? 7 : 1
  const localOf = (a: AgendaItem) => ({ date: zonedParts(new Date(a.starts_at), tz).date, from: toMinutes(zonedParts(new Date(a.starts_at), tz).time), to: toMinutes(zonedParts(new Date(a.ends_at), tz).time) || 24 * 60 })
  const title =
    view === 'semana'
      ? `Semana del ${dayLabel(from).toLowerCase()} al ${dayLabel(addDays(from, 6)).toLowerCase()}`
      : date === today
        ? `Hoy, ${dayLabel(date).toLowerCase()}`
        : dayLabel(date)

  // Columnas y horario según la vista.
  const branchChairs = [
    ...chairs.filter((c) => c.branch_id === branch.id && c.is_active),
    ...shown.filter((a) => !chairs.some((c) => c.id === a.chair_id && c.is_active)).map((a) => ({ id: a.chair_id, name: a.chair_name })),
  ].filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const grid =
    view === 'semana'
      ? {
          columns: weekDays.map((d) => ({ id: d, name: shortDay.format(new Date(`${d}T12:00:00Z`)).replace('.', ''), today: d === today })),
          colOf: (a: AgendaItem) => localOf(a).date,
          rangesOf: (colId: string) => hoursFor(hours, colId),
          slotLabel: (colName: string, time: string) => `Agendar el ${colName} a las ${time}`,
          slotHref: (colId: string, time: string) => newHref({ fecha: colId, hora: time }),
          countLabel: false,
          onHeader: (colId: string) => go({ vista: null, fecha: colId, cita: null }),
        }
      : view === 'sillon'
        ? {
            columns: branchChairs.map((c) => ({ id: c.id, name: c.name, today: false })),
            colOf: (a: AgendaItem) => a.chair_id,
            rangesOf: () => hoursFor(hours, date),
            slotLabel: (colName: string, time: string) => `Agendar a las ${time} en ${colName}`,
            slotHref: (colId: string, time: string) => newHref({ sillon: colId, hora: time }),
            countLabel: true,
            onHeader: undefined,
          }
        : {
            columns: doctors.map((d) => ({ id: d.id, name: d.name, today: false })),
            colOf: (a: AgendaItem) => a.doctor_id,
            rangesOf: () => hoursFor(hours, date),
            slotLabel: (colName: string, time: string) => `Agendar a las ${time} con ${colName}`,
            slotHref: (colId: string, time: string) => newHref({ doctor: colId, hora: time }),
            countLabel: true,
            onHeader: undefined,
          }
  const anyOpen = grid.columns.some((c) => grid.rangesOf(c.id).length > 0)

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

      <div role="group" aria-label="Vista de la agenda" className="mb-4 inline-flex rounded-md border border-border bg-surface-raised p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => go({ vista: v.id === 'dia' ? null : v.id, cita: null })}
            className={cn('min-h-9 rounded-sm px-3 text-ui font-semibold', view === v.id ? 'bg-violet text-on-violet' : 'text-ink-muted hover:text-ink')}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => go({ fecha: addDays(date, -step), cita: null })}
          aria-label={view === 'semana' ? 'Semana anterior' : 'Día anterior'}
          className={buttonClasses('secondary', 'sm')}
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
        </button>
        <button type="button" onClick={() => go({ fecha: today, cita: null })} className={buttonClasses('secondary', 'sm')}>
          Hoy
        </button>
        <button
          type="button"
          onClick={() => go({ fecha: addDays(date, step), cita: null })}
          aria-label={view === 'semana' ? 'Semana siguiente' : 'Día siguiente'}
          className={buttonClasses('secondary', 'sm')}
        >
          <Icon name="chevronRight" className="size-4" />
        </button>
        <h2 className="m-0 grow text-subtitle">{title}</h2>
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
            {!anyOpen && (
              <Card className="mb-4 flex flex-col gap-1">
                <span className="text-ui font-semibold">{view === 'semana' ? 'La sucursal no abre esta semana.' : 'La sucursal no abre este día.'}</span>
                <span className="text-caption text-ink-muted">
                  No se agendan citas fuera del horario. Si hace falta, escribe a la clínica o al doctor para revisar el caso.
                </span>
              </Card>
            )}
            {view === 'sillon' && branchChairs.length === 0 && (
              <Card className="mb-4 flex flex-col gap-1">
                <span className="text-ui font-semibold">Esta sucursal no tiene unidades dentales.</span>
                <Link to="/configuracion/sucursales" className="text-ui font-semibold text-violet">
                  Agregar unidades dentales
                </Link>
              </Card>
            )}
            {anyOpen && grid.columns.length > 0 && (
              <TimeGrid
                columns={grid.columns}
                items={shown.map((a) => ({ a, col: grid.colOf(a), ...localOf(a) }))}
                rangesOf={grid.rangesOf}
                selectedId={selectedId}
                lanes={view === 'semana'}
                countLabel={grid.countLabel}
                onHeader={grid.onHeader}
                onSelect={(id) => go({ cita: id })}
                slot={canWrite ? { label: grid.slotLabel, onClick: (colId, time) => navigate(grid.slotHref(colId, time)) } : undefined}
              />
            )}
            {view === 'semana' ? (
              <WeekList days={weekDays} items={shown} tz={tz} selectedId={selectedId} onSelect={(id) => go({ cita: id })} />
            ) : (
              <>
                <DayList items={shown} tz={tz} selectedId={selectedId} onSelect={(id) => go({ cita: id })} className={anyOpen ? 'md:hidden' : ''} />
                {shown.length === 0 && anyOpen && <p className="m-0 mt-3 text-ui text-ink-muted md:hidden">No hay citas este día.</p>}
              </>
            )}
          </div>
          <aside aria-label="Cita seleccionada" className="min-w-0">
            {selected ? (
              <AppointmentDetail
                key={selected.id}
                item={selected}
                tz={tz}
                clinicName={active.tenant.display_name}
                canWrite={canWrite}
                canSeeLeads={['owner', 'admin', 'reception'].includes(active.role)}
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

type Placed = { a: AgendaItem; col: string; from: number; to: number }
type GridProps = {
  columns: { id: string; name: string; today: boolean }[]
  items: Placed[]
  rangesOf: (colId: string) => [string, string][]
  selectedId: string | null
  lanes: boolean
  countLabel: boolean
  onHeader: ((colId: string) => void) | undefined
  onSelect: (id: string) => void
  slot: { label: (colName: string, time: string) => string; onClick: (colId: string, time: string) => void } | undefined
}

/** Cuadrícula por columnas (doctores, unidades dentales o días). En celular se usa la lista. */
function TimeGrid({ columns, items, rangesOf, selectedId, lanes, countLabel, onHeader, onSelect, slot }: GridProps) {
  const allRanges = columns.flatMap((c) => rangesOf(c.id))
  const open = Math.min(...allRanges.map(([a]) => toMinutes(a)), ...items.map((x) => x.from))
  const close = Math.max(...allRanges.map(([, b]) => toMinutes(b)), ...items.map((x) => x.to))
  const start = Math.floor(open / 60) * 60
  const end = Math.ceil(close / 60) * 60
  const hours = Array.from({ length: (end - start) / 60 }, (_, i) => start + i * 60)
  const slots = Array.from({ length: (end - start) / 30 }, (_, i) => start + i * 30)
  const height = (end - start) * PX_PER_MIN
  const minCol = lanes ? 100 : 160

  return (
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface-raised md:block">
      <div className="grid" style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(${minCol}px, 1fr))`, minWidth: 64 + columns.length * minCol }}>
        <div className="border-b border-border" />
        {columns.map((c) => {
          const n = items.filter((x) => x.col === c.id).length
          const body = (
            <>
              <span className={cn('block truncate text-ui font-semibold', c.today && 'text-violet')}>{c.name}</span>
              {countLabel && (
                <span className="text-caption text-ink-muted">
                  {n} {n === 1 ? 'cita' : 'citas'}
                </span>
              )}
            </>
          )
          return (
            <div key={c.id} className="border-b border-l border-border px-3 py-2">
              {onHeader ? (
                <button type="button" onClick={() => onHeader(c.id)} className="w-full text-left capitalize hover:text-violet" aria-label={`Ver el día ${c.name}`}>
                  {body}
                </button>
              ) : (
                body
              )}
            </div>
          )
        })}

        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-caption text-ink-muted first:translate-y-0" style={{ top: (h - start) * PX_PER_MIN }}>
              {fromMinutes(h)}
            </span>
          ))}
        </div>
        {columns.map((c) => {
          const ranges = rangesOf(c.id)
          const isOpen = (m: number) => ranges.some(([a, b]) => m >= toMinutes(a) && m + 30 <= toMinutes(b))
          const mine = items.filter((x) => x.col === c.id)
          const laneMap = lanes ? assignLanes(mine.map((x) => ({ id: x.a.id, from: x.from, to: x.to }))) : null
          return (
            <div key={c.id} className="relative border-l border-border" style={{ height }}>
              {slots.map((m) =>
                isOpen(m) && slot ? (
                  <button
                    key={m}
                    type="button"
                    aria-label={slot.label(c.name, fromMinutes(m))}
                    onClick={() => slot.onClick(c.id, fromMinutes(m))}
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
              {mine.map(({ a, from, to }) => {
                const lane = laneMap?.get(a.id) ?? { lane: 0, lanes: 1 }
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelect(a.id)}
                    aria-label={`${fromMinutes(from)} ${a.patient_name} · ${STATUS[a.status].label}`}
                    aria-current={a.id === selectedId ? 'true' : undefined}
                    className={cn(
                      'absolute z-10 flex flex-col overflow-hidden rounded-sm border-l-4 px-2 py-1 text-left',
                      STATUS[a.status].block,
                      a.kind === 'valoracion' && 'ring-1 ring-violet/40',
                      a.id === selectedId && 'outline-2 outline-violet',
                    )}
                    style={{
                      top: (from - start) * PX_PER_MIN + 1,
                      height: Math.max((to - from) * PX_PER_MIN - 2, 22),
                      left: `calc(${(lane.lane / lane.lanes) * 100}% + 4px)`,
                      width: `calc(${100 / lane.lanes}% - 8px)`,
                    }}
                  >
                    <span className="truncate text-caption font-semibold text-ink">{a.patient_name}</span>
                    <span className="truncate text-caption text-ink-muted">
                      {fromMinutes(from)} · {lanes ? a.doctor_name : (a.treatment_name ?? (a.kind === 'valoracion' ? 'Valoración' : a.kind === 'revision' ? 'Revisión' : 'Tratamiento'))}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
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
          <ItemButton a={a} tz={tz} selected={a.id === selectedId} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}

/** Semana en celular: lista agrupada por día. */
function WeekList({ days, items, tz, selectedId, onSelect }: { days: string[]; items: AgendaItem[]; tz: string; selectedId: string | null; onSelect: (id: string) => void }) {
  const byDay = days.map((d) => ({ d, list: items.filter((a) => zonedParts(new Date(a.starts_at), tz).date === d) }))
  return (
    <div className="flex flex-col gap-4 md:hidden">
      {items.length === 0 && <p className="m-0 text-ui text-ink-muted">No hay citas esta semana.</p>}
      {byDay
        .filter((x) => x.list.length > 0)
        .map(({ d, list }) => (
          <section key={d} aria-label={dayLabel(d)} className="flex flex-col gap-2">
            <h3 className="m-0 text-ui font-semibold">{dayLabel(d)}</h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {list.map((a) => (
                <li key={a.id}>
                  <ItemButton a={a} tz={tz} selected={a.id === selectedId} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

function ItemButton({ a, tz, selected, onSelect }: { a: AgendaItem; tz: string; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(a.id)}
      aria-current={selected ? 'true' : undefined}
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
  )
}
