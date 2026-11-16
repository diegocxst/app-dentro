import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { setTenantWhatsapp } from '@/data/catalog'
import { rpcErrorMessage } from '@/lib/errors'
import { formatPhone, normalizePhone } from '@/lib/phone'
import { OnboardingLayout } from './OnboardingLayout'
import { StepFooter } from './StepFooter'
import { useStep } from './useStep'

/** P04 paso 5: WhatsApp de la clínica. Meta (M11) llega en E6: aquí solo se explica. */
export function StepWhatsappPage() {
  const { tenantId, tenant, canEdit, done, greeting, back, complete } = useStep(4)
  const [phone, setPhone] = useState(tenant?.whatsapp_e164 ? formatPhone(tenant.whatsapp_e164) : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const e164 = normalizePhone(phone)
    if (!e164) {
      setError('Escribe 10 dígitos (México) o el número con +lada internacional.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (e164 !== tenant?.whatsapp_e164) await setTenantWhatsapp(tenantId, e164)
      await complete()
    } catch (err) {
      setError(rpcErrorMessage(err as { code?: string }, { invalid: 'Revisa el número de WhatsApp.' }))
      setBusy(false)
    }
  }

  return (
    <OnboardingLayout
      current={4}
      greeting={greeting}
      done={done}
      linked
      title="Conecta tu WhatsApp"
      description="Lo usamos para que tus pacientes te escriban y para enviar recordatorios y presupuestos desde dentro."
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-6">
        <Card className="flex max-w-120 flex-col gap-3">
          <Input
            label="WhatsApp de la clínica"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="55 1234 5678"
            value={phone}
            disabled={!canEdit}
            error={error ?? undefined}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="m-0 text-caption text-ink-muted">Por ahora los mensajes se abren en tu WhatsApp para que tú los envíes.</p>
        </Card>
        <Card className="flex max-w-120 flex-col gap-1">
          <span className="text-ui font-semibold">Leads de Facebook e Instagram</span>
          <span className="text-caption text-ink-muted">Muy pronto podrás conectar tus anuncios de Meta para que los interesados lleguen solos a Leads.</span>
        </Card>
        <StepFooter back={back}>
          <Button type="submit" size="lg" loading={busy} disabled={!canEdit}>
            Terminar
          </Button>
        </StepFooter>
      </form>
    </OnboardingLayout>
  )
}
