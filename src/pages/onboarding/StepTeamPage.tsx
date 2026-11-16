import { useState } from 'react'
import { InviteForm } from '@/components/team/InviteForm'
import type { Notice } from '@/components/team/notice'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useWorkspace } from '@/workspace/workspace-context'
import { OnboardingLayout } from './OnboardingLayout'
import { StepFooter } from './StepFooter'
import { useStep } from './useStep'

/** P04 paso 3: tu equipo (mismo formulario que Configuración › Tu equipo). */
export function StepTeamPage() {
  const { tenantId, canEdit, done, greeting, back, complete } = useStep(2)
  const { branches } = useWorkspace()
  const [notices, setNotices] = useState<Notice[]>([])
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <OnboardingLayout
      current={2}
      greeting={greeting}
      done={done}
      linked
      title="Invita a tu equipo"
      description="Cada quien entra con su cuenta. Los doctores ven solo sus pacientes y sus comisiones; recepción, la agenda y los cobros."
    >
      {canEdit && <InviteForm tenantId={tenantId} branches={branches} onDone={(n) => setNotices((ns) => [n, ...ns])} />}
      {notices.map((n, i) => (
        <Alert key={i} tone={n.tone}>
          {n.text}
        </Alert>
      ))}
      <p className="m-0 text-caption text-ink-muted">¿Trabajas sin equipo? Continúa: puedes invitar después desde Configuración.</p>
      {error && <Alert tone="error">No pudimos guardar tu avance. Vuelve a intentarlo.</Alert>}
      <StepFooter back={back}>
        <Button
          size="lg"
          loading={busy}
          disabled={!canEdit}
          onClick={() => {
            setBusy(true)
            setError(false)
            void complete().catch(() => {
              setError(true)
              setBusy(false)
            })
          }}
        >
          Continuar
        </Button>
      </StepFooter>
    </OnboardingLayout>
  )
}
