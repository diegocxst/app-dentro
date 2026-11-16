import type { Enums } from '@/lib/database.types'

export type ArcoRight = Enums<'arco_right'>
export type ArcoStatus = Enums<'arco_status'>

export const ARCO_RIGHTS: readonly { value: ArcoRight; label: string; hint: string }[] = [
  { value: 'acceso', label: 'Acceso', hint: 'Quiere saber qué datos tienes y recibir una copia.' },
  { value: 'rectificacion', label: 'Rectificación', hint: 'Quiere corregir un dato.' },
  { value: 'cancelacion', label: 'Cancelación', hint: 'Quiere que borres sus datos. El expediente se conserva 5 años (NOM-004).' },
  { value: 'oposicion', label: 'Oposición', hint: 'No quiere que uses sus datos para algo, por ejemplo promociones.' },
]

export const ARCO_CHANNELS = [
  { value: 'presencial', label: 'En la clínica' },
  { value: 'correo', label: 'Correo' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'otro', label: 'Otro' },
] as const

export const ARCO_STATUS: Record<ArcoStatus, string> = {
  recibida: 'Recibida',
  en_proceso: 'En proceso',
  atendida: 'Atendida',
  improcedente: 'Improcedente',
}

export const rightLabel = (r: ArcoRight) => ARCO_RIGHTS.find((x) => x.value === r)?.label ?? r
export const channelLabel = (c: string) => ARCO_CHANNELS.find((x) => x.value === c)?.label ?? c
export const isResolved = (s: ArcoStatus) => s === 'atendida' || s === 'improcedente'

/** Días naturales que faltan para el vencimiento (negativo = vencida). `today` en AAAA-MM-DD local. */
export function daysLeft(dueOn: string, today: string = localToday()): number {
  const [a, b] = [Date.parse(`${dueOn}T00:00:00Z`), Date.parse(`${today}T00:00:00Z`)]
  return Math.round((a - b) / 86_400_000)
}

export function localToday(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Nombre de archivo seguro: «datos-ana-lopez-2026-11-16.pdf». */
export function exportFileName(fullName: string, ext: 'pdf' | 'json', today: string = localToday()): string {
  const slug = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `datos-${slug || 'paciente'}-${today}.${ext}`
}

export type PatientExport = {
  format: 'dentro.patient-export.v1'
  generated_at: string
  clinic: { name: string; city: string; notice_version: string }
  patient: {
    id: string
    full_name: string
    birth_date: string | null
    phone_e164: string | null
    email: string | null
    source: string
    tags: string[]
    primary_doctor: string | null
    archived_at: string | null
    created_at: string
    updated_at: string
  }
  consents: { method: string; notice_version: string; recorded_at: string }[]
  notes: { body: string; created_at: string; author: string }[]
  documents: { name: string; kind: string; mime: string; size_bytes: number; created_at: string; archived_at: string | null }[]
  access_log: { at: string; action: string; target: string; by: string }[]
  arco_requests: { right: ArcoRight; channel: string; received_on: string; due_on: string; status: ArcoStatus; response: string | null; resolved_at: string | null }[]
}
