import type { DoctorProfileInput } from '@/data/doctors'
import type { DoctorColor } from '@/lib/doctors'
import { normalizePhone } from '@/lib/phone'

export type DoctorFormValues = { name: string; specialty: string; color: DoctorColor | null; phone: string }
export type DoctorFormErrors = Partial<Record<'name' | 'specialty' | 'phone' | 'email', string>>

/** Valida los campos del perfil. `nameOptional`: tiene cuenta y puede usar el nombre de ella. */
export function checkDoctorForm(v: DoctorFormValues, nameOptional: boolean): { errors: DoctorFormErrors; input: DoctorProfileInput | null } {
  const errors: DoctorFormErrors = {}
  const name = v.name.trim()
  if (name.length > 120) errors.name = 'Usa máximo 120 caracteres.'
  else if (name.length < 2 && !(nameOptional && name === '')) errors.name = 'Escribe el nombre del doctor.'
  if (v.specialty.trim().length > 80) errors.specialty = 'Usa máximo 80 caracteres.'
  const phone = v.phone.trim() ? normalizePhone(v.phone) : null
  if (v.phone.trim() && !phone) errors.phone = 'Escribe 10 dígitos, o la lada internacional con «+».'
  if (Object.keys(errors).length) return { errors, input: null }
  return { errors, input: { name, specialty: v.specialty.trim(), color: v.color, phone } }
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
