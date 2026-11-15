import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from './phone'

describe('teléfonos', () => {
  it('normaliza números de México y con lada internacional', () => {
    expect(normalizePhone('55 1234 5678')).toBe('+525512345678')
    expect(normalizePhone('+52 1 55 1234 5678')).toBe('+525512345678')
    expect(normalizePhone('525512345678')).toBe('+525512345678')
    expect(normalizePhone('+1 415 555 0100')).toBe('+14155550100')
    expect(normalizePhone('5512')).toBeNull()
    expect(normalizePhone('')).toBeNull()
  })

  it('formatea números de México', () => {
    expect(formatPhone('+525512345678')).toBe('+52 55 1234 5678')
  })
})
