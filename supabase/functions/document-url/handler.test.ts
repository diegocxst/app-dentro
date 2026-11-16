import { describe, expect, it, vi } from 'vitest'
import { handleDocumentUrl, LINK_SECONDS, type Deps } from './handler'

const DOC = '30000000-0000-4000-8000-000000000001'
const SITE = 'http://localhost:5173'
const PATH = 't/p/11111111-1111-4111-8111-111111111111.jpg'

function deps(over: Partial<Deps> = {}): Deps {
  return {
    siteUrl: SITE,
    authorize: vi.fn(async () => ({ data: { storage_path: PATH, name: 'Panorámica.jpg', mime: 'image/jpeg' }, error: null })),
    sign: vi.fn(async () => ({ url: 'https://storage.test/firmado', error: null })),
    ...over,
  }
}
const post = (body: unknown, auth = 'Bearer jwt-prueba') =>
  new Request('https://fn.test/document-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  })

describe('Edge Function document-url', () => {
  it('autoriza con el JWT del usuario y firma un enlace de 60 s', async () => {
    const d = deps()
    const res = await handleDocumentUrl(post({ document_id: DOC, action: 'view' }), d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', url: 'https://storage.test/firmado', expires_in: 60 })
    expect(d.authorize).toHaveBeenCalledWith('jwt-prueba', { p_document: DOC, p_action: 'view' })
    expect(d.sign).toHaveBeenCalledWith(PATH, LINK_SECONDS, null)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('para descargar firma con el nombre del archivo', async () => {
    const d = deps()
    await handleDocumentUrl(post({ document_id: DOC, action: 'download' }), d)
    expect(d.sign).toHaveBeenCalledWith(PATH, 60, 'Panorámica.jpg')
  })

  it('sin sesión no autoriza ni firma', async () => {
    const d = deps()
    const res = await handleDocumentUrl(post({ document_id: DOC, action: 'view' }, ''), d)
    expect(res.status).toBe(401)
    expect(d.authorize).not.toHaveBeenCalled()
    expect(d.sign).not.toHaveBeenCalled()
  })

  it('si la base no lo autoriza, NO firma', async () => {
    const d = deps({ authorize: vi.fn(async () => ({ data: null, error: { code: 'P0002' } })) })
    const res = await handleDocumentUrl(post({ document_id: DOC, action: 'view' }), d)
    expect(res.status).toBe(404)
    expect(d.sign).not.toHaveBeenCalled()
  })

  it('rechaza acciones o ids inválidos sin llamar a la base', async () => {
    const d = deps()
    expect((await handleDocumentUrl(post({ document_id: DOC, action: 'delete' }), d)).status).toBe(400)
    expect((await handleDocumentUrl(post({ document_id: 'x', action: 'view' }), d)).status).toBe(400)
    expect(d.authorize).not.toHaveBeenCalled()
  })

  it('si falla la firma, avisa', async () => {
    const d = deps({ sign: vi.fn(async () => ({ url: null, error: new Error('x') })) })
    expect((await handleDocumentUrl(post({ document_id: DOC, action: 'view' }), d)).status).toBe(502)
  })
})
