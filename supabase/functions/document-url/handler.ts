// Lógica de la Edge Function `document-url` (sin dependencias de Deno: se prueba con Vitest).
//
// 1. Exige la sesión del usuario (JWT).
// 2. Con ESE JWT llama a `authorize_document_access`: la base revisa el permiso y
//    REGISTRA el acceso en la bitácora. Si no puede verlo, no hay enlace.
// 3. Solo entonces firma un enlace de 60 s con la clave de servicio (el bucket es
//    privado y no tiene política de lectura).
// Nunca registra nombres de archivo, rutas, tokens ni datos del paciente.

export const LINK_SECONDS = 60

export type AuthorizeResult = { storage_path: string; name: string; mime: string }
export type RpcError = { code?: string | undefined; message?: string | undefined } | null

export type Deps = {
  siteUrl: string
  authorize: (jwt: string, args: { p_document: string; p_action: 'view' | 'download' }) => Promise<{ data: AuthorizeResult | null; error: RpcError }>
  sign: (path: string, seconds: number, downloadName: string | null) => Promise<{ url: string | null; error: unknown }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Body = { status: 'ok'; url: string; expires_in: number } | { status: 'error'; code: string; message: string }

function json(body: Body, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Cache-Control': 'no-store' },
  })
}

const fail = (status: number, code: string, message: string, origin: string) => json({ status: 'error', code, message }, status, origin)

export async function handleDocumentUrl(req: Request, deps: Deps): Promise<Response> {
  const origin = deps.siteUrl
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        Vary: 'Origin',
      },
    })
  }
  if (req.method !== 'POST') return fail(405, 'method', 'Método no permitido.', origin)

  const jwt = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1]
  if (!jwt) return fail(401, 'session', 'Tu sesión expiró. Vuelve a entrar.', origin)

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return fail(400, 'invalid', 'Solicitud inválida.', origin)
  }
  const document = typeof body.document_id === 'string' ? body.document_id : ''
  const action = body.action === 'download' ? 'download' : body.action === 'view' ? 'view' : null
  if (!UUID.test(document) || !action) return fail(400, 'invalid', 'Solicitud inválida.', origin)

  const { data, error } = await deps.authorize(jwt, { p_document: document, p_action: action })
  if (error || !data) {
    if (error?.code === 'P0002') return fail(404, 'not_found', 'No encontramos este documento o no tienes acceso.', origin)
    if (error?.code === '28000') return fail(401, 'session', 'Tu sesión expiró. Vuelve a entrar.', origin)
    return fail(500, 'server', 'No pudimos abrir el documento. Vuelve a intentarlo.', origin)
  }

  const signed = await deps.sign(data.storage_path, LINK_SECONDS, action === 'download' ? data.name : null)
  if (signed.error || !signed.url) return fail(502, 'sign', 'No pudimos abrir el documento. Vuelve a intentarlo.', origin)
  return json({ status: 'ok', url: signed.url, expires_in: LINK_SECONDS }, 200, origin)
}
