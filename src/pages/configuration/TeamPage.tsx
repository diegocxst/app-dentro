import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { Alert, type AlertTone } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  fetchPendingInvitations,
  fetchTeam,
  InviteError,
  inviteMember,
  revokeInvitation,
  revokeMember,
  updateMemberRole,
  type Invitation,
  type TeamMember,
} from '@/data/team'
import { clinicErrorMessage } from '@/lib/errors'
import { ASSIGNABLE_ROLES, isManager, ROLE_HINT, ROLE_LABEL, type AssignableRole } from '@/lib/roles'
import { inviteSchema, type InviteValues } from '@/lib/schemas'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

type Notice = { tone: AlertTone; text: string }

const ROLE_OPTIONS = ASSIGNABLE_ROLES.map((r) => ({ value: r, label: `${ROLE_LABEL[r]} · ${ROLE_HINT[r]}` }))
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

function outcomeNotice(out: 'sent' | 'existing_user' | 'email_failed', email: string): Notice {
  if (out === 'sent') return { tone: 'success', text: `Listo. Enviamos la invitación a ${email}.` }
  if (out === 'existing_user') return { tone: 'success', text: `${email} ya tiene cuenta en dentro. Verá tu clínica la próxima vez que entre.` }
  return { tone: 'warning', text: 'Guardamos la invitación, pero no pudimos enviar el correo. Usa «Reenviar» en un momento.' }
}

function InviteForm({ tenantId, branches, onDone }: { tenantId: string; branches: { id: string; name: string }[]; onDone: (n: Notice) => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', role: 'doctor', branchIds: [] } })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const out = await inviteMember({ tenantId, email: values.email, role: values.role, branchIds: values.branchIds })
      onDone(outcomeNotice(out, values.email))
      reset({ email: '', role: values.role, branchIds: [] })
    } catch (e) {
      onDone({ tone: 'error', text: e instanceof InviteError ? e.message : 'No pudimos enviar la invitación. Vuelve a intentarlo.' })
    }
  })

  return (
    <Card as="section" aria-label="Invita a alguien" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-subtitle">Invita a alguien</h2>
        <p className="m-0 text-caption text-ink-muted">Le llega un correo para activar su cuenta. La invitación vence en 7 días.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Correo electrónico" type="email" autoComplete="off" inputMode="email" autoCapitalize="none" error={errors.email?.message} {...register('email')} />
        <Select label="Rol" options={ROLE_OPTIONS} error={errors.role?.message} {...register('role')} />
        {branches.length > 1 && (
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 p-0 text-ui font-medium">Sucursales</legend>
            <p className="m-0 mb-1 text-caption text-ink-muted">Si no marcas ninguna, podrá trabajar en todas.</p>
            {branches.map((b) => (
              <Checkbox key={b.id} label={b.name} value={b.id} {...register('branchIds')} />
            ))}
          </fieldset>
        )}
        <Button type="submit" block size="lg" loading={isSubmitting}>
          Enviar invitación
        </Button>
      </form>
    </Card>
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
