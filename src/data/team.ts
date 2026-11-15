import type { Tables, TenantRole } from '@/lib/db'
import type { AssignableRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

export type TeamMember = Pick<Tables<'memberships'>, 'id' | 'user_id' | 'role' | 'status' | 'created_at'> & { fullName: string }
export type Invitation = Pick<Tables<'invitations'>, 'id' | 'email' | 'role' | 'status' | 'expires_at' | 'created_at' | 'branch_ids'>

/** Miembros activos de la clínica con su nombre (RLS: solo compañeros). */
export async function fetchTeam(tenantId: string): Promise<TeamMember[]> {
  const { data: members, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, status, created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (members ?? []) as Omit<TeamMember, 'fullName'>[]
  if (rows.length === 0) return []
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in(
      'id',
      rows.map((m) => m.user_id),
    )
  if (pErr) throw pErr
  const names = new Map(((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]))
  return rows.map((m) => ({ ...m, fullName: names.get(m.user_id) || 'Sin nombre' }))
}

/** Invitaciones pendientes (RLS: solo propietario o administración). */
export async function fetchPendingInvitations(tenantId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, status, expires_at, created_at, branch_ids')
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
export async function inviteMember(input: { tenantId: string; email: string; role: AssignableRole; branchIds: string[] }): Promise<InviteOutcome> {
  const { data, error } = await supabase.functions.invoke('invite-member', {
    body: { tenant_id: input.tenantId, email: input.email, role: input.role, branch_ids: input.branchIds },
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
