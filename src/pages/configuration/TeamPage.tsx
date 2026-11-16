import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { InviteForm } from '@/components/team/InviteForm'
import { outcomeNotice, type Notice } from '@/components/team/notice'
import {
  fetchPendingInvitations,
  fetchTeam,
  inviteMember,
  revokeInvitation,
  revokeMember,
  updateMemberRole,
  type Invitation,
  type TeamMember,
} from '@/data/team'
import { clinicErrorMessage } from '@/lib/errors'
import { ASSIGNABLE_ROLES, isManager, ROLE_LABEL, type AssignableRole } from '@/lib/roles'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })

/** Tu equipo (E1-B5c): invitar, cambiar rol y quitar. Solo propietario o administración gestionan. */
export function TeamPage() {
  const { active, branches } = useWorkspace()
  const { user } = useAuth()
  const tenantId = active?.tenant_id ?? ''
  const manager = isManager(active?.role)
  const [team, setTeam] = useState<TeamMember[] | null>(null)
  const [invites, setInvites] = useState<Invitation[]>([])
  const [loadError, setLoadError] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!tenantId) return
    let current = true
    Promise.all([fetchTeam(tenantId), manager ? fetchPendingInvitations(tenantId) : Promise.resolve([])]).then(
      ([t, i]) => {
        if (!current) return
        setTeam(t)
        setInvites(i)
        setLoadError(false)
      },
      () => current && setLoadError(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, manager, version])

  const run = async (action: () => Promise<unknown>, ok: string) => {
    setNotice(null)
    try {
      await action()
      setNotice({ tone: 'success', text: ok })
      reload()
    } catch (e) {
      setNotice({ tone: 'error', text: clinicErrorMessage(e as { code?: string }) })
    }
  }

  return (
    <>
      <PageHeader eyebrow="Configuración" title="Tu equipo" actions={<Link to="/configuracion" className="text-ui font-semibold text-violet">Volver</Link>} />
      <div className="flex flex-col gap-6">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        {!manager && <Alert tone="info">Solo la dueña, el dueño o la administración pueden invitar y cambiar el equipo.</Alert>}
        {loadError && (
          <Alert tone="error" title="No pudimos cargar tu equipo">
            Revisa tu conexión.{' '}
            <button type="button" className="font-semibold underline" onClick={reload}>
              Volver a intentar
            </button>
          </Alert>
        )}

        <div className="flex flex-wrap items-start gap-6">
          {manager && (
            <InviteForm
              tenantId={tenantId}
              branches={branches}
              onDone={(n) => {
                setNotice(n)
                reload()
              }}
            />
          )}

          <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-6">
            <Card as="section" aria-label="Equipo" className="flex flex-col gap-1">
              <h2 className="m-0 mb-2 text-subtitle">Equipo</h2>
              {team === null && !loadError ? (
                <div className="flex flex-col gap-3" aria-hidden="true">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {(team ?? []).map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      editable={manager && m.role !== 'owner' && m.user_id !== user?.id}
                      isMe={m.user_id === user?.id}
                      onRole={(role) => void run(() => updateMemberRole(m.id, role), `Cambiamos el rol de ${m.fullName}.`)}
                      onRevoke={() => void run(() => revokeMember(m.id), `${m.fullName} ya no es parte de tu equipo.`)}
                    />
                  ))}
                </ul>
              )}
            </Card>

            {manager && (
              <Card as="section" aria-label="Invitaciones pendientes" className="flex flex-col gap-1">
                <h2 className="m-0 mb-2 text-subtitle">Invitaciones pendientes</h2>
                {invites.length === 0 ? (
                  <p className="m-0 text-ui text-ink-muted">No hay invitaciones pendientes.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col p-0">
                    {invites.map((inv) => (
                      <li key={inv.id} className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0">
                        <div className="flex min-w-0 grow flex-col gap-0.5">
                          <span className="truncate text-ui font-semibold">{inv.email}</span>
                          <span className="text-caption text-ink-muted">
                            {ROLE_LABEL[inv.role]} · vence el {dateFmt.format(new Date(inv.expires_at))}
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void (async () => {
                              setNotice(null)
                              try {
                                const out = await inviteMember({ tenantId, email: inv.email, role: inv.role as AssignableRole, branchIds: inv.branch_ids })
                                setNotice(outcomeNotice(out, inv.email))
                                reload()
                              } catch (e) {
                                setNotice({ tone: 'error', text: (e as Error).message })
                              }
                            })()
                          }
                        >
                          Reenviar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void run(() => revokeInvitation(inv.id), 'Cancelamos la invitación.')}>
                          Cancelar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function MemberRow({
  member,
  editable,
  isMe,
  onRole,
  onRevoke,
}: {
  member: TeamMember
  editable: boolean
  isMe: boolean
  onRole: (role: AssignableRole) => void
  onRevoke: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0">
      <div className="flex min-w-0 grow flex-col gap-1">
        <span className="truncate text-ui font-semibold">
          {member.fullName}
          {isMe && <span className="font-normal text-ink-muted"> (tú)</span>}
        </span>
        {!editable && (
          <span>
            <Badge tone={member.role === 'owner' ? 'violet' : 'neutral'}>{ROLE_LABEL[member.role]}</Badge>
          </span>
        )}
      </div>
      {editable && (
        <>
          <div className="w-56">
            <Select
              label={`Rol de ${member.fullName}`}
              className="text-ui"
              options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              value={member.role}
              onChange={(e) => onRole(e.target.value as AssignableRole)}
            />
          </div>
          {confirming ? (
            <span className="flex items-center gap-2">
              <Button variant="danger" size="sm" onClick={onRevoke}>
                Sí, quitar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                No
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              Quitar
            </Button>
          )}
        </>
      )}
    </li>
  )
}
