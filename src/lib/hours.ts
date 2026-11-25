// Horario de atención por sucursal. Mismas reglas que private.valid_opening_hours()
// (migración 20261116000300): días mon…sun, hasta 3 tramos HH:MM en orden y sin encimarse.

export const DAYS = [
  { id: 'mon', label: 'Lunes', short: 'Lun' },
  { id: 'tue', label: 'Martes', short: 'Mar' },
  { id: 'wed', label: 'Miércoles', short: 'Mié' },
  { id: 'thu', label: 'Jueves', short: 'Jue' },
  { id: 'fri', label: 'Viernes', short: 'Vie' },
  { id: 'sat', label: 'Sábado', short: 'Sáb' },
  { id: 'sun', label: 'Domingo', short: 'Dom' },
] as const
export type DayId = (typeof DAYS)[number]['id']
export type Range = [string, string]
export type OpeningHours = Partial<Record<DayId, Range[]>>

export const MAX_RANGES = 3
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Mensaje del primer problema, o `null` si el horario es válido. */
export function hoursProblem(hours: OpeningHours, max: number = MAX_RANGES): string | null {
  for (const d of DAYS) {
    const ranges = hours[d.id]
    if (!ranges) continue
    if (ranges.length > max) return `${d.label}: máximo ${max} horarios por día.`
    let prevEnd: string | null = null
    for (const [start, end] of ranges) {
      if (!HHMM.test(start) || !HHMM.test(end)) return `${d.label}: escribe las horas completas.`
      if (start >= end) return `${d.label}: cada horario debe empezar antes de terminar.`
      if (prevEnd && start < prevEnd) return `${d.label}: los horarios no se pueden encimar.`
      prevEnd = end
    }
  }
  return null
}

/** Lee `branches.opening_hours` tolerando datos raros. */
export function parseHours(value: unknown): OpeningHours {
  const out: OpeningHours = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  for (const d of DAYS) {
    const ranges = (value as Record<string, unknown>)[d.id]
    if (Array.isArray(ranges)) {
      out[d.id] = ranges.filter((r): r is Range => Array.isArray(r) && r.length === 2 && r.every((x) => typeof x === 'string'))
    }
  }
  return out
}

/** «Lun a Vie 09:00–18:00 · Sáb 09:00–13:00» (días seguidos con el mismo horario se agrupan). */
export function summarizeHours(hours: OpeningHours): string {
  const key = (d: DayId) => (hours[d] ?? []).map((r) => `${r[0]}–${r[1]}`).join(', ')
  const parts: string[] = []
  let i = 0
  while (i < DAYS.length) {
    const k = key(DAYS[i]!.id)
    let j = i
    while (j + 1 < DAYS.length && key(DAYS[j + 1]!.id) === k) j++
    if (k) parts.push(`${DAYS[i]!.short}${j > i ? ` a ${DAYS[j]!.short}` : ''} ${k}`)
    i = j + 1
  }
  return parts.length ? parts.join(' · ') : 'Sin horario'
}
