import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signupRedirectUrl } from '@/lib/authRedirects'
import { isOffline, maskEmail, OTP_RESEND_SECONDS, otpErrorKind } from '@/lib/otp'
import { emailOnlySchema } from '@/lib/schemas'
import { supabase } from '@/lib/supabase'

type ResendResult = Promise<{ error: { message?: string | undefined; code?: string | undefined; status?: number | undefined; name?: string | undefined } | null }>
export type ResendConfirmationApi = (email: string) => ResendResult

const supabaseResend: ResendConfirmationApi = (email) =>
  supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: signupRedirectUrl() } })

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

type Notice = { title: string; message: string }

/**
 * Pide otro enlace de confirmación. El mensaje es siempre neutro: nunca revela si el
 * correo tiene cuenta. Una solicitud a la vez y 60 s entre envíos. Origen: core-base.
 */
export function ResendConfirmation({
  email: knownEmail,
  suggestedEmail,
  startCooling = false,
  api = supabaseResend,
}: {
  /** Correo ya conocido; sin él se muestra el campo para escribirlo. */
  email?: string
  /** Correo del registro guardado en este dispositivo: se muestra enmascarado. */
  suggestedEmail?: string | null
  /** Acaba de enviarse un correo: el botón espera antes de permitir otro. */
  startCooling?: boolean
  api?: ResendConfirmationApi
}) {
  const [typed, setTyped] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)
  const [cooldown, setCooldown] = useState(startCooling ? OTP_RESEND_SECONDS : 0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [useOther, setUseOther] = useState(false)
  const busy = useRef(false)
  const fixedEmail = knownEmail ?? (suggestedEmail && !useOther ? suggestedEmail : undefined)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  const send = async () => {
    if (busy.current || cooldown > 0) return
    setNotice(null)
    setSent(false)
    setFieldError(undefined)
    const parsed = emailOnlySchema.safeParse({ email: fixedEmail ?? typed })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Revisa tu correo.')
      return
    }
    if (isOffline()) {
      setNotice({ title: 'Sin conexión', message: 'Revisa tu conexión a internet y vuelve a intentarlo.' })
      return
    }
    busy.current = true
    setSending(true)
    let kind: ReturnType<typeof otpErrorKind> | null
    try {
      const { error } = await api(parsed.data.email.toLowerCase())
      kind = error ? otpErrorKind(error) : null
    } catch (e) {
      kind = otpErrorKind(e as { message?: string | undefined; name?: string | undefined })
      if (kind === 'other') kind = 'network'
    } finally {
      busy.current = false
      setSending(false)
    }
    if (kind === 'rate') {
      setNotice({ title: 'Demasiados intentos', message: 'Por seguridad, espera unos minutos y vuelve a intentarlo.' })
      return
    }
    if (kind === 'network') {
      setNotice({ title: 'No se pudo conectar', message: 'El servidor no respondió. Revisa tu conexión y vuelve a intentarlo.' })
      return
    }
    // Enviado, sin registro pendiente o falla de entrega: misma respuesta (anti-enumeración).
    setSent(true)
    setCooldown(OTP_RESEND_SECONDS)
  }

  return (
    <div className="flex flex-col gap-3" data-resend-confirmation>
      {notice && (
        <Alert tone="error" title={notice.title}>
          {notice.message}
        </Alert>
      )}
      {sent && !notice && (
        <Alert tone="success">
          Si el correo tiene un registro pendiente, te enviamos un enlace nuevo. Usa el más reciente y ábrelo en este dispositivo.
        </Alert>
      )}
      {knownEmail === undefined && fixedEmail !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-surface px-3 py-2 text-ui text-ink" data-resend-suggested>
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Lo enviamos a <strong className="font-semibold">{maskEmail(fixedEmail)}</strong>, el correo con el que te registraste en este
            dispositivo.
          </span>
          <button
            type="button"
            className="min-h-11 font-semibold text-violet"
            onClick={() => {
              setUseOther(true)
              setSent(false)
              setNotice(null)
              setFieldError(undefined)
            }}
          >
            Usar otro correo
          </button>
        </div>
      )}
      {fixedEmail === undefined && (
        <Input
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          value={typed}
          error={fieldError}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void send()
            }
          }}
        />
      )}
      {fixedEmail !== undefined && fieldError && (
        <p role="alert" className="m-0 text-caption text-error">
          {fieldError}
        </p>
      )}
      <Button variant="secondary" block size="lg" loading={sending} disabled={cooldown > 0} onClick={() => void send()}>
        {sending ? 'Enviando…' : cooldown > 0 ? `Reenviar confirmación en ${clock(cooldown)}` : 'Reenviar confirmación'}
      </Button>
    </div>
  )
}
