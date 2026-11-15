// Utilidades de envío de correos de Auth (reenvío de confirmación). Origen: core-base.
// El ingreso con código por correo (OTP) queda apagado hasta tener correo
// transaccional (D3); de core-base solo se porta lo que usa el reenvío.

type ErrorLike = { message?: string | undefined; code?: string | undefined; status?: number | undefined; name?: string | undefined } | null | undefined

/** Segundos entre reenvíos (Supabase: 60 s entre correos al mismo usuario). */
export const OTP_RESEND_SECONDS = 60

/** «carlos@example.test» → «c•••••@example.test» (solo para mostrar al propio usuario lo que escribió). */
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.trim().split('@')
  if (!domain) return email.trim()
  const visible = user.slice(0, 1)
  return `${visible}${'•'.repeat(Math.max(3, Math.min(user.length - 1, 6)))}@${domain}`
}

export type OtpErrorKind = 'rate' | 'network' | 'server' | 'other'

/** Clasifica errores de Supabase Auth sin revelar si una cuenta existe. */
export function otpErrorKind(error: ErrorLike): OtpErrorKind {
  const code = error?.code ?? ''
  const msg = (error?.message ?? '').toLowerCase()
  if (error?.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || msg.includes('rate limit')) return 'rate'
  if (typeof error?.status === 'number' && error.status >= 500) return 'server'
  if (error?.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) return 'network'
  return 'other'
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
