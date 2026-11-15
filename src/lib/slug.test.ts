import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS, slugify, slugProblem } from './slug'

describe('slug', () => {
  it('convierte nombres en direcciones válidas', () => {
    expect(slugify('Clínica Dental Sonríe')).toBe('clinica-dental-sonrie')
    expect(slugify('  Ortodoncia & Estética -- Polanco ')).toBe('ortodoncia-y-estetica-polanco')
    expect(slugify('Ñandú')).toBe('nandu')
  })

  it('detecta problemas', () => {
    expect(slugProblem('ab')).toBe('length')
    expect(slugProblem('-abc')).toBe('format')
    expect(slugProblem('abc--def')).toBe('double-dash')
    expect(slugProblem('pacientes')).toBe('reserved')
    expect(slugProblem('clinica-dental-sonrie')).toBeNull()
  })

  it('las palabras reservadas coinciden con la migración', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261115000100_core_tenancy.sql'), 'utf8')
    const block = /is_reserved_slug[\s\S]*?array\[([\s\S]*?)\]/.exec(sql)?.[1] ?? ''
    const fromSql = [...block.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).sort()
    expect(fromSql.length).toBeGreaterThan(10)
    expect([...RESERVED_SLUGS].sort()).toEqual(fromSql)
  })
})
