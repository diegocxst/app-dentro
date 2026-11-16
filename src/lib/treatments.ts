// Catálogo de tratamientos (onboarding paso 4 / M10). Categorías iguales al CHECK de
// public.treatments.category (migración 20261116000200).

export const TREATMENT_CATEGORIES = [
  { id: 'preventiva', label: 'Preventiva' },
  { id: 'restauracion', label: 'Restauración' },
  { id: 'ortodoncia', label: 'Ortodoncia' },
  { id: 'implantes', label: 'Implantes' },
  { id: 'estetica', label: 'Estética' },
  { id: 'otros', label: 'Otros' },
] as const
export type TreatmentCategory = (typeof TREATMENT_CATEGORIES)[number]['id']

export const categoryLabel = (id: string) => TREATMENT_CATEGORIES.find((c) => c.id === id)?.label ?? 'Otros'

/** Duraciones de una cita. `null` = varía (p. ej. ortodoncia). */
export const DURATION_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Varía' },
  ...[15, 20, 30, 45, 60, 75, 90, 120, 150, 180].map((m) => ({ value: String(m), label: m < 60 || m % 60 ? `${m} min` : `${m / 60} h` })),
]

/**
 * Tratamientos comunes para sugerir, SIN precio (regla: nada con datos simulados).
 * La clínica marca los que hace y escribe su precio; nada se guarda sin confirmar.
 */
export const SUGGESTED_TREATMENTS: readonly { name: string; category: TreatmentCategory; duration: number | null }[] = [
  { name: 'Valoración inicial', category: 'preventiva', duration: 30 },
  { name: 'Limpieza dental', category: 'preventiva', duration: 45 },
  { name: 'Resina', category: 'restauracion', duration: 45 },
  { name: 'Endodoncia', category: 'restauracion', duration: 90 },
  { name: 'Corona', category: 'restauracion', duration: 60 },
  { name: 'Ortodoncia con brackets', category: 'ortodoncia', duration: null },
  { name: 'Alineadores', category: 'ortodoncia', duration: null },
  { name: 'Implante unitario', category: 'implantes', duration: null },
  { name: 'Blanqueamiento', category: 'estetica', duration: 60 },
  { name: 'Carillas', category: 'estetica', duration: null },
]

/** «850», «$1,200», «28 000.50» → 850 / 1200 / 28000.5; `null` si no es un precio válido. */
export function parsePrice(input: string): number | null {
  const clean = input.replace(/[$\s,]/g, '')
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(clean)) return null
  return Number(clean)
}

export const formatMxn = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n)
