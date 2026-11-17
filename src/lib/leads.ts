import type { Enums } from '@/lib/database.types'
import type { PatientSource } from '@/lib/db'

export type LeadStatus = Enums<'lead_status'>

/** Columnas del Kanban (maqueta P11), con su color del sistema "dentro". */
export const LEAD_COLUMNS: readonly { value: LeadStatus; label: string; tone: 'info' | 'warning' | 'violet' | 'success' | 'error'; bar: string }[] = [
  { value: 'nuevo', label: 'Nuevo', tone: 'info', bar: 'bg-info' },
  { value: 'contactado', label: 'Contactado', tone: 'warning', bar: 'bg-warning' },
  { value: 'valoracion', label: 'Valoración agendada', tone: 'violet', bar: 'bg-violet' },
  { value: 'convertido', label: 'Convertido en paciente', tone: 'success', bar: 'bg-success' },
  { value: 'perdido', label: 'Perdido', tone: 'error', bar: 'bg-error' },
]
export const leadStatusLabel = (s: LeadStatus) => LEAD_COLUMNS.find((c) => c.value === s)?.label ?? s

/** Origen como lo muestra la tarjeta del lead (más corto que en Pacientes). */
export const LEAD_SOURCES: readonly { value: PatientSource; label: string; badge: 'automatic' | 'violet' | 'info' | 'success' | 'neutral' }[] = [
  { value: 'meta', label: 'Anuncio en Meta', badge: 'automatic' },
  { value: 'perfil', label: 'Perfil público', badge: 'violet' },
  { value: 'referido', label: 'Referido', badge: 'info' },
  { value: 'whatsapp', label: 'WhatsApp', badge: 'success' },
  { value: 'manual', label: 'En la clínica', badge: 'neutral' },
  { value: 'otro', label: 'Otro', badge: 'neutral' },
]
export const leadSource = (s: PatientSource) => LEAD_SOURCES.find((x) => x.value === s) ?? LEAD_SOURCES[5]!

const DAY = 86_400_000
const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })

/** «hace 40 min», «hace 2 h», «ayer», «hace 3 días» o «30 oct». */
export function relativeAge(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `hace ${h} h`
  const d = Math.floor(diff / DAY)
  if (d < 7) return `hace ${d} días`
  return dateFmt.format(new Date(iso)).replace('.', '')
}

/** Lead nuevo sin respuesta por más de 24 h (se marca en rojo). */
export const isLate = (l: { status: LeadStatus; first_response_at: string | null; created_at: string }, now: number = Date.now()) =>
  l.status === 'nuevo' && !l.first_response_at && now - new Date(l.created_at).getTime() > DAY

/** «2 h 10 min», «35 min», «3 días». */
export function formatMinutes(m: number | null | undefined): string {
  if (m === null || m === undefined) return '—'
  if (m < 60) return `${m} min`
  if (m < 48 * 60) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
  return `${Math.round(m / (24 * 60))} días`
}

/** Primer mensaje por WhatsApp (lo envía la clínica desde su teléfono). */
export function leadWhatsappUrl(phoneE164: string, input: { lead: string; clinic: string }): string {
  const first = input.lead.trim().split(/\s+/)[0] ?? ''
  const text = `Hola ${first}, te escribimos de ${input.clinic}. Vimos que te interesa una consulta con nosotros. ¿Te ayudamos a agendar tu valoración?`
  return `https://wa.me/${phoneE164.replace('+', '')}?text=${encodeURIComponent(text)}`
}

export type LeadStats = { leads: number; reached_valoracion: number; median_response_minutes: number | null; unanswered_24h: number }
