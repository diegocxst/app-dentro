import { ensureBrandContrast, type BrandColorResult } from './color'
import type { Tables } from './database.types'
import { guideProgress } from './onboarding'

/** Identidad de la clínica activa, lista para el menú, la barra y los documentos. */
export type ClinicIdentity = {
  tenantId: string
  displayName: string
  ownerDisplayName: string
  ownerTitle: string
  ownerLine: string
  /** URL del logo. `null` = iniciales sobre `brand.color` (subir logo llega con Storage). */
  logoUrl: string | null
  initials: string
  brand: BrandColorResult
  guide: { done: number; total: number }
}

/** Iniciales: primera y última palabra (p. ej. "Clínica Dental Sonríe" → "CS"). */
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

export function ownerLine(ownerDisplayName: string, ownerTitle: string): string {
  return [ownerDisplayName.trim(), ownerTitle.trim()].filter(Boolean).join(' · ')
}

type IdentityFields = Pick<Tables<'tenants'>, 'id' | 'display_name' | 'owner_display_name' | 'owner_title' | 'brand_color' | 'onboarding_state'>

export function identityFromTenant(t: IdentityFields): ClinicIdentity {
  return {
    tenantId: t.id,
    displayName: t.display_name,
    ownerDisplayName: t.owner_display_name,
    ownerTitle: t.owner_title,
    ownerLine: ownerLine(t.owner_display_name, t.owner_title),
    logoUrl: null,
    initials: clinicInitials(t.display_name),
    // La base ya lo guarda ajustado; se vuelve a validar por si acaso.
    brand: ensureBrandContrast(t.brand_color),
    guide: guideProgress(t.onboarding_state),
  }
}
