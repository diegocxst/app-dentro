import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { AuthLayout } from '@/layouts/AuthLayout'
import type { EmailLinkState } from '@/lib/emailLink'

/**
 * Pantalla intermedia de un enlace de correo. La verificación ocurre SOLO al tocar
 * el botón, para que un escáner de correo que abra el enlace no lo gaste.
 * Origen: core-base (Realt-In, R4A).
 */
export function EmailLinkPrompt({
  title,
  subtitle,
  actionLabel,
  state,
  onConfirm,
  otherSession = false,
}: {
  title: string
  subtitle: string
  actionLabel: string
  state: EmailLinkState
  onConfirm: () => void
  /** Ya hay una sesión abierta en este navegador: avisar antes de reemplazarla. */
  otherSession?: boolean
}) {
  const verifying = state === 'verifying'
  return (
    <AuthLayout title={title} subtitle={subtitle}>
      <div className="flex flex-col gap-4" data-email-link-prompt>
        {state === 'rate' && (
          <Alert tone="error" title="Demasiados intentos">
            Por seguridad, espera unos minutos y vuelve a intentarlo.
          </Alert>
        )}
        {state === 'retry' && (
          <Alert tone="error" title="No se pudo completar">
            Revisa tu conexión y vuelve a tocar el botón.
          </Alert>
        )}
        {otherSession && (
          <Alert tone="warning">Hay una sesión abierta en este navegador. Si continúas, se cierra y entras con la cuenta de este enlace.</Alert>
        )}
        <Button block size="lg" loading={verifying} onClick={onConfirm}>
          {verifying ? 'Verificando…' : actionLabel}
        </Button>
      </div>
    </AuthLayout>
  )
}
