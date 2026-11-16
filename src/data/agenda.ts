import type { AppointmentKind, AppointmentStatus } from '@/lib/agenda'
import { OUT_OF_HOURS } from '@/lib/agenda'
import type { Database, Tables } from '@/lib/db'
import { rpcErrorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export type Appointment = Tables<'appointments'>
export type AgendaItem = Database['public']['Functions']['list_appointments']['Returns'][number]

export type AppointmentInput = {
  patientId: string
  doctorId: string
  branchId: string
  chairId: string
  startsAt: string
  endsAt: string
  kind: AppointmentKind
  treatmentId: string | null
  notes: string
}

/** Citas visibles de una sucursal o de un paciente en [from, to). RLS + filtro en el servidor. */
export async function listAppointments(opts: { from: string; to: string; branchId?: string; patientId?: string }): Promise<AgendaItem[]> {
  const { data, error } = await supabase.rpc('list_appointments', {
    p_from: opts.from,
    p_to: opts.to,
    ...(opts.branchId ? { p_branch: opts.branchId } : {}),
    ...(opts.patientId ? { p_patient: opts.patientId } : {}),
  })
  if (error) throw error
  return (data ?? []) as AgendaItem[]
}

function args(i: AppointmentInput) {
  return {
    p_doctor: i.doctorId,
    p_branch: i.branchId,
    p_chair: i.chairId,
    p_starts_at: i.startsAt,
    p_ends_at: i.endsAt,
    p_kind: i.kind,
    ...(i.treatmentId ? { p_treatment: i.treatmentId } : {}),
    ...(i.notes.trim() ? { p_notes: i.notes.trim() } : {}),
  }
}

export async function createAppointment(i: AppointmentInput): Promise<Appointment> {
  const { data, error } = await supabase.rpc('create_appointment', { p_patient: i.patientId, ...args(i) })
  if (error) throw error
  return data as Appointment
}

export async function updateAppointment(id: string, i: AppointmentInput): Promise<Appointment> {
  const { data, error } = await supabase.rpc('update_appointment', { p_appointment: id, ...args(i) })
  if (error) throw error
  return data as Appointment
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus, reason?: string): Promise<Appointment> {
  const { data, error } = await supabase.rpc('set_appointment_status', {
    p_appointment: id,
    p_status: status,
    ...(reason?.trim() ? { p_reason: reason.trim() } : {}),
  })
  if (error) throw error
  return data as Appointment
}

export async function setBranchTimezone(branchId: string, timezone: string): Promise<void> {
  const { error } = await supabase.rpc('set_branch_timezone', { p_branch: branchId, p_timezone: timezone })
  if (error) throw error
}

/** Errores de la agenda en español (traslape, fuera de horario, permisos). */
export function agendaErrorMessage(e: { code?: string; message?: string } | null | undefined): string {
  switch (e?.code) {
    case '23P01':
      return 'Ese horario ya está ocupado: el sillón o el doctor tienen otra cita.'
    case 'DH001':
      return OUT_OF_HOURS
    case '42501':
      return e.message?.includes('tu agenda') ? 'Solo puedes agendar citas en tu agenda.' : 'No tienes permiso para hacer este cambio.'
    case 'P0002':
      return 'No encontramos la cita o el paciente, o no tienes acceso.'
    case '22023':
      return e.message === 'Todavía no es la hora de la cita'
        ? 'Todavía no es la hora de la cita.'
        : e.message === 'No se agendan citas en el pasado'
          ? 'No se agendan citas en el pasado.'
          : 'Revisa los datos de la cita.'
    default:
      return rpcErrorMessage(e as { code?: string })
  }
}

/** Una cita (para reagendarla). RLS: solo quien la puede ver. */
export async function getAppointment(id: string): Promise<Appointment | null> {
  const { data, error } = await supabase.from('appointments').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Appointment | null) ?? null
}

/** Nombre del paciente (para mostrarlo al agendar desde su ficha). */
export async function getPatientName(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('patients').select('full_name').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as { full_name: string } | null)?.full_name ?? null
}
