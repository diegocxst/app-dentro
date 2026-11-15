// Normalización de teléfonos a E.164, el formato que exige la base de datos
// (CHECK ~ '^\+[1-9][0-9]{7,14}$') y que usan wa.me y tel:. Origen: core-base (Realt-In).

export const E164_PATTERN = /^\+[1-9]\d{7,14}$/

/**
 * Normaliza un teléfono capturado por el usuario.
 * - 10 dígitos se interpretan como número de México → +52XXXXXXXXXX.
 * - Acepta prefijos 52 / +52 y el antiguo "1" de celulares (521…).
 * - Otros países deben escribirse con "+" y lada internacional.
 * Devuelve null si no se puede normalizar con certeza.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const hasPlus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('00')) digits = digits.slice(2)

  let candidate: string
  if (hasPlus || trimmed.startsWith('00')) {
    if (digits.startsWith('521') && digits.length === 13) digits = '52' + digits.slice(3)
    candidate = '+' + digits
  } else if (digits.length === 10) {
    candidate = '+52' + digits
  } else if (digits.length === 12 && digits.startsWith('52')) {
    candidate = '+' + digits
  } else if (digits.length === 13 && digits.startsWith('521')) {
    candidate = '+52' + digits.slice(3)
  } else {
    return null
  }
  return E164_PATTERN.test(candidate) ? candidate : null
}

/** Formato legible: +52 55 1234 5678 para México; el resto se muestra tal cual. */
export function formatPhone(e164: string): string {
  const mx = /^\+52(\d{2})(\d{4})(\d{4})$/.exec(e164)
  if (mx) return `+52 ${mx[1]} ${mx[2]} ${mx[3]}`
  return e164
}
