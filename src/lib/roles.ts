import type { TenantRole } from './db'

export const ROLE_LABEL: Record<TenantRole, string> = {
  owner: 'Propietaria/o',
  admin: 'Administración',
  reception: 'Recepción',
  doctor: 'Doctor/a',
  doctor_collab: 'Doctor/a colaborador',
  doctor_intern: 'Pasante',
}

export const ROLE_HINT: Record<Exclude<TenantRole, 'owner'>, string> = {
  admin: 'Todo, menos la suscripción',
  reception: 'Agenda, leads, pacientes y cobros',
  doctor: 'Sus pacientes, su agenda y sus presupuestos',
  doctor_collab: 'Como doctor y solo sus comisiones',
  doctor_intern: 'Su agenda y sus pacientes, sin montos',
}

/** Roles que se pueden invitar o asignar (nunca `owner`). */
export const ASSIGNABLE_ROLES = ['admin', 'reception', 'doctor', 'doctor_collab', 'doctor_intern'] as const
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export const isManager = (role: TenantRole | undefined) => role === 'owner' || role === 'admin'
