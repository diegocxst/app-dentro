import type { Enums } from '@/lib/database.types'

export type AppointmentStatus = Enums<'appointment_status'>
export type AppointmentKind = Enums<'appointment_kind'>
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type Hours = Partial<Record<DayKey, [string, string][]>>

export const DEFAULT_TZ = 'America/Mexico_City'

export const TIMEZONES: readonly { value: string; label: string }[] = [
  { value: 'America/Mexico_City', label: 'Centro (Ciudad de México, Guadalajara, Puebla)' },
  { value: 'America/Monterrey', label: 'Centro (Monterrey)' },
  { value: 'America/Merida', label: 'Centro (Mérida)' },
  { value: 'America/Cancun', label: 'Sureste (Cancún, Quintana Roo)' },
  { value: 'America/Mazatlan', label: 'Pacífico (Mazatlán, Sinaloa, Nayarit, BCS)' },
  { value: 'America/Bahia_Banderas', label: 'Centro (Bahía de Banderas)' },
  { value: 'America/Chihuahua', label: 'Centro (Chihuahua)' },
  { value: 'America/Hermosillo', label: 'Sonora (Hermosillo)' },
  { value: 'America/Tijuana', label: 'Noroeste (Tijuana, Mexicali)' },
  { value: 'America/Ciudad_Juarez', label: 'Frontera (Ciudad Juárez)' },
  { value: 'America/Ojinaga', label: 'Frontera (Ojinaga)' },
  { value: 'America/Matamoros', label: 'Frontera (Matamoros, Reynosa)' },
]

export const APPOINTMENT_KINDS: readonly { value: AppointmentKind; label: string }[] = [
  { value: 'valoracion', label: 'Valoración' },
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'revision', label: 'Revisión' },
]
export const kindLabel = (k: AppointmentKind) => APPOINTMENT_KINDS.find((x) => x.value === k)?.label ?? k

/** Etiqueta y colores (tokens del sistema "dentro") de cada estado, como en la maqueta. */
export const STATUS: Record<AppointmentStatus, { label: string; block: string; badge: 'info' | 'warning' | 'success' | 'error' | 'neutral' }> = {
  programada: { label: 'Sin confirmar', block: 'border-warning bg-warning-soft', badge: 'warning' },
  confirmada: { label: 'Confirmada', block: 'border-info bg-info-soft', badge: 'info' },
  llego: { label: 'Llegó', block: 'border-success bg-success-soft', badge: 'success' },
  no_asistio: { label: 'No asistió', block: 'border-error bg-error-soft', badge: 'error' },
  cancelada: { label: 'Cancelada', block: 'border-border bg-surface opacity-60', badge: 'neutral' },
}

export const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240] as const

const DAY_KEYS: readonly DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const pad = (n: number) => String(n).padStart(2, '0')

export const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const fromMinutes = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

/** Partes de una fecha en la zona indicada. */
export function zonedParts(date: Date, tz: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

function offsetMs(utcMs: number, tz: string): number {
  const { date, time } = zonedParts(new Date(utcMs), tz)
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  const [h, mi] = time.split(':').map(Number) as [number, number]
  return Date.UTC(y, mo - 1, d, h, mi) - Math.floor(utcMs / 60000) * 60000
}

/** «2026-11-16» + «10:30» en la zona de la sucursal → instante ISO (UTC). */
export function zonedToUtc(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  const [h, mi] = time.split(':').map(Number) as [number, number]
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const first = guess - offsetMs(guess, tz)
  return new Date(guess - offsetMs(first, tz)).toISOString()
}

export const todayIn = (tz: string, now: Date = new Date()) => zonedParts(now, tz).date

export function addDays(date: string, n: number): string {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, mo - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export function dayKey(date: string): DayKey {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  return DAY_KEYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()] ?? 'mon'
}

export const hoursFor = (hours: Hours | null | undefined, date: string): [string, string][] => hours?.[dayKey(date)] ?? []

/** ¿[desde, hasta) cabe completo en uno de los horarios del día? */
export function withinHours(ranges: [string, string][], from: string, to: string): boolean {
  return to > from && ranges.some(([a, b]) => from >= a && to <= b)
}

/** Horas de inicio posibles (cada 15 min) para una cita de `duration` minutos. */
export function startOptions(ranges: [string, string][], duration: number): string[] {
  const out: string[] = []
  for (const [a, b] of ranges) {
    for (let m = toMinutes(a); m + duration <= toMinutes(b); m += 15) out.push(fromMinutes(m))
  }
  return out
}

const dayFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDayFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const asUtcDate = (date: string) => new Date(`${date}T12:00:00Z`)
export const dayLabel = (date: string) => dayFmt.format(asUtcDate(date)).replace(/\./g, '')
export const longDayLabel = (date: string) => longDayFmt.format(asUtcDate(date))

/** Mensaje de WhatsApp para pedir la confirmación (la clínica lo envía desde su teléfono). */
export function confirmWhatsappUrl(phoneE164: string, input: { patient: string; clinic: string; date: string; time: string }): string {
  const first = input.patient.trim().split(/\s+/)[0] ?? ''
  const text = `Hola ${first}, te escribimos de ${input.clinic}. Tienes cita el ${longDayLabel(input.date)} a las ${input.time}. ¿Nos confirmas tu asistencia?`
  return `https://wa.me/${phoneE164.replace('+', '')}?text=${encodeURIComponent(text)}`
}

export const OUT_OF_HOURS = 'Ese horario está fuera del horario de la sucursal. Escribe a la clínica o al doctor para revisar este caso.'
