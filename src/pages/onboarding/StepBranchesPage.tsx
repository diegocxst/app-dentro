import { useState } from 'react'
import { BranchesEditor } from '@/components/catalog/BranchesEditor'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { OnboardingLayout } from './OnboardingLayout'
import { StepFooter } from './StepFooter'
import { useStep } from './useStep'

/** P04 paso 2: sucursales y sillones. */
export function StepBranchesPage() {
  const { tenantId, canEdit, done, greeting, back, complete } = useStep(1)
  const [chairs, setChairs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onContinue = async () => {
    if (chairs === 0) {
      setError('Agrega al menos un sillón para que la agenda sepa dónde atiendes.')
      return
    }
    setBusy(true)
    try {
      await complete()
    } catch {
      setError('No pudimos guardar tu avance. Vuelve a intentarlo.')
      setBusy(false)
    }
  }

  return (
    <OnboardingLayout
      current={1}
      greeting={greeting}
      done={done}
      linked
      title="¿Dónde atiendes?"
      description="Revisa tu sucursal y agrega tus sillones. La agenda los usa para que no se encimen las citas."
    >
      <BranchesEditor tenantId={tenantId} canEdit={canEdit} onChairsCount={setChairs} />
      {error && <Alert tone="error">{error}</Alert>}
      <StepFooter back={back}>
        <Button size="lg" loading={busy} disabled={!canEdit} onClick={() => void onContinue()}>
          Continuar
        </Button>
      </StepFooter>
    </OnboardingLayout>
  )
}
