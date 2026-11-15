import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOGO_BUCKET, LOGO_MAX_BYTES, logoPath, logoProblem } from './logo'

const TENANT = '10000000-0000-4000-8000-000000000001'

describe('logo de la clínica', () => {
  it('acepta PNG, JPG y WebP de hasta 1 MB', () => {
    expect(logoProblem({ type: 'image/png', size: 2000 })).toBeNull()
    expect(logoProblem({ type: 'image/jpeg', size: LOGO_MAX_BYTES })).toBeNull()
    expect(logoProblem({ type: 'image/webp', size: 10 })).toBeNull()
    expect(logoProblem({ type: 'image/svg+xml', size: 10 })).toBe('Usa una imagen PNG, JPG o WebP.')
    expect(logoProblem({ type: 'image/png', size: LOGO_MAX_BYTES + 1 })).toMatch(/más de 1 MB/)
  })

  it('la ruta cumple la regla de la migración', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261115000400_tenant_logo.sql'), 'utf8')
    const tail = /'\/logo-([^']+)\$'/.exec(sql)?.[1]
    expect(tail).toBeDefined()
    const rule = new RegExp(`^${TENANT}/logo-${tail!.replaceAll('\\\\', '\\')}$`)
    expect(logoPath(TENANT, { type: 'image/png' })).toMatch(rule)
    expect(logoPath(TENANT, { type: 'image/jpeg' }, 'ABCDEF12-3456-4789-8abc-def012345678')).toBe(`${TENANT}/logo-abcdef12-3456-4789-8abc-def012345678.jpg`)
    expect(sql).toContain(`values ('${LOGO_BUCKET}'`)
  })
})
