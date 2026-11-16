import type { PatientSource } from './db'

export const PATIENT_SOURCES: readonly { value: PatientSource; label: string }[] = [
  { value: 'manual', label: 'Llegó a la clínica' },
  { value: 'referido', label: 'Recomendación' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'meta', label: 'Facebook o Instagram' },
  { value: 'perfil', label: 'Perfil público' },
  { value: 'otro', label: 'Otro' },
]
export const sourceLabel = (s: PatientSource) => PATIENT_SOURCES.find((x) => x.value === s)?.label ?? 'Otro'

/** Edad cumplida a partir de «AAAA-MM-DD» (hoy por omisión). */
export function ageFrom(birthDate: string | null, today: Date = new Date()): number | null {
  if (!birthDate) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  if (!y || !m || !d) return null
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--
  return age >= 0 && age < 130 ? age : null
}

export const PATIENTS_PAGE_SIZE = 25

/** Escapa % y _ para usar el texto de búsqueda en un ILIKE. */
export function likePattern(search: string): string {
  return `%${search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}
