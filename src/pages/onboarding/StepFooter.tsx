import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** Pie del onboarding: «Atrás», «Hacerlo después» y el botón principal del paso. */
export function StepFooter({ back, children }: { back: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
      <Link to={back} className="min-h-11 content-center text-ui font-semibold text-ink-muted hover:text-ink">
        Atrás
      </Link>
      <span className="grow" />
      <Link to="/" className="min-h-11 content-center text-ui font-semibold text-violet">
        Hacerlo después
      </Link>
      {children}
    </div>
  )
}
