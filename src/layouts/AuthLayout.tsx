import { BrandLogo } from '@/brand/BrandLogo'
import type { ReactNode } from 'react'

type AuthLayoutProps = {
  title: string
  subtitle?: ReactNode
  footer?: ReactNode
  children?: ReactNode
}

/**
 * Pantallas de acceso (P01–P03, P05). Escritorio: panel `night` con la promesa de
 * marca a la izquierda y el formulario a la derecha. Móvil: solo el formulario.
 */
export function AuthLayout({ title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh bg-surface text-ink">
      <aside className="hidden w-[min(44%,560px)] shrink-0 flex-col justify-between bg-night p-12 text-on-night lg:flex">
        <BrandLogo variant="negative" width={160} />
        <div className="flex flex-col gap-4">
          <p className="m-0 font-display text-display text-on-night">Tu clínica, por dentro.</p>
          <p className="m-0 max-w-md text-body text-on-night-muted">
            Que ningún presupuesto se pierda y ningún paciente se olvide. Leads, pacientes, agenda, presupuestos y cobros en un
            solo lugar.
          </p>
        </div>
        <p className="m-0 text-label font-normal text-on-night-muted">Hecho en México para clínicas dentales.</p>
      </aside>

      <main className="flex grow flex-col items-center justify-center px-4 py-10 md:px-8">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="lg:hidden">
            <BrandLogo width={128} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[24px] leading-8 font-bold md:text-title">{title}</h1>
            {subtitle && <p className="m-0 text-ui text-ink-muted">{subtitle}</p>}
          </div>
          <div className="rounded-lg border border-border bg-surface-raised p-5 md:p-6">{children}</div>
          {footer && <p className="m-0 text-center text-ui text-ink-muted">{footer}</p>}
        </div>
      </main>
    </div>
  )
}
