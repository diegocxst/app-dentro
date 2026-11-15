import { useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { buttonClasses } from '@/components/ui/button-styles'
import { Icon } from '@/components/ui/Icon'
import { setGuideTask } from '@/data/onboarding'
import { cn } from '@/lib/cn'
import { guideDone, GUIDE_TASKS, GUIDE_TOTAL, minutesLeft, type GuideTaskId } from '@/lib/onboarding'
import { isManager } from '@/lib/roles'
import { useWorkspace } from '@/workspace/workspace-context'

/** Guía de inicio de 7 tareas (mockup Main-Bienvenida). La marcan propietario o administración. */
export function GuideCard() {
  const { active, refresh } = useWorkspace()
  const [busy, setBusy] = useState<GuideTaskId | null>(null)
  const [error, setError] = useState(false)
  if (!active) return null

  const done = guideDone(active.tenant.onboarding_state)
  const canEdit = isManager(active.role) && active.tenant.status === 'active'
  const pct = Math.round((done.size / GUIDE_TOTAL) * 100)
  const firstPending = GUIDE_TASKS.find((t) => !done.has(t.id))?.id

  const toggle = async (id: GuideTaskId) => {
    setBusy(id)
    setError(false)
    try {
      await setGuideTask(active.tenant_id, id, !done.has(id))
      await refresh()
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Guía de inicio" className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface-raised p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
          <h2 className="m-0 text-subtitle">Guía de inicio</h2>
          <span className="text-ui text-ink-muted">
            {done.size} de {GUIDE_TOTAL} listos
            {done.size < GUIDE_TOTAL ? ` · unos ${minutesLeft(done)} minutos para terminar` : ' · ¡tu clínica está lista!'}
          </span>
        </div>
        <span className="font-display text-[24px] font-bold text-violet tabular">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Avance de la guía"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-pill bg-lavender"
      >
        <div className="h-2 rounded-pill bg-violet transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {error && <Alert tone="error">No pudimos guardar el cambio. Vuelve a intentarlo.</Alert>}
      <ol className="m-0 flex list-none flex-col p-0">
        {GUIDE_TASKS.map((t) => {
          const isDone = done.has(t.id)
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-3.5 border-t border-border py-3.5">
              <button
                type="button"
                disabled={!canEdit || busy !== null}
                aria-label={(isDone ? 'Marcar como pendiente: ' : 'Marcar como listo: ') + t.title}
                aria-pressed={isDone}
                onClick={() => void toggle(t.id)}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-pill text-white disabled:cursor-default',
                  isDone ? 'bg-success' : 'border-2 border-border-strong bg-surface-raised',
                  busy === t.id && 'animate-pulse',
                )}
              >
                {isDone && <Icon name="check" size={16} strokeWidth={3} />}
              </button>
              <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                <span className={cn('text-[15px] font-semibold', isDone ? 'text-ink-muted' : 'text-ink')}>{t.title}</span>
                <span className="text-caption text-ink-muted">{t.why}</span>
              </div>
              <span className="text-label font-normal text-ink-muted">{t.minutes} min</span>
              {!isDone && (
                <Link to={t.path} className={buttonClasses(t.id === firstPending ? 'primary' : 'secondary', 'sm')}>
                  {t.cta}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
