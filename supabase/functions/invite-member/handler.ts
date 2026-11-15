// Lógica de la Edge Function `invite-member` (sin dependencias de Deno: se prueba con Vitest).
//
// 1. Exige la sesión de quien invita (JWT del usuario).
// 2. Crea la invitación con la RPC `create_invitation` USANDO ESE JWT: la base valida
//    rol, clínica activa y sucursales (la función nunca decide permisos).
// 3. Solo entonces envía el correo con la API de administración (clave de servicio,
//    que vive únicamente en el servidor de Supabase).
// Nunca registra correos, tokens ni datos personales en los logs.

export type RpcError = { code?: string | undefined; message?: string | undefined } | null
export type InviteError = { code?: string | undefined; status?: number | undefined; message?: string | undefined } | null

export type Deps = {
  /** URL pública de la app (p. ej. http://localhost:5173), sin «/» final. */
  siteUrl: string
  /** Llama a `create_invitation` como el usuario dueño del JWT. */
  createInvitation: (
    jwt: string,
    args: { p_tenant: string; p_email: string; p_role: string; p_branch_ids: string[] },
  ) => Promise<{ data: { id: string } | null; error: RpcError }>
  /** Envía la invitación de Supabase Auth (clave de servicio). */
  sendInvite: (email: string, redirectTo: string) => Promise<{ error: InviteError }>
}

export type InviteResult =
  | { status: 'sent'; invitation_id: string }
  | { status: 'existing_user'; invitation_id: string }
  | { status: 'email_failed'; invitation_id: string }
  | { status: 'error'; code: string; message: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROLES = new Set(['admin', 'reception', 'doctor', 'doctor_collab'])

function json(body: InviteResult, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    },
  })
}

const fail = (status: number, code: string, message: string, origin: string) => json({ status: 'error', code, message }, status, origin)

/** SQLSTATE de la RPC → estado HTTP y mensaje para la app. */
function rpcFailure(error: NonNullable<RpcError>, origin: string): Response {
  switch (error.code) {
    case '28000':
      return fail(401, 'session', 'Tu sesión expiró. Vuelve a entrar.', origin)
    case '42501':
      return fail(403, 'forbidden', 'No tienes permiso para invitar en esta clínica.', origin)
    case '23505':
      return fail(409, 'already_member', 'Esa persona ya es parte de tu equipo.', origin)
    case '22023':
    case '23514':
      return fail(400, 'invalid', 'Revisa el correo, el rol y las sucursales.', origin)
    default:
      return fail(500, 'server', 'No pudimos crear la invitación. Vuelve a intentarlo.', origin)
  }
}

/** ¿Supabase Auth dice que el correo ya tiene cuenta? */
export function isExistingUser(error: NonNullable<InviteError>): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return error.code === 'email_exists' || error.code === 'user_already_exists' || msg.includes('already been registered')
}

export async function handleInvite(req: Request, deps: Deps): Promise<Response> {
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

  const tenant = typeof body.tenant_id === 'string' ? body.tenant_id : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = typeof body.role === 'string' ? body.role : ''
  const branches = Array.isArray(body.branch_ids) ? body.branch_ids : []
  if (
    !UUID.test(tenant) ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    email.length > 254 ||
    !ROLES.has(role) ||
    branches.length > 50 ||
    !branches.every((b) => typeof b === 'string' && UUID.test(b))
  ) {
    return fail(400, 'invalid', 'Revisa el correo, el rol y las sucursales.', origin)
  }

  const { data, error } = await deps.createInvitation(jwt, {
    p_tenant: tenant,
    p_email: email,
    p_role: role,
    p_branch_ids: branches as string[],
  })
  if (error || !data) return rpcFailure(error ?? {}, origin)

  const sent = await deps.sendInvite(email, `${deps.siteUrl}/auth/invitacion`)
  if (!sent.error) return json({ status: 'sent', invitation_id: data.id }, 200, origin)
  // Ya tiene cuenta: verá la clínica la próxima vez que entre (accept_my_invitations).
  if (isExistingUser(sent.error)) return json({ status: 'existing_user', invitation_id: data.id }, 200, origin)
  // La invitación queda pendiente; se puede reenviar.
  return json({ status: 'email_failed', invitation_id: data.id }, 502, origin)
}
