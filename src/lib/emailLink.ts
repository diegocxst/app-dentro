// Enlaces de correo con `token_hash` verificados por la app. Origen: core-base (Realt-In, R4A).
// Formato que generan las plantillas: `{{ .RedirectTo }}#token_hash=…&type=email|recovery`.
// Invitaciones con la plantilla POR OMISIÓN de Supabase (sin SMTP propio, B4): el enlace
// pasa por /auth/v1/verify y vuelve con la sesión en el fragmento
// (`#access_token=…&refresh_token=…&type=invite`). Se acepta solo para `invite`.
//
// Reglas de seguridad:
//  - El token viaja en el fragmento (#): no llega al servidor ni al Referer.
//  - Se captura UNA vez y se retira de la barra de direcciones de inmediato.
//  - Vive solo en memoria de este módulo: nunca en localStorage, sessionStorage,
//    cookies, la consola, el DOM ni las métricas.
//  - Nunca se verifica al cargar: solo cuando el usuario toca el botón.
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type EmailLinkType = 'email' | 'recovery' | 'invite'

/** Lo que trae la URL: nada, un enlace con formato válido o uno que no sirve. */
export type CapturedLink =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'token'; tokenHash: string; type: EmailLinkType }
  /** Invitación con la plantilla por omisión: Supabase ya verificó y entregó la sesión. */
  | { kind: 'session'; accessToken: string; refreshToken: string }

/** Forma del token: el hash de Supabase (hex) con prefijo opcional; nada de espacios ni símbolos. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,256}$/
/** JWT (tres partes base64url) y refresh token de Supabase. */
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const REFRESH_RE = /^[A-Za-z0-9_-]{8,256}$/

let captured: { path: string; link: CapturedLink } | null = null

/**
 * Lee `token_hash` y `type` del fragmento de la URL actual, lo retira de la barra
 * de direcciones y lo guarda en memoria. Idempotente para la misma ruta (React
 * StrictMode ejecuta dos veces la inicialización del estado).
 */
export function captureEmailLink(expected: EmailLinkType, loc: Location = window.location): CapturedLink {
  if (captured && captured.path === loc.pathname) return captured.link
  const params = new URLSearchParams(loc.hash.replace(/^#/, ''))
  const tokenHash = params.get('token_hash')
  const accessToken = params.get('access_token')
  if (tokenHash === null && accessToken !== null && expected === 'invite') {
    window.history.replaceState(window.history.state, '', loc.pathname + loc.search)
    const refreshToken = params.get('refresh_token') ?? ''
    const link: CapturedLink =
      params.get('type') === 'invite' && accessToken.length <= 4096 && JWT_RE.test(accessToken) && REFRESH_RE.test(refreshToken)
        ? { kind: 'session', accessToken, refreshToken }
        : { kind: 'invalid' }
    captured = { path: loc.pathname, link }
    return link
  }
  if (tokenHash === null) return { kind: 'none' }
  // Hay un token en la URL: se retira SIEMPRE, sea válido o no, sin tocar ruta ni consulta.
  window.history.replaceState(window.history.state, '', loc.pathname + loc.search)
  const type = params.get('type')
  const link: CapturedLink = TOKEN_RE.test(tokenHash) && type === expected ? { kind: 'token', tokenHash, type } : { kind: 'invalid' }
  captured = { path: loc.pathname, link }
  return link
}

/** Recarga de la página (sustituible en pruebas: jsdom no implementa location.reload). */
export const emailLinkEnv = { reload: () => window.location.reload() }

/** Olvida el token en memoria (tras usarlo o al fallar de forma definitiva). */
export function forgetEmailLink(): void {
  captured = null
}

export type VerifyOutcome =
  | 'ok'
  /** Vencido, ya usado, inválido o rechazado (403 otp_expired, 400…): mismo trato para todos. */
  | 'invalid'
  | 'rate'
  /** Sin red o error del servidor: se puede reintentar con el mismo enlace. */
  | 'retry'

type ErrorLike = { name?: string | undefined; status?: number | undefined; code?: string | undefined; message?: string | undefined } | null | undefined

export function classifyVerifyError(error: ErrorLike): Exclude<VerifyOutcome, 'ok'> {
  const code = error?.code ?? ''
  if (error?.status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return 'rate'
  if (error?.name === 'AuthRetryableFetchError' || (typeof error?.status === 'number' && error.status >= 500)) return 'retry'
  if (error?.name === 'TypeError') return 'retry' // fetch sin respuesta
  return 'invalid'
}

/** `POST /auth/v1/verify` con `{ token_hash, type }`: sin flujo PKCE, devuelve la sesión. */
export async function verifyEmailLink(tokenHash: string, type: EmailLinkType): Promise<VerifyOutcome> {
  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    return error ? classifyVerifyError(error) : 'ok'
  } catch (e) {
    return classifyVerifyError(e as ErrorLike)
  }
}

/** Abre la sesión que Supabase entregó en el enlace (la valida con el servidor). */
export async function adoptInviteSession(accessToken: string, refreshToken: string): Promise<VerifyOutcome> {
  try {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    return error ? classifyVerifyError(error) : 'ok'
  } catch (e) {
    return classifyVerifyError(e as ErrorLike)
  }
}

export type EmailLinkState = 'idle' | 'verifying' | VerifyOutcome

/**
 * Estado del enlace de la página actual. `present` indica que la URL traía
 * `token_hash` (válido o no). `verify()` solo se ejecuta por acción del usuario
 * y una vez a la vez.
 */
export function useEmailLink(type: EmailLinkType): { present: boolean; state: EmailLinkState; verify: () => Promise<void> } {
  const [link] = useState(() => captureEmailLink(type))
  const [state, setState] = useState<EmailLinkState>(link.kind === 'invalid' ? 'invalid' : 'idle')
  const busy = useRef(false)

  // Al salir de la pantalla se olvida el token de la memoria del módulo. El estado del
  // componente lo conserva mientras está montado (también en el doble montaje de StrictMode).
  useEffect(() => () => forgetEmailLink(), [])

  // Un enlace nuevo pegado en la misma pestaña solo cambia el «#»: el navegador no recarga
  // y la pantalla seguiría con el estado anterior. Si el nuevo fragmento trae token_hash,
  // se recarga para capturarlo (y retirarlo de la URL) como en cualquier apertura.
  useEffect(() => {
    const onHash = () => {
      const p = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      if (p.has('token_hash') || (type === 'invite' && p.has('access_token'))) {
        forgetEmailLink()
        emailLinkEnv.reload()
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [type])

  const verify = async () => {
    if (busy.current || (link.kind !== 'token' && link.kind !== 'session')) return
    busy.current = true
    setState('verifying')
    const outcome = link.kind === 'session' ? await adoptInviteSession(link.accessToken, link.refreshToken) : await verifyEmailLink(link.tokenHash, link.type)
    busy.current = false
    if (outcome === 'ok' || outcome === 'invalid') forgetEmailLink()
    setState(outcome)
  }

  return { present: link.kind !== 'none', state, verify }
}
