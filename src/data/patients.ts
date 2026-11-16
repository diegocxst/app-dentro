import type { ConsentMethod, PatientSource, Tables } from '@/lib/db'
import { likePattern, PATIENTS_PAGE_SIZE } from '@/lib/patients'
import { supabase } from '@/lib/supabase'

export type Patient = Tables<'patients'>
export type PatientListItem = Pick<Patient, 'id' | 'full_name' | 'birth_date' | 'phone_e164' | 'primary_doctor_id' | 'source' | 'archived_at' | 'created_at'>

/** Lista paginada en el servidor (RLS: cada quien ve solo a quien puede ver). */
export async function listPatients(opts: {
  tenantId: string
  search?: string
  page: number
  archived?: boolean
}): Promise<{ rows: PatientListItem[]; total: number }> {
  const from = opts.page * PATIENTS_PAGE_SIZE
  let q = supabase
    .from('patients')
    .select('id, full_name, birth_date, phone_e164, primary_doctor_id, source, archived_at, created_at', { count: 'exact' })
    .eq('tenant_id', opts.tenantId)
  q = opts.archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null)
  const search = opts.search?.trim()
  if (search) {
    const digits = search.replace(/\D/g, '')
    q = digits.length >= 4 ? q.or(`full_name.ilike.${likePattern(search)},phone_e164.ilike.%${digits}%`) : q.ilike('full_name', likePattern(search))
  }
  const { data, error, count } = await q.order('full_name', { ascending: true }).range(from, from + PATIENTS_PAGE_SIZE - 1)
  if (error) throw error
  return { rows: (data ?? []) as PatientListItem[], total: count ?? 0 }
}

export type NewPatient = {
  tenantId: string
  fullName: string
  consentMethod: ConsentMethod
  birthDate: string | null
  phoneE164: string | null
  email: string
  source: PatientSource
  primaryDoctorId: string | null
}

export async function createPatient(p: NewPatient): Promise<Patient> {
  const { data, error } = await supabase.rpc('create_patient', {
    p_tenant: p.tenantId,
    p_full_name: p.fullName,
    p_consent_method: p.consentMethod,
    ...(p.birthDate ? { p_birth_date: p.birthDate } : {}),
    ...(p.phoneE164 ? { p_phone_e164: p.phoneE164 } : {}),
    ...(p.email ? { p_email: p.email } : {}),
    p_source: p.source,
    ...(p.primaryDoctorId ? { p_primary_doctor: p.primaryDoctorId } : {}),
  })
  if (error) throw error
  return data as Patient
}

export type PatientNote = { id: string; body: string; created_at: string; author_id: string | null; author_name: string }
export type PatientConsent = { method: ConsentMethod; notice_version: string; recorded_at: string }
export type PatientRecord = { patient: Patient; consent: PatientConsent | null; notes: PatientNote[] }

/** Abre la ficha (queda registrado en la bitácora de accesos). */
export async function openPatient(id: string): Promise<PatientRecord> {
  const { data, error } = await supabase.rpc('open_patient', { p_patient: id })
  if (error) throw error
  return data as unknown as PatientRecord
}

export type PatientChanges = {
  fullName?: string
  birthDate?: string
  phoneE164?: string
  email?: string
  source?: PatientSource
  primaryDoctorId?: string
}

/** Cambios de la ficha; '' borra teléfono, correo, fecha o doctor tratante. */
export async function updatePatient(id: string, c: PatientChanges): Promise<void> {
  const { error } = await supabase.rpc('update_patient', {
    p_patient: id,
    ...(c.fullName !== undefined ? { p_full_name: c.fullName } : {}),
    ...(c.birthDate !== undefined ? { p_birth_date: c.birthDate } : {}),
    ...(c.phoneE164 !== undefined ? { p_phone_e164: c.phoneE164 } : {}),
    ...(c.email !== undefined ? { p_email: c.email } : {}),
    ...(c.source !== undefined ? { p_source: c.source } : {}),
    ...(c.primaryDoctorId !== undefined ? { p_primary_doctor: c.primaryDoctorId } : {}),
  })
  if (error) throw error
}

export async function addPatientNote(id: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('add_patient_note', { p_patient: id, p_body: body })
  if (error) throw error
}

export async function setPatientArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_patient_archived', { p_patient: id, p_archived: archived })
  if (error) throw error
}
