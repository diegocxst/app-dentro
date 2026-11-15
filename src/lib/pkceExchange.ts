// Canje del código PKCE de los enlaces de correo. Origen: core-base (Realt-In).
// supabase-js canjea `?code=` al iniciar; aquí solo se lee el RESULTADO REAL de ese
// canje (supabase.auth.initialize() devuelve su error). Nunca se deduce nada de la URL
// sola: tener `code` no prueba que la cuenta exista ni que esté confirmada.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type ExchangeState =
  /** La URL no trae código: no hay canje que esperar. */
  | 'none'
  | 'pending'
  | 'ok'
  /** Supabase rechazó el canje o no se pudo hacer (flujo vencido, clave ausente o distinta, red). */
  | 'failed'

type ErrorLike = { name?: string | undefined; code?: string | undefined; status?: number | undefined } | null | undefined

/** Errores del canje PKCE que conocemos (Supabase Auth, token.go; supabase-js). */
export const PKCE_ERROR_CODES = ['flow_state_expired', 'flow_state_not_found', 'bad_code_verifier', 'validation_failed'] as const

/** Solo para diagnóstico y pruebas: qué falló, sin datos de la cuenta. */
export function pkceFailureKind(error: ErrorLike): 'expired' | 'verifier' | 'not_found' | 'network' | 'no_session' | 'other' {
  if (!error) return 'other'
  if (error.code === 'flow_state_expired') return 'expired'
  if (error.code === 'bad_code_verifier' || error.name === 'AuthPKCECodeVerifierMissingError') return 'verifier'
  if (error.code === 'flow_state_not_found') return 'not_found'
  if (error.name === 'AuthRetryableFetchError') return 'network'
  return 'other'
}

export function urlHasAuthCode(search = window.location.search): boolean {
  return Boolean(new URLSearchParams(search).get('code'))
}

/**
 * Resultado del canje del enlace actual. Con `code` en la URL espera a que
 * supabase-js termine de iniciar y devuelve 'ok' o 'failed' según su respuesta.
 */
export function useCodeExchange(): { state: ExchangeState; kind: ReturnType<typeof pkceFailureKind> | null } {
  const [hasCode] = useState(() => urlHasAuthCode())
  const [result, setResult] = useState<{ state: ExchangeState; kind: ReturnType<typeof pkceFailureKind> | null }>(() => ({
    state: hasCode ? 'pending' : 'none',
    kind: null,
  }))

  useEffect(() => {
    if (!hasCode) return
    let active = true
    const init = supabase.auth.initialize
    if (typeof init !== 'function') return
    init
      .call(supabase.auth)
      .then(async ({ error }) => {
        if (error) {
          if (active) setResult({ state: 'failed', kind: pkceFailureKind(error) })
          return
        }
        // Sin la clave PKCE en este navegador (se cerró sesión, otro navegador u otro
        // dispositivo), supabase-js ni siquiera intenta el canje: termina sin error y SIN
        // sesión. Se decide por la sesión real, no por la URL.
        const { data } = await supabase.auth.getSession()
        if (active) setResult(data.session ? { state: 'ok', kind: null } : { state: 'failed', kind: 'no_session' })
      })
      .catch((e: unknown) => {
        if (active) setResult({ state: 'failed', kind: pkceFailureKind(e as ErrorLike) })
      })
    return () => {
      active = false
    }
  }, [hasCode])

  return result
}
