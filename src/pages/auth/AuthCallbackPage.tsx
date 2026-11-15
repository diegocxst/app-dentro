import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { safeNextPath } from '@/auth/safeNextPath'
import { EmailLinkPrompt } from '@/components/auth/EmailLinkPrompt'
import { ResendConfirmation } from '@/components/auth/ResendConfirmation'
import { buttonClasses } from '@/components/ui/button-styles'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useEmailLink } from '@/lib/emailLink'
import { readPendingSignup } from '@/lib/pendingSignup'
import { useCodeExchange } from '@/lib/pkceExchange'
import { linkClass } from './links'

/** Destino del enlace de confirmación de correo (token_hash o PKCE). Origen: core-base. */
export function AuthCallbackPage() {
  const { user, loading } = useAuth()
  // Primero, para retirar el token del fragmento antes de leer nada más de la URL.
  const emailLink = useEmailLink('email')
  const [params] = useState(() => new URLSearchParams(window.location.search))
  const [hashParams] = useState(() => new URLSearchParams(window.location.hash.replace(/^#/, '')))
  const [pendingEmail] = useState(() => readPendingSignup())
  const [waited, setWaited] = useState(false)
  const hasError = [params, hashParams].some((p) => Boolean(p.get('error') || p.get('error_code')))
  const exchange = useCodeExchange()
  const next = safeNextPath(params.get('next'))

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 4000)
    return () => window.clearTimeout(t)
  }, [])

  // token_hash: nunca se verifica al cargar; solo al tocar el botón.
  if (emailLink.present && emailLink.state !== 'invalid') {
    if (emailLink.state === 'ok') {
      if (!user) return <FullPageSpinner label="Confirmando tu cuenta…" />
      return <Navigate to={next} replace />
    }
    return (
      <EmailLinkPrompt
        title="Confirma tu correo"
        subtitle="Toca el botón para confirmar tu correo y entrar a dentro."
        actionLabel="Confirmar mi correo"
        state={emailLink.state}
        onConfirm={() => void emailLink.verify()}
        otherSession={Boolean(user)}
      />
    )
  }

  if (user && !emailLink.present) return <Navigate to={next} replace />

  // Supabase verificó el enlace pero no se pudo abrir la sesión (p. ej. el canje PKCE
  // vence a los 5 min). El correo pudo confirmarse o no: el mensaje no afirma nada.
  if (!emailLink.present && !hasError && exchange.state === 'failed') {
    return (
      <AuthLayout
        title="No pudimos abrir tu sesión"
        subtitle="Este enlace abre la sesión solo unos minutos y en el navegador donde te registraste. Es posible que tu correo ya esté confirmado: entra con tu contraseña."
      >
        <div className="flex flex-col gap-5" data-callback-view="session">
          <Link to="/ingresar" className={buttonClasses('primary', 'lg', undefined, true)}>
            Entrar
          </Link>
          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <p className="m-0 text-ui font-semibold">¿No puedes entrar porque falta confirmar tu correo?</p>
            <ResendConfirmation suggestedEmail={pendingEmail} />
          </div>
        </div>
      </AuthLayout>
    )
  }

  const settling = exchange.state === 'pending' || loading || !waited
  if (!emailLink.present && !hasError && settling) return <FullPageSpinner label="Confirmando tu cuenta…" />

  return (
    <AuthLayout
      title="No pudimos confirmar tu cuenta"
      subtitle="El enlace venció, ya se usó o se abrió en otro navegador. Si ya confirmaste tu correo, entra. Si no, pide un enlace nuevo y ábrelo en este dispositivo."
      footer={
        <Link to="/ingresar" className={linkClass}>
          Ir a entrar
        </Link>
      }
    >
      <div data-callback-view="link">
        <ResendConfirmation suggestedEmail={pendingEmail} />
      </div>
    </AuthLayout>
  )
}
