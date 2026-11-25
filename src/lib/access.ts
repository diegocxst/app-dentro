import { SECTIONS, type Section, type SectionId } from '@/app/navigation'
import type { TenantRole } from './db'
import { isManager } from './roles'

/**
 * Qué ve cada rol en el menú y en Configuración (Ajustes-D, decisión 2026-11-24).
 * Solo oculta pantallas: los permisos reales los aplica el servidor (RLS y RPC).
 */

/** Doctores que atienden y no gestionan la clínica (incluye al pasante). */
export const isTreating = (role: TenantRole | undefined) => role === 'doctor' || role === 'doctor_collab' || role === 'doctor_intern'

/** ¿Ve montos? Todos menos el pasante: sin presupuestos, cobros ni comisiones (M6-B2a). */
export const seesMoney = (role: TenantRole | undefined) => Boolean(role) && role !== 'doctor_intern'

export function canSeeSection(role: TenantRole | undefined, id: SectionId): boolean {
  if (!role) return false
  if (isManager(role)) return true
  if (id === 'crece') return false
  if (id === 'leads') return role === 'reception'
  if (id === 'presupuestos' || id === 'cobros') return seesMoney(role)
  return true
}

/** Guía de inicio: solo quien arma la clínica. */
export const canSeeGuide = (role: TenantRole | undefined) => isManager(role)

export type ConfigArea = 'identidad' | 'sucursales' | 'tratamientos' | 'perfil'

/** Sin gerencia: solo «Mi perfil» y «Tratamientos y precios» («Tu equipo» ya es sección del menú). */
export function canSeeConfig(role: TenantRole | undefined, area: ConfigArea): boolean {
  if (isManager(role)) return true
  return Boolean(role) && (area === 'tratamientos' || area === 'perfil')
}

/** Comisiones: gerencia y doctores (recepción no). */
export const canSeeCommissions = (role: TenantRole | undefined) => isManager(role) || role === 'doctor' || role === 'doctor_collab'

/** Menú lateral del rol. */
export function menuFor(role: TenantRole | undefined): Section[] {
  return SECTIONS.filter((s) => canSeeSection(role, s.id))
}

/** Barra inferior en móvil: quien no ve Leads tiene Presupuestos (o Seguimientos, el pasante). */
export function mobileTabsFor(role: TenantRole | undefined): SectionId[] {
  const fourth: SectionId = canSeeSection(role, 'leads') ? 'leads' : canSeeSection(role, 'presupuestos') ? 'presupuestos' : 'seguimientos'
  return ['inicio', 'agenda', 'pacientes', fourth]
}
