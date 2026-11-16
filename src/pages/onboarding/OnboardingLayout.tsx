import type { ReactNode } from 'react'
import { BrandLogo } from '@/brand/BrandLogo'
import { SignOutButton } from '@/components/layout/SignOutButton'
import type { GuideTaskId } from '@/lib/onboarding'
import { ONBOARDING_STEPS } from '@/lib/onboarding-steps'
import { OnboardingSteps } from './OnboardingSteps'

type Props = {
  current: number
  greeting: string
  done?: ReadonlySet<GuideTaskId> | undefined
  /** Con la clínica creada, los pasos se pueden abrir desde la lista. */
  linked?: boolean
  title: string
  description: string
  children: ReactNode
}

/** Marco del onboarding (P04): pasos en `night` a la izquierda y el paso actual a la derecha. */
export function OnboardingLayout({ current, greeting, done, linked = false, title, description, children }: Props) {
  const total = ONBOARDING_STEPS.length
  return (
    <div className="flex min-h-dvh flex-wrap bg-surface text-ink">
      <aside className="flex flex-[1_1_320px] flex-col gap-8 bg-night px-6 py-8 text-on-night md:gap-10 md:px-8 md:py-10">
        <BrandLogo variant="negative" width={140} />
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-title text-on-night">{greeting}</h1>
          <p className="m-0 text-body text-on-night-muted">Vamos a dejar tu clínica lista en 5 pasos. Puedes pausar cuando quieras: guardamos tu avance.</p>
        </div>
        <div className="hidden md:block">
          <OnboardingSteps current={current} done={done} linked={linked} />
        </div>
        <div className="grow" />
        <SignOutButton tone="night" className="self-start" />
      </aside>

      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 px-4 py-8 md:p-12">
        <div className="flex max-w-250 flex-col gap-2.5">
          <span className="text-label tracking-[0.06em] text-violet uppercase">
            Paso {current + 1} de {total}
          </span>
          <div
            role="progressbar"
            aria-label="Avance del onboarding"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={current + 1}
            className="h-1.5 overflow-hidden rounded-pill bg-lavender"
          >
            <div className="h-1.5 rounded-pill bg-violet" style={{ width: `${((current + 1) / total) * 100}%` }} />
          </div>
          <h2 className="mt-2 mb-0 text-title">{title}</h2>
          <p className="m-0 text-body text-ink-muted">{description}</p>
        </div>
        <div className="flex max-w-250 flex-col gap-7">{children}</div>
      </main>
    </div>
  )
}
