import { useEffect, useState } from 'react'
import { fetchTeam } from '@/data/team'

export type DoctorOption = { id: string; name: string; color?: string | null; hasAccess?: boolean }

/** Miembros que pueden ser doctor tratante (propietario, administración, doctor, colaborador). */
export function useDoctors(tenantId: string | undefined) {
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  useEffect(() => {
    if (!tenantId) return
    let current = true
    fetchTeam(tenantId).then(
      (team) => {
        if (!current) return
        setDoctors(team.filter((m) => m.role !== 'reception').map((m) => ({ id: m.id, name: m.fullName, color: m.color, hasAccess: m.hasAccess })))
      },
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [tenantId])
  return doctors
}
