import type { ArcoRight, ArcoStatus, PatientExport } from '@/lib/arco'
import type { Tables } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export type ArcoRequest = Tables<'arco_requests'>

/** Solicitudes ARCO del paciente. RLS: solo dueña y administración. */
export async function listArcoRequests(patientId: string): Promise<ArcoRequest[]> {
  const { data, error } = await supabase.from('arco_requests').select('*').eq('patient_id', patientId).order('received_on', { ascending: false })
  if (error) throw error
  return (data ?? []) as ArcoRequest[]
}

export async function createArcoRequest(input: { patientId: string; right: ArcoRight; channel: string; receivedOn: string; details: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_arco_request', {
    p_patient: input.patientId,
    p_right: input.right,
    p_channel: input.channel,
    p_received_on: input.receivedOn,
    ...(input.details.trim() ? { p_details: input.details.trim() } : {}),
  })
  if (error) throw error
  return data as string
}

export async function updateArcoRequest(id: string, status: Exclude<ArcoStatus, 'recibida'>, response: string): Promise<ArcoRequest> {
  const { data, error } = await supabase.rpc('update_arco_request', {
    p_request: id,
    p_status: status,
    ...(response.trim() ? { p_response: response.trim() } : {}),
  })
  if (error) throw error
  return data as ArcoRequest
}

/** Todo lo que la clínica guarda del paciente. Queda en la bitácora de accesos. */
export async function exportPatientData(patientId: string): Promise<PatientExport> {
  const { data, error } = await supabase.rpc('export_patient_data', { p_patient: patientId })
  if (error) throw error
  return data as unknown as PatientExport
}
