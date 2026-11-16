import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { DAYS, hoursProblem, MAX_RANGES, summarizeHours, type DayId, type OpeningHours, type Range } from '@/lib/hours'

const timeCls =
  'h-10 w-28 rounded-sm border border-border bg-surface-raised px-2 text-ui text-ink tabular focus:outline-2 focus:outline-violet disabled:opacity-60'

type Props = {
  branchName: string
  initial: OpeningHours
  canEdit: boolean
  onSave: (hours: OpeningHours) => Promise<void>
}

/** Horario de atención de una sucursal: por día, abierto o cerrado, con hasta 3 horarios. */
export function HoursEditor({ branchName, initial, canEdit, onSave }: Props) {
  const [hours, setHours] = useState<OpeningHours>(initial)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const setDay = (day: DayId, ranges: Range[] | undefined) => {
    setError(null)
    setHours((h) => {
      const next = { ...h }
      if (ranges && ranges.length) next[day] = ranges
      else delete next[day]
      return next
    })
  }

  const save = async () => {
    const problem = hoursProblem(hours)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    try {
      await onSave(hours)
      setOpen(false)
    } catch {
      setError('No pudimos guardar el horario. Vuelve a intentarlo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ui font-medium">Horario de atención</span>
        <span className="text-caption text-ink-muted">{summarizeHours(open ? hours : initial)}</span>
        {canEdit && !open && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Editar horario
          </Button>
        )}
      </div>
      {open && (
        <fieldset className="m-0 flex flex-col gap-1 rounded-md border border-border p-3">
          <legend className="px-1 text-caption text-ink-muted">Horario de {branchName}</legend>
          {DAYS.map((d) => {
            const ranges = hours[d.id] ?? []
            const isOpen = ranges.length > 0
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
                <label className="flex w-36 items-center gap-2 text-ui">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => setDay(d.id, e.target.checked ? [['09:00', '18:00']] : undefined)}
                    className="size-5 accent-violet"
                  />
                  {d.label}
                </label>
                {!isOpen && <span className="text-caption text-ink-muted">Cerrado</span>}
                {ranges.map((r, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <input
                      type="time"
                      aria-label={`${d.label}, abre (horario ${i + 1})`}
                      value={r[0]}
                      onChange={(e) => setDay(d.id, ranges.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))}
                      className={timeCls}
                    />
                    <span aria-hidden="true">–</span>
                    <input
                      type="time"
                      aria-label={`${d.label}, cierra (horario ${i + 1})`}
                      value={r[1]}
                      onChange={(e) => setDay(d.id, ranges.map((x, j) => (j === i ? [x[0], e.target.value] : x)))}
                      className={timeCls}
                    />
                    {ranges.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Quitar horario ${i + 1} del ${d.label.toLowerCase()}`}
                        onClick={() => setDay(d.id, ranges.filter((_, j) => j !== i))}
                        className="flex size-8 items-center justify-center rounded-pill text-ink-muted hover:bg-lavender"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {isOpen && ranges.length < MAX_RANGES && (
                  <button
                    type="button"
                    onClick={() => setDay(d.id, [...ranges, [ranges[ranges.length - 1]![1], '20:00']])}
                    className={cn('min-h-10 px-2 text-caption font-semibold text-violet')}
                  >
                    + Otro horario
                  </button>
                )}
              </div>
            )
          })}
          {error && <Alert tone="error">{error}</Alert>}
          <div className="mt-2 flex gap-2">
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Guardar horario
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setHours(initial)
                setError(null)
                setOpen(false)
              }}
            >
              Cancelar
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  )
}
