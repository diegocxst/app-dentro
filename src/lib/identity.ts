import type { TenantRole } from './db'
import { ROLE_LABEL } from './roles'

/** Título de la persona (0019): va antes de su nombre. '' = sin título. */
export const PROFILE_TITLES = [
  { value: '', label: 'Sin título' },
  { value: 'Dr.', label: 'Dr.' },
  { value: 'Dra.', label: 'Dra.' },
] as const
export type ProfileTitle = (typeof PROFILE_TITLES)[number]['value']

/** «Dra. Ana Ruiz». Si el nombre ya trae el título (p. ej. el que puso la gerencia), no lo repite. */
export function withTitle(title: string, name: string): string {
  const n = name.trim()
  const t = title.trim()
  if (!t || !n) return n
  return n.toLowerCase().startsWith(t.toLowerCase()) ? n : `${t} ${n}`
}

/** Rol en el menú: la dueña o el dueño con el título de la clínica (p. ej. «Propietario»). */
export function roleTag(role: TenantRole, ownerTitle: string): string {
  return role === 'owner' ? ownerTitle.trim() || ROLE_LABEL.owner : ROLE_LABEL[role]
}
