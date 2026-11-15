import { describe, expect, it } from 'vitest'
import { clinicInitials, identityFromTenant } from './clinic-identity'
import { guideProgress } from './onboarding'

describe('identidad de la clínica', () => {
  it('saca las iniciales de la primera y la última palabra', () => {
    expect(clinicInitials('Clínica Dental Sonríe')).toBe('CS')
    expect(clinicInitials('  ortodent  ')).toBe('O')
    expect(clinicInitials('Ángel & Ñu')).toBe('ÁÑ')
    expect(clinicInitials('')).toBe('·')
  })

  it('arma la identidad desde la clínica y vuelve a validar el color', () => {
    const id = identityFromTenant({
      id: 't1',
      display_name: 'Clínica Dental Sonríe',
      owner_display_name: 'Dra. Ana Ruiz',
      owner_title: 'Propietaria',
      brand_color: '#FFEEDF',
      onboarding_state: { tasks: { identity: true, branches: true, x: false } },
    })
    expect(id.initials).toBe('CS')
    expect(id.ownerLine).toBe('Dra. Ana Ruiz · Propietaria')
    expect(id.brand.ratio).toBeGreaterThanOrEqual(4.5)
    expect(id.guide).toEqual({ done: 2, total: 7 })
  })

  it('la guía tolera estados vacíos o raros', () => {
    expect(guideProgress(null)).toEqual({ done: 0, total: 7 })
    expect(guideProgress([])).toEqual({ done: 0, total: 7 })
    expect(guideProgress({ tasks: 'x' })).toEqual({ done: 0, total: 7 })
  })
})
