// Errores de Supabase traducidos a español, sin revelar si una cuenta existe
// (anti-enumeración) ni detalles técnicos. Origen: core-base (Realt-In).

type ErrorLike = { message?: string | undefined; code?: string | undefined; status?: number | undefined; name?: string | undefined } | null | undefined

const GENERIC = 'Ocurrió un problema. Inténtalo de nuevo en unos minutos.'

export function authErrorMessage(error: ErrorLike): string {
  if (!error) return GENERIC
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()

  if (error.status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || msg.includes('rate limit')) {
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.'
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada y la carpeta de spam.'
  }
  if (code === 'weak_password' || msg.includes('password should')) {
    return 'La contraseña no es lo bastante segura. Usa una más larga o variada.'
  }
  if (code === 'same_password') {
    return 'La nueva contraseña debe ser distinta de la actual.'
  }
  if (code === 'email_address_invalid' || msg.includes('invalid format') || (msg.includes('email address') && msg.includes('invalid'))) {
    return 'Revisa que el correo esté bien escrito.'
  }
  if (code === 'email_address_not_authorized' || msg.includes('not authorized')) {
    return 'Por ahora no podemos enviar correos a esa dirección. Escríbenos a soporte.'
  }
  if (code === 'signup_disabled') {
    return 'El registro de cuentas está cerrado por ahora.'
  }
  if (code === 'session_expired' || code === 'refresh_token_not_found' || msg.includes('jwt expired')) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  }
  if (error.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network')) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión a internet.'
  }
  return GENERIC
}
