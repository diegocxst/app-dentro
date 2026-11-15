// Correo de un registro pendiente de confirmar, SOLO en este dispositivo (S1, E-RC15).
// Sirve para precargarlo si el enlace de confirmación vence: el enlace ya exige abrirse
// en el mismo navegador (PKCE), así que no hace falta guardarlo en otro lado.
// Solo el correo y la fecha: nunca contraseñas, tokens ni datos de la cuenta.

const KEY = 'dentro.pendingSignup'
/** Caducidad máxima del dato guardado. */
export const PENDING_SIGNUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type Stored = { email: string; savedAt: number }

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null // Safari con almacenamiento bloqueado
  }
}

export function savePendingSignup(email: string, now = Date.now()): void {
  const clean = email.trim().toLowerCase()
  if (!clean) return
  try {
    storage()?.setItem(KEY, JSON.stringify({ email: clean, savedAt: now } satisfies Stored))
  } catch {
    // Sin almacenamiento: la pantalla pide el correo a mano, como antes.
  }
}

/** El correo guardado si sigue vigente; si caducó o está dañado, se borra. */
export function readPendingSignup(now = Date.now()): string | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<Stored>
    const valid =
      typeof v.email === 'string' && v.email.includes('@') && v.email.length <= 254 &&
      typeof v.savedAt === 'number' && v.savedAt <= now && now - v.savedAt <= PENDING_SIGNUP_MAX_AGE_MS
    if (valid) return v.email!
  } catch {
    // JSON dañado: se borra abajo.
  }
  clearPendingSignup()
  return null
}

export function clearPendingSignup(): void {
  try {
    storage()?.removeItem(KEY)
  } catch {
    // nada que limpiar
  }
}
