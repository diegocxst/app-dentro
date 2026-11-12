/**
 * Utilidades de color y contraste (WCAG 2.x).
 * Candidata a subir a `core-base`: no depende de nada de dentro.
 */

export type Rgb = { r: number; g: number; b: number }

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim())
}

export function hexToRgb(hex: string): Rgb {
  const match = HEX_RE.exec(hex.trim())
  if (!match?.[1]) throw new Error(`Color hexadecimal no válido: ${hex}`)
  let h = match[1]
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const n = Number.parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Razón de contraste entre dos colores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** AA para texto normal (4.5:1). */
export const AA_NORMAL = 4.5
/** AA para texto grande o componentes de interfaz (3:1). */
export const AA_LARGE = 3

export type BrandColorResult = {
  /** Color listo para usar (el original o uno oscurecido). */
  color: string
  /** Color que se recibió (normalizado) o `null` si no era válido. */
  original: string | null
  /** `true` si se oscureció o se reemplazó para cumplir el contraste. */
  adjusted: boolean
  /** Contraste final contra `against`. */
  ratio: number
}

/**
 * Valida el `brand_color` de la clínica: debe tener contraste ≥ `minRatio`
 * contra `against` (blanco por defecto, porque las iniciales y textos van en blanco).
 * Si no pasa, se oscurece de forma progresiva conservando el tono.
 * Si el valor no es un color válido, se usa `fallback`.
 */
export function ensureBrandContrast(
  value: string | null | undefined,
  { against = '#FFFFFF', minRatio = AA_NORMAL, fallback = '#1E1240' } = {},
): BrandColorResult {
  if (!value || !isHexColor(value)) {
    return { color: fallback, original: null, adjusted: true, ratio: contrastRatio(fallback, against) }
  }
  const original = rgbToHex(hexToRgb(value))
  const ratio = contrastRatio(original, against)
  if (ratio >= minRatio) return { color: original, original, adjusted: false, ratio }

  const base = hexToRgb(original)
  // Mezcla hacia negro en pasos de 2% hasta cumplir.
  for (let step = 1; step <= 50; step++) {
    const k = 1 - step * 0.02
    const candidate = rgbToHex({ r: base.r * k, g: base.g * k, b: base.b * k })
    const r = contrastRatio(candidate, against)
    if (r >= minRatio) return { color: candidate, original, adjusted: true, ratio: r }
  }
  return { color: fallback, original, adjusted: true, ratio: contrastRatio(fallback, against) }
}
