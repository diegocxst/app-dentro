import { describe, expect, it } from 'vitest'
import { AA_NORMAL, contrastRatio, ensureBrandContrast, hexToRgb, isHexColor } from './color'

describe('contrastRatio', () => {
  it('da 21:1 entre negro y blanco y 1:1 entre colores iguales', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#6A35F0', '#6A35F0')).toBeCloseTo(1, 5)
  })

  it('es simétrica y acepta hex corto', () => {
    expect(contrastRatio('#fff', '#1E1240')).toBeCloseTo(contrastRatio('#1E1240', '#FFFFFF'), 10)
    expect(hexToRgb('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc })
  })

  it('valida el formato', () => {
    expect(isHexColor('#0E5E8A')).toBe(true)
    expect(isHexColor('azul')).toBe(false)
    expect(() => hexToRgb('#12')).toThrow()
  })
})

describe('ensureBrandContrast (brand_color de la clínica)', () => {
  it('conserva un color que ya cumple 4.5:1 con blanco', () => {
    const r = ensureBrandContrast('#0e5e8a')
    expect(r).toMatchObject({ color: '#0E5E8A', original: '#0E5E8A', adjusted: false })
    expect(r.ratio).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('oscurece un color claro hasta cumplir AA y conserva el tono', () => {
    const r = ensureBrandContrast('#2DD4E0')
    expect(r.adjusted).toBe(true)
    expect(r.ratio).toBeGreaterThanOrEqual(AA_NORMAL)
    expect(contrastRatio(r.color, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL)
    const o = hexToRgb('#2DD4E0')
    const c = hexToRgb(r.color)
    // Oscurecer escala los tres canales por igual: se mantiene la proporción.
    expect(c.g / c.b).toBeCloseTo(o.g / o.b, 1)
  })

  it('oscurece incluso el amarillo y el blanco', () => {
    for (const v of ['#FFFF00', '#FFFFFF', '#FF8A3D']) {
      const r = ensureBrandContrast(v)
      expect(r.ratio).toBeGreaterThanOrEqual(AA_NORMAL)
    }
  })

  it('usa el color de respaldo si el valor no es válido', () => {
    expect(ensureBrandContrast('rojo')).toMatchObject({ color: '#1E1240', original: null, adjusted: true })
    expect(ensureBrandContrast(null).color).toBe('#1E1240')
  })
})
