import { describe, expect, it } from 'vitest'
import { clinicInitials, resolveClinicIdentity, TEMP_CLINIC_CONFIG } from './clinic-config'

describe('identidad de la clínica', () => {
  it('saca las iniciales de la primera y la última palabra', () => {
    expect(clinicInitials('Clínica Dental Sonríe')).toBe('CS')
    expect(clinicInitials('  ortodent  ')).toBe('O')
    expect(clinicInitials('Ángel & Ñu')).toBe('ÁÑ')
    expect(clinicInitials('')).toBe('·')
  })

  it('valida el brand_color al resolver la identidad', () => {
    const id = resolveClinicIdentity({ ...TEMP_CLINIC_CONFIG, brandColor: '#FFEEDF' })
    expect(id.brand.adjusted).toBe(true)
    expect(id.brand.ratio).toBeGreaterThanOrEqual(4.5)
    expect(id.ownerLine).toBe(`${TEMP_CLINIC_CONFIG.ownerDisplayName} · ${TEMP_CLINIC_CONFIG.ownerTitle}`)
  })
})
