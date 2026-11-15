import { cn } from '@/lib/cn'

const STEPS = [
  ['Identidad de tu clínica', 'Nombre, logo y color de marca'],
  ['Sucursales y sillones', 'Dónde y con qué atiendes'],
  ['Tu equipo', 'Invita doctores y recepción'],
  ['Tratamientos y precios', 'Catálogo para presupuestos'],
  ['Conecta WhatsApp y Meta', 'Para recibir leads'],
] as const

/** Los 5 pasos del onboarding (P04). Por ahora solo el 1 está disponible; el resto llega en E2. */
export function OnboardingSteps({ current }: { current: number }) {
  return (
    <ol aria-label="Pasos" className="m-0 flex list-none flex-col gap-1 p-0">
      {STEPS.map(([label, hint], i) => {
        const on = i === current
        return (
          <li key={label} aria-current={on ? 'step' : undefined} className={cn('flex min-h-13 items-center gap-3.5 rounded-md px-3', on && 'bg-night-active')}>
            <span
              aria-hidden="true"
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-pill border text-caption font-bold text-on-night',
                on ? 'border-violet-electric bg-violet-electric' : 'border-on-night-muted',
              )}
            >
              {i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className={cn('text-ui font-semibold', on ? 'text-on-night' : 'text-on-night-muted')}>{label}</span>
              <span className="text-label font-normal text-on-night-muted">{hint}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
