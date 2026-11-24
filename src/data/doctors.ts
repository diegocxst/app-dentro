import type { DoctorColor, OfflineRole } from '@/lib/doctors'
import { supabase } from '@/lib/supabase'

export type DoctorProfileInput = { name: string; specialty: string; color: DoctorColor | null; phone: string | null }

/** Alta de un doctor sin acceso (sin correo). Devuelve el id de su registro en la clínica. */
export async function createDoctor(tenantId: string, role: OfflineRole, p: DoctorProfileInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_doctor', {
    p_tenant: tenantId,
    p_name: p.name,
    p_role: role,
    p_specialty: p.specialty,
    // El generador marca como obligatorios los argumentos sin default aunque acepten NULL.
    p_color: p.color as string,
    p_phone: p.phone as string,
  })
  if (error) throw error
  return (data as { id: string }).id
}

/** Nombre en la clínica, especialidad, color y teléfono. Nombre vacío = el de su cuenta. */
export async function updateDoctorProfile(membershipId: string, p: DoctorProfileInput): Promise<void> {
  const { error } = await supabase.rpc('update_doctor_profile', {
    p_membership: membershipId,
    p_name: p.name,
    p_specialty: p.specialty,
    p_color: p.color as string,
    p_phone: p.phone as string,
  })
  if (error) throw error
}
