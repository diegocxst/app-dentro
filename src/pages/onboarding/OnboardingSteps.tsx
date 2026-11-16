import { Link } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { GuideTaskId } from '@/lib/onboarding'
import { ONBOARDING_STEPS } from '@/lib/onboarding-steps'

type Props = { current: number; done?: ReadonlySet<GuideTaskId> | undefined; linked?: boolean }

/** Los 5 pasos del onboarding (P04): hechos con palomita turquesa, el actual resaltado. */
export function OnboardingSteps({ current, done = new Set<GuideTaskId>(), linked = false }: Props) {
  return (
    <ol aria-label="Pasos" className="m-0 flex list-none flex-col gap-1 p-0">
      {ONBOARDING_STEPS.map((step, i) => {
        const on = i === current
        const isDone = done.has(step.task) && !on
        const body = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-pill border text-caption font-bold',
                on && 'border-violet-electric bg-violet-electric text-on-night',
                isDone && 'border-turquoise bg-turquoise text-[#1E1240]',
                !on && !isDone && 'border-on-night-muted text-on-night',
              )}
            >
              {isDone ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className={cn('text-ui font-semibold', on || isDone ? 'text-on-night' : 'text-on-night-muted')}>
                {step.label}
                {isDone && <span className="sr-only"> (listo)</span>}
              </span>
              <span className="text-label font-normal text-on-night-muted">{step.hint}</span>
            </span>
          </>
        )
        const cls = cn('flex min-h-13 items-center gap-3.5 rounded-md px-3 no-underline', on && 'bg-night-active')
        return (
          <li key={step.task} aria-current={on ? 'step' : undefined}>
            {linked && !on ? (
              <Link to={step.path} className={cn(cls, 'hover:bg-night-raised')}>
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
