import { doctorColorClass } from '@/lib/doctors'
import type { AgendaItem } from '@/data/agenda'
import { hoursFor, longDayLabel, zonedParts, type Hours } from '@/lib/agenda'
import { cn } from '@/lib/cn'

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

type Props = {
  days: string[]
  month: string
  today: string
  items: AgendaItem[]
  doctors: { id: string; name: string; color?: string | null }[]
  hours: Hours | null
  tz: string
  onDay: (date: string) => void
}

/** Vista Mes: cuántas citas hay cada día y un punto por doctor; al tocar un día se abre la vista Día. */
export function MonthView({ days, month, today, items, doctors, hours, tz, onDay }: Props) {
  const dotOf = (doctorId: string) => {
    const i = Math.max(0, doctors.findIndex((d) => d.id === doctorId))
    return doctorColorClass(doctors[i]?.color, i)
  }
  const byDay = new Map<string, AgendaItem[]>()
  for (const a of items) {
    const d = zonedParts(new Date(a.starts_at), tz).date
    byDay.set(d, [...(byDay.get(d) ?? []), a])
  }
  const withAppointments = doctors.filter((d) => items.some((a) => a.doctor_id === d.id))

  return (
    <div className="flex flex-col gap-3">
      <div role="grid" aria-label="Mes" className="overflow-hidden rounded-lg border border-border bg-surface-raised">
        <div role="row" className="grid grid-cols-7 border-b border-border bg-surface">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" className="py-2 text-center text-caption font-semibold text-ink-muted">
              {w}
            </span>
          ))}
        </div>
        {Array.from({ length: days.length / 7 }, (_, week) => (
          <div key={week} role="row" className="grid grid-cols-7 border-b border-border last:border-b-0">
            {days.slice(week * 7, week * 7 + 7).map((d) => {
              const list = byDay.get(d) ?? []
              const inMonth = d.slice(0, 7) === month.slice(0, 7)
              const closed = hoursFor(hours, d).length === 0
              const doctorIds = [...new Set(list.map((a) => a.doctor_id))]
              const count = list.length === 1 ? '1 cita' : `${list.length} citas`
              return (
                <div key={d} role="gridcell" className="border-r border-border last:border-r-0">
                  <button
                    type="button"
                    onClick={() => onDay(d)}
                    aria-label={`${longDayLabel(d)}: ${list.length ? count : 'sin citas'}${closed ? ' · la sucursal no abre' : ''}`}
                    aria-current={d === today ? 'date' : undefined}
                    className={cn(
                      'flex h-full min-h-16 w-full flex-col items-start gap-1 p-1.5 text-left hover:bg-lavender md:min-h-24 md:p-2',
                      !inMonth && 'opacity-45',
                      closed && 'bg-surface',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-pill text-caption font-semibold tabular',
                        d === today ? 'bg-violet text-on-violet' : 'text-ink',
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {list.length > 0 && (
                      <>
                        <span className="text-micro font-semibold text-ink md:text-caption">
                          <span className="md:hidden">{list.length}</span>
                          <span className="hidden md:inline">{count}</span>
                        </span>
                        <span aria-hidden="true" className="flex flex-wrap gap-0.5">
                          {doctorIds.slice(0, 4).map((id) => (
                            <span key={id} className={cn('size-2 rounded-pill', dotOf(id))} />
                          ))}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {withAppointments.length > 0 && (
        <ul aria-label="Doctores" className="m-0 flex list-none flex-wrap gap-3 p-0 text-caption text-ink-muted">
          {withAppointments.map((d) => (
            <li key={d.id} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('size-2.5 rounded-pill', dotOf(d.id))} />
              {d.name || 'Sin nombre'}
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-caption text-ink-muted">Toca un día para ver sus citas.</p>
    </div>
  )
}
