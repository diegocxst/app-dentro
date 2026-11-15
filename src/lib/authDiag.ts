// Diagnóstico de Supabase Auth SOLO en desarrollo. Origen: core-base (Realt-In).
// Registra en la consola el método, la ruta de Auth sin consulta, el estado HTTP y el
// código de error. Nunca el correo, contraseñas, tokens, cuerpo, consulta ni encabezados.
// Se conecta en src/lib/supabase.ts detrás de `import.meta.env.DEV`: no llega a dist/.

const SAFE_CODE = /^[a-z0-9_]{1,64}$/

/** «/auth/v1/resend» de una URL; null si no es de Auth. Nunca devuelve la consulta. */
export function authPath(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = new URL(raw).pathname
    return path.startsWith('/auth/v1/') ? path : null
  } catch {
    return null
  }
}

/** Solo un código de error con forma de identificador (p. ej. `validation_failed`). */
export function safeErrorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  for (const v of [b.error_code, b.code]) if (typeof v === 'string' && SAFE_CODE.test(v)) return v
  return null
}

export function authDiagLine(method: string, path: string, status: number | 'sin respuesta', code: string | null): string {
  return `[auth-diag] ${method.toUpperCase()} ${path} → ${status}${code ? ` ${code}` : ''}`
}

/** Envuelve fetch: la respuesta llega intacta a supabase-js. */
export function withAuthDiag(base: typeof fetch, log: (line: string) => void = (l) => console.info(l)): typeof fetch {
  return async (input, init) => {
    const path = authPath(input)
    if (!path) return base(input, init)
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    let res: Response
    try {
      res = await base(input, init)
    } catch (e) {
      log(authDiagLine(method, path, 'sin respuesta', null))
      throw e
    }
    let code: string | null = null
    if (!res.ok) {
      try {
        code = safeErrorCode(await res.clone().json())
      } catch {
        code = null
      }
    }
    log(authDiagLine(method, path, res.status, code))
    return res
  }
}
