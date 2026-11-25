import type { Tables, TenantRole } from '@/lib/db'
import type { AssignableRole } from '@/lib/roles'
import { memberName } from '@/lib/doctors'
import { parseHours, type OpeningHours } from '@/lib/hours'
import { supabase } from '@/lib/supabase'

export type TeamMember = Pick<Tables<'memberships'>, 'id' | 'user_id' | 'role' | 'status' | 'created_at'> & {
  /** Nombre con el que aparece en la clínica. */
  fullName: string
  /** Nombre que puso la gerencia ('' = el de la cuenta). */
  displayName: string
  /** Nombre de su cuenta ('' si es un doctor sin acceso). */
  accountName: string
  /** ¿Puede entrar a la app? (los doctores sin acceso no tienen cuenta). */
  hasAccess: boolean
  specialty: string
  color: string | null
  phone: string | null
  /** Horario semanal propio (M6-B2a); null = usa el de la sucursal. */
  schedule: OpeningHours | null
}
export type Invitation = Pick<Tables<'invitations'>, 'id' | 'email' | 'role' | 'status' | 'expires_at' | 'created_at' | 'branch_ids' | 'membership_id'>

/** Miembros activos de la clínica con su nombre y perfil (RLS: solo compañeros). */
export async function fetchTeam(tenantId: string): Promise<TeamMember[]> {
  const { data: members, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, status, created_at, display_name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (members ?? []) as (Pick<Tables<'memberships'>, 'id' | 'user_id' | 'role' | 'status' | 'created_at' | 'display_name'>)[]
  if (rows.length === 0) return []
  const userIds = rows.map((m) => m.user_id).filter((id): id is string => Boolean(id))
  const [profilesRes, settingsRes] = await Promise.all([
    userIds.length ? supabase.from('profiles').select('id, full_name, phone_e164').in('id', userIds) : Promise.resolve({ data: [], error: null }),
    supabase.from('doctor_settings').select('membership_id, specialty, calendar_color, phone_e164, schedule').eq('tenant_id', tenantId),
  ])
  if (profilesRes.error) throw profilesRes.error
  if (settingsRes.error) throw settingsRes.error
  const profiles = new Map(((profilesRes.data ?? []) as { id: string; full_name: string; phone_e164: string | null }[]).map((p) => [p.id, p]))
  const settings = new Map(
    ((settingsRes.data ?? []) as Pick<Tables<'doctor_settings'>, 'membership_id' | 'specialty' | 'calendar_color' | 'phone_e164' | 'schedule'>[]).map((d) => [d.membership_id, d]),
  )
  return rows.map(({ display_name, ...m }) => {
    const profile = m.user_id ? profiles.get(m.user_id) : undefined
    const accountName = profile?.full_name || ''
    const s = settings.get(m.id)
    return {
      ...m,
      displayName: display_name,
      accountName,
      fullName: memberName(display_name, accountName),
      hasAccess: m.user_id !== null,
      specialty: s?.specialty ?? '',
      color: s?.calendar_color ?? null,
      // El de su perfil en la clínica; si no hay, el de su cuenta.
      phone: s?.phone_e164 ?? profile?.phone_e164 ?? null,
      schedule: s?.schedule ? parseHours(s.schedule) : null,
    }
  })
}

/** Invitaciones pendientes (RLS: solo propietario o administración). */
export async function fetchPendingInvitations(tenantId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, status, expires_at, created_at, branch_ids, membership_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as Invitation[]
}

export type InviteOutcome = 'sent' | 'existing_user' | 'email_failed'

export class InviteError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** Crea la invitación y envía el correo (Edge Function `invite-member`). */
export async function inviteMember(input: { tenantId: string; email: string; role: AssignableRole; branchIds: string[]; membershipId?: string | null }): Promise<InviteOutcome> {
  const { data, error } = await supabase.functions.invoke('invite-member', {
    body: {
      tenant_id: input.tenantId,
      email: input.email,
      role: input.role,
      branch_ids: input.branchIds,
      // Doctor sin acceso: al aceptar, su cuenta se liga a ese mismo registro.
      ...(input.membershipId ? { membership_id: input.membershipId } : {}),
    },
  })
  if (!error) return (data as { status: InviteOutcome }).status
  // 4xx/5xx: la función manda { status: 'error', code, message } o { status: 'email_failed' }.
  const ctx = (error as { context?: Response }).context
  const body = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => null)) as { status?: string; code?: string; message?: string } | null) : null
  if (body?.status === 'email_failed') return 'email_failed'
  throw new InviteError(body?.code ?? 'network', body?.message ?? 'No pudimos enviar la invitación. Revisa tu conexión y vuelve a intentarlo.')
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invitation', { p_invitation: id })
  if (error) throw error
}

export async function updateMemberRole(membershipId: string, role: Exclude<TenantRole, 'owner'>): Promise<void> {
  const { error } = await supabase.rpc('update_member_role', { p_membership: membershipId, p_role: role })
  if (error) throw error
}

export async function revokeMember(membershipId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_member', { p_membership: membershipId })
  if (error) throw error
}

/** Convierte en membresías las invitaciones vigentes del correo de la sesión. */
export async function acceptMyInvitations(): Promise<number> {
  const { data, error } = await supabase.rpc('accept_my_invitations')
  if (error) throw error
  return typeof data === 'number' ? data : 0
}
