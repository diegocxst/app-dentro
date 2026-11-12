/**
 * ⚠️ TEMPORAL — hasta E1-B.
 * Identidad de la clínica fija mientras no existe la tabla `tenants`
 * (`display_name`, `owner_display_name`, `owner_title`, `logo_path`, `brand_color`).
 * En E1-B este objeto se reemplaza por los datos del tenant activo.
 * No contiene datos de pacientes ni de ninguna clínica real.
 */
import { ensureBrandContrast, type BrandColorResult } from './color'

export type ClinicConfig = {
  displayName: string
  ownerDisplayName: string
  ownerTitle: string
  /** Ruta pública del logo. `null` = se muestran las iniciales sobre `brandColor`. */
  logoUrl: string | null
  brandColor: string
  branches: { id: string; name: string }[]
  /** Progreso de la guía de inicio (7 tareas). */
  guide: { done: number; total: number }
}

export const TEMP_CLINIC_CONFIG: ClinicConfig = {
  displayName: 'Tu clínica',
  ownerDisplayName: 'Dra. o Dr. responsable',
  ownerTitle: 'Propietaria',
  logoUrl: null,
  brandColor: '#0E5E8A',
  branches: [{ id: 'principal', name: 'Sucursal principal' }],
  guide: { done: 0, total: 7 },
}

export type ClinicIdentity = ClinicConfig & {
  initials: string
  brand: BrandColorResult
  ownerLine: string
}

/** Iniciales a partir del nombre: primera y última palabra (p. ej. "Clínica Dental Sonríe" → "CS"). */
export function clinicInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
  if (words.length === 0) return '·'
  const first = words[0]!.charAt(0)
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : ''
  return (first + last).toLocaleUpperCase('es-MX')
}

export function resolveClinicIdentity(config: ClinicConfig): ClinicIdentity {
  return {
    ...config,
    initials: clinicInitials(config.displayName),
    brand: ensureBrandContrast(config.brandColor),
    ownerLine: [config.ownerDisplayName, config.ownerTitle].filter(Boolean).join(' · '),
  }
}
