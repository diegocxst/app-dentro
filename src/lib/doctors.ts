import type { TenantRole } from '@/lib/db'

/** Colores de la agenda por doctor (tokens del sistema «dentro»). El valor se guarda en la base. */
export const DOCTOR_COLORS = [
  { value: 'violet', label: 'Violeta', className: 'bg-violet' },
  { value: 'turquoise', label: 'Turquesa', className: 'bg-turquoise' },
  { value: 'orange', label: 'Naranja', className: 'bg-orange' },
  { value: 'info', label: 'Azul', className: 'bg-info' },
  { value: 'success', label: 'Verde', className: 'bg-success' },
  { value: 'warning', label: 'Amarillo', className: 'bg-warning' },
] as const
export type DoctorColor = (typeof DOCTOR_COLORS)[number]['value']

/** Orden por omisión cuando el doctor no tiene color elegido. */
const FALLBACK = ['bg-violet', 'bg-turquoise', 'bg-orange', 'bg-info', 'bg-success', 'bg-warning', 'bg-error', 'bg-ink-muted'] as const

/** Clase del punto o avatar de un doctor: su color, o el que le toca por posición. */
export function doctorColorClass(color: string | null | undefined, index: number): string {
  return DOCTOR_COLORS.find((c) => c.value === color)?.className ?? FALLBACK[index % FALLBACK.length]!
}

/** Roles que atienden pacientes (pueden ser doctor tratante). */
export const TREATING_ROLES: TenantRole[] = ['owner', 'admin', 'doctor', 'doctor_collab', 'doctor_intern']
/** Roles que puede tener un doctor sin acceso. */
export const OFFLINE_ROLES = ['doctor', 'doctor_collab', 'doctor_intern'] as const
export type OfflineRole = (typeof OFFLINE_ROLES)[number]

/** Nombre con el que aparece en la clínica: el que puso la gerencia o el de su cuenta. */
export const memberName = (displayName: string | null | undefined, accountName: string | null | undefined) =>
  displayName?.trim() || accountName?.trim() || 'Sin nombre'

export const initials = (name: string) =>
  name
    .replace(/^(dra?\.|dr\.)\s*/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
