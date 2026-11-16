import { useState } from 'react'
import { TreatmentsEditor } from '@/components/catalog/TreatmentsEditor'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { OnboardingLayout } from './OnboardingLayout'
import { StepFooter } from './StepFooter'
import { useStep } from './useStep'

/** P04 paso 4: tratamientos y precios (mockup Onboarding). */
export function StepTreatmentsPage() {
  const { tenantId, canEdit, done, greeting, back, complete } = useStep(3)
  const [error, setError] = useState<string | null>(null)

  return (
    <OnboardingLayout
      current={3}
      greeting={greeting}
      done={done}
      linked
      title="¿Qué tratamientos ofreces?"
      description="Marca los que haces y pon tus precios. Los usarás para armar presupuestos en segundos."
    >
      {error && <Alert tone="error">{error}</Alert>}
      <TreatmentsEditor
        tenantId={tenantId}
        canEdit={canEdit}
        submitLabel="Continuar"
        onSaved={(active) => {
          if (active === 0) {
            setError('Marca al menos un tratamiento con su precio para continuar.')
            return
          }
          setError(null)
          void complete().catch(() => setError('No pudimos guardar tu avance. Vuelve a intentarlo.'))
        }}
        footer={({ save, saving }) => (
          <StepFooter back={back}>
            <Button size="lg" loading={saving} onClick={save}>
              Continuar
            </Button>
          </StepFooter>
        )}
      />
    </OnboardingLayout>
  )
}
