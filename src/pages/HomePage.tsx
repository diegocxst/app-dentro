import { useState } from 'react'
import { useAuth } from '@/auth/auth-context'
import { GuideCard } from '@/components/onboarding/GuideCard'
import { TourDialog } from '@/components/onboarding/TourDialog'
import { markTourSeen } from '@/data/onboarding'
import { guideDone, GUIDE_TOTAL } from '@/lib/onboarding'
import { useWorkspace } from '@/workspace/workspace-context'
import { PageHeader } from './PageHeader'
import { SectionPage } from './SectionPage'

const EMPTY_KPIS = [
  { label: 'Cobrado este mes', hint: 'Aparece cuando registres tu primer pago.' },
  { label: 'Presupuestos por cerrar', hint: 'Crea un presupuesto y lo verás aquí.' },
  { label: 'Citas de hoy', hint: 'Agenda tu primera cita en Agenda.' },
  { label: 'Leads nuevos', hint: 'Conecta Meta o comparte tu perfil público.' },
] as const

/**
 * Inicio (P06). Mientras la guía no esté completa: primer uso (mockup Main-Bienvenida)
 * con la guía, el recorrido y «Tu negocio, por dentro» sin datos. Después: el tablero (E5).
 */
export function HomePage() {
  const { user } = useAuth()
  const { state, active } = useWorkspace()
  const tourSeen = Boolean((user?.user_metadata as Record<string, unknown> | undefined)?.tour_seen_at)
  const [tourOpen, setTourOpen] = useState(!tourSeen)

  const done = active ? guideDone(active.tenant.onboarding_state).size : GUIDE_TOTAL
  if (done >= GUIDE_TOTAL) return <SectionPage id="inicio" />

  const fullName = state.status === 'ready' ? (state.profile?.full_name ?? '') : ''
  const firstName = fullName.trim().split(/\s+/)[0] ?? ''

  const closeTour = () => {
    setTourOpen(false)
    if (!tourSeen) void markTourSeen().catch(() => undefined)
  }

  return (
    <>
      {tourOpen && <TourDialog onClose={closeTour} />}
      <PageHeader eyebrow="Tu primer día en dentro" title={`${firstName ? `Hola, ${firstName}. ` : ''}Terminemos de armar tu clínica.`} />
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-[2_1_520px]">
            <GuideCard />
          </div>
          <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-5">
            <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-5">
              <h2 className="m-0 mb-1.5 font-sans text-[15px] font-semibold">¿Tienes dudas?</h2>
              <button
                type="button"
                onClick={() => setTourOpen(true)}
                className="flex min-h-11 items-center gap-2.5 text-left text-ui text-ink hover:text-violet"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="text-violet">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4l3 2" />
                </svg>
                Repetir el recorrido
              </button>
            </section>
          </aside>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-subtitle">Tu negocio, por dentro</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {EMPTY_KPIS.map((k) => (
              <div key={k.label} className="flex flex-col gap-2 rounded-lg border border-dashed border-border-strong bg-surface-raised p-5">
                <span className="text-ui text-ink-muted">{k.label}</span>
                <span aria-label="Sin datos" className="font-display text-title text-border-strong">
                  —
                </span>
                <span className="text-caption text-ink-muted">{k.hint}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
