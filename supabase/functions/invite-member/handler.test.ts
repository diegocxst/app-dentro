import { describe, expect, it, vi } from 'vitest'
import { handleInvite, type Deps } from './handler'

const TENANT = '10000000-0000-4000-8000-000000000001'
const BRANCH = '20000000-0000-4000-8000-000000000001'
const SITE = 'http://localhost:5173'

function deps(over: Partial<Deps> = {}): Deps {
  return {
    siteUrl: SITE,
    createInvitation: vi.fn(async () => ({ data: { id: 'inv-1' }, error: null })),
    sendInvite: vi.fn(async () => ({ error: null })),
    ...over,
  }
}

const post = (body: unknown, auth = 'Bearer jwt-de-prueba') =>
  new Request('https://fn.test/invite-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  })

const valid = { tenant_id: TENANT, email: '  Doctor@Example.TEST ', role: 'doctor', branch_ids: [BRANCH] }

describe('Edge Function invite-member', () => {
  it('crea la invitación con el JWT de quien invita y luego envía el correo', async () => {
    const d = deps()
    const res = await handleInvite(post(valid), d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'sent', invitation_id: 'inv-1' })
    expect(d.createInvitation).toHaveBeenCalledWith('jwt-de-prueba', {
      p_tenant: TENANT,
      p_email: 'doctor@example.test',
      p_role: 'doctor',
      p_branch_ids: [BRANCH],
    })
    expect(d.sendInvite).toHaveBeenCalledWith('doctor@example.test', `${SITE}/auth/invitacion`)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE)
  })

  it('liga la invitación al doctor sin acceso cuando viene membership_id', async () => {
    const d = deps()
    const MEMBER = '30000000-0000-4000-8000-000000000001'
    const res = await handleInvite(post({ ...valid, membership_id: MEMBER }), d)
    expect(res.status).toBe(200)
    expect(d.createInvitation).toHaveBeenCalledWith('jwt-de-prueba', expect.objectContaining({ p_membership: MEMBER }))
  })

  it('sin sesión no hace nada', async () => {
    const d = deps()
    const res = await handleInvite(post(valid, ''), d)
    expect(res.status).toBe(401)
    expect(d.createInvitation).not.toHaveBeenCalled()
    expect(d.sendInvite).not.toHaveBeenCalled()
  })

  it.each([
    ['rol de propietaria', { ...valid, role: 'owner' }],
    ['correo inválido', { ...valid, email: 'no-es-correo' }],
    ['clínica inválida', { ...valid, tenant_id: 'x' }],
    ['sucursal inválida', { ...valid, branch_ids: ['x'] }],
    ['doctor inválido', { ...valid, membership_id: 'x' }],
  ])('rechaza %s sin llamar a la base', async (_, body) => {
    const d = deps()
    const res = await handleInvite(post(body), d)
    expect(res.status).toBe(400)
    expect(d.createInvitation).not.toHaveBeenCalled()
  })

  it.each([
    ['42501', 403, 'forbidden'],
    ['23505', 409, 'already_member'],
    ['22023', 400, 'invalid'],
    ['P0002', 404, 'not_found'],
    ['28000', 401, 'session'],
    ['XX000', 500, 'server'],
  ])('si la base responde %s, contesta %i y NO envía correo', async (code, status, errCode) => {
    const d = deps({ createInvitation: vi.fn(async () => ({ data: null, error: { code, message: 'x' } })) })
    const res = await handleInvite(post(valid), d)
    expect(res.status).toBe(status)
    expect(await res.json()).toMatchObject({ status: 'error', code: errCode })
    expect(d.sendInvite).not.toHaveBeenCalled()
  })

  it('si el correo ya tiene cuenta, la invitación queda lista para su próximo ingreso', async () => {
    const d = deps({ sendInvite: vi.fn(async () => ({ error: { code: 'email_exists', status: 422 } })) })
    const res = await handleInvite(post(valid), d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'existing_user', invitation_id: 'inv-1' })
  })

  it('si falla el envío, avisa y la invitación queda pendiente', async () => {
    const d = deps({ sendInvite: vi.fn(async () => ({ error: { status: 500, message: 'smtp' } })) })
    const res = await handleInvite(post(valid), d)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ status: 'email_failed', invitation_id: 'inv-1' })
  })

  it('responde el preflight de CORS solo para la app', async () => {
    const res = await handleInvite(new Request('https://fn.test/invite-member', { method: 'OPTIONS' }), deps())
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE)
  })
})
