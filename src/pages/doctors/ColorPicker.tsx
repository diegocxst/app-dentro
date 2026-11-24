import { cn } from '@/lib/cn'
import { DOCTOR_COLORS, type DoctorColor } from '@/lib/doctors'

/** Color del doctor en la agenda (tokens del sistema «dentro»). */
export function ColorPicker({ value, onChange }: { value: DoctorColor | null; onChange: (c: DoctorColor | null) => void }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-ui font-medium text-ink">Color en la agenda</legend>
      <div className="flex flex-wrap gap-2">
        {[{ value: null, label: 'Automático', className: 'bg-surface' }, ...DOCTOR_COLORS].map((c) => {
          const on = value === c.value
          return (
            <label
              key={c.label}
              className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border px-3 text-ui', on ? 'border-violet bg-lavender font-semibold' : 'border-border')}
            >
              <input type="radio" name="doctor-color" className="sr-only" checked={on} onChange={() => onChange(c.value)} />
              <span aria-hidden="true" className={cn('size-4 rounded-pill border border-border', c.className)} />
              {c.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
