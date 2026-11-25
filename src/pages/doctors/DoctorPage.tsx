import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { outcomeNotice, type Notice } from '@/components/team/notice'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { HoursEditor } from '@/components/catalog/HoursEditor'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { commissionSummary } from '@/data/commissions'
import { setDoctorSchedule, updateDoctorProfile } from '@/data/doctors'
import { fetchPendingInvitations, fetchTeam, inviteMember, type Invitation, type TeamMember } from '@/data/team'
import { DEFAULT_TZ, todayIn } from '@/lib/agenda'
import { cn } from '@/lib/cn'
import { recentPeriods, schemeLabel, type CommissionRow } from '@/lib/commissions'
import { DOCTOR_COLORS, doctorColorClass, initials, TREATING_ROLES, type DoctorColor, type OfflineRole } from '@/lib/doctors'
import { rpcErrorMessage } from '@/lib/errors'
import { formatPhone } from '@/lib/phone'
import { isManager, ROLE_LABEL } from '@/lib/roles'
import { isTreating } from '@/lib/access'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'
import { ColorPicker } from './ColorPicker'
import { checkDoctorForm, EMAIL_RE, type DoctorFormErrors, type DoctorFormValues } from './doctorForm'
import { SchemeForm } from './SchemeForm'

/** P27 · Perfil del doctor: nombre en la clínica, especialidad, color, acceso y comisión. */
export function DoctorPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { active, branches, activeBranchId } = useWorkspace()
  const tenantId = active?.tenant_id
  const manager = isManager(active?.role) && active?.tenant.status === 'active'
  const [member, setMember] = useState<TeamMember | null | undefined>(undefined)
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState<Notice | null>((location.state as { notice?: Notice } | null)?.notice ?? null)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!tenantId) return
    let current = true
    fetchTeam(tenantId).then(
      (team) => {
        if (!current) return
        const doctors = team.filter((m) => TREATING_ROLES.includes(m.role))
        setFailed(false)
        setIndex(Math.max(0, doctors.findIndex((m) => m.id === id)))
        setMember(doctors.find((m) => m.id === id) ?? null)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, id, attempt])

  if (!active) return null
  // Un doctor solo abre su propio perfil (el directorio está en «Tu equipo»).
  if (isTreating(active.role) && id !== active.id) return <Navigate to="/equipo" replace />
  if (failed) return <LoadError title="No pudimos cargar al doctor" onRetry={reload} />
  if (member === undefined) return <Skeleton className="h-96 w-full" label="Cargando doctor" />
  if (member === null) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="doctores"
        title="No encontramos a este doctor"
        description="Puede que ya no sea parte de tu equipo."
        action={<Link to="/doctores" className="font-semibold text-violet">Ver doctores</Link>}
      />
    )
  }

  const tz = branches.find((b) => b.id === activeBranchId)?.timezone ?? DEFAULT_TZ
  const isMe = member.id === active.id
  const kind = active.tenant.commission_period === 'mensual' ? 'mensual' : 'quincenal'
  const color = DOCTOR_COLORS.find((c) => c.value === member.color)

  return (
    <>
      <PageHeader eyebrow="Tu equipo" title={member.fullName} actions={<Link to="/doctores" className="text-ui font-semibold text-violet">Volver</Link>} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <span aria-hidden="true" className={cn('grid size-12 shrink-0 place-items-center rounded-pill font-semibold text-on-night', doctorColorClass(member.color, index))}>
            {initials(member.fullName)}
          </span>
          <span className="flex flex-col">
            <span className="text-ui text-ink-muted">{[ROLE_LABEL[member.role], member.specialty].filter(Boolean).join(' · ')}</span>
            <span>
              <Badge tone={member.hasAccess ? 'success' : 'neutral'}>{member.hasAccess ? 'Con acceso a la app' : 'Sin acceso'}</Badge>
            </span>
          </span>
        </div>
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {manager ? (
            <ProfileForm key={`${member.id}-${attempt}`} member={member} onSaved={(n) => (setNotice(n), reload())} />
          ) : (
            <Card as="section" aria-labelledby="perfil-titulo" className="flex flex-col gap-3">
              <h2 id="perfil-titulo" className="m-0 text-subtitle">
                Perfil
              </h2>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-ui">
                <dt className="text-ink-muted">Especialidad</dt>
                <dd className="m-0">{member.specialty || '—'}</dd>
                <dt className="text-ink-muted">Color en la agenda</dt>
                <dd className="m-0">{color?.label ?? 'Automático'}</dd>
                {member.phone && (
                  <>
                    <dt className="text-ink-muted">Teléfono</dt>
                    <dd className="m-0">{formatPhone(member.phone)}</dd>
                  </>
                )}
              </dl>
            </Card>
          )}

          <div className="flex flex-col gap-6">
            <ScheduleCard
              key={`horario-${member.id}-${attempt}`}
              member={member}
              canEdit={(manager || isMe) && active.tenant.status === 'active'}
              onSaved={(n) => (setNotice(n), reload())}
            />
            {manager && !member.hasAccess && <AccessCard member={member} tenantId={active.tenant_id} onNotice={setNotice} />}
            {member.role !== 'owner' && (manager || isMe) && (
              <CommissionCard member={member} tenantId={active.tenant_id} period={recentPeriods(todayIn(tz), kind, 1)[0]!} canManage={manager} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function ProfileForm({ member, onSaved }: { member: TeamMember; onSaved: (n: Notice) => void }) {
  const [values, setValues] = useState<DoctorFormValues>({
    name: member.displayName,
    specialty: member.specialty,
    color: (member.color as DoctorColor | null) ?? null,
    phone: member.phone ? formatPhone(member.phone) : '',
  })
  const [errors, setErrors] = useState<DoctorFormErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<DoctorFormValues>) => setValues((v) => ({ ...v, ...patch }))

  const save = async () => {
    setError(null)
    const { errors: errs, input } = checkDoctorForm(values, member.hasAccess)
    setErrors(errs)
    if (!input) return
    setBusy(true)
    try {
      await updateDoctorProfile(member.id, input)
      onSaved({ tone: 'success', text: 'Listo. Guardamos el perfil.' })
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa los datos del doctor.' }))
      setBusy(false)
    }
  }

  return (
    <Card as="section" aria-labelledby="perfil-titulo">
      <form
        aria-label="Perfil del doctor"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="flex flex-col gap-4"
      >
        <h2 id="perfil-titulo" className="m-0 text-subtitle">
          Perfil
        </h2>
        <Input
          label="Nombre en tu clínica"
          value={values.name}
          maxLength={120}
          placeholder={member.accountName || 'Ej. Dra. Ana Pérez'}
          error={errors.name}
          hint={
            member.hasAccess
              ? `Así aparece en tu agenda, presupuestos y comisiones. Si lo dejas vacío, usamos el de su cuenta: ${member.accountName || 'sin nombre'}.`
              : 'Así aparece en tu agenda, presupuestos y comisiones.'
          }
          onChange={(e) => set({ name: e.target.value })}
        />
        <Input label="Especialidad (opcional)" value={values.specialty} maxLength={80} placeholder="Ej. Ortodoncia" error={errors.specialty} onChange={(e) => set({ specialty: e.target.value })} />
        <ColorPicker value={values.color} onChange={(color) => set({ color })} />
        <Input label="Teléfono (opcional)" type="tel" inputMode="tel" value={values.phone} error={errors.phone} onChange={(e) => set({ phone: e.target.value })} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" variant="secondary" loading={busy} className="self-start">
          Guardar perfil
        </Button>
      </form>
    </Card>
  )
}

function AccessCard({ member, tenantId, onNotice }: { member: TeamMember; tenantId: string; onNotice: (n: Notice) => void }) {
  const [pending, setPending] = useState<Invitation | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    fetchPendingInvitations(tenantId).then(
      (list) => current && setPending(list.find((i) => i.membership_id === member.id) ?? null),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [tenantId, member.id, version])

  const invite = async (to: string) => {
    const mail = to.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) return setError('Revisa el correo.')
    setError(undefined)
    setBusy(true)
    try {
      onNotice(outcomeNotice(await inviteMember({ tenantId, email: mail, role: member.role as OfflineRole, branchIds: [], membershipId: member.id }), mail))
      setEmail('')
      setVersion((v) => v + 1)
    } catch (e) {
      onNotice({ tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="section" aria-labelledby="acceso-titulo" className="flex flex-col gap-3">
      <h2 id="acceso-titulo" className="m-0 text-subtitle">
        Acceso a la app
      </h2>
      <p className="m-0 text-ui text-ink-muted">
        No entra a la app. Si tiene correo, invítalo: al aceptar conserva sus pacientes, citas, presupuestos y comisiones.
      </p>
      {pending && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-lavender p-3">
          <span className="grow text-ui">
            Invitación pendiente a <span className="font-semibold">{pending.email}</span>
          </span>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void invite(pending.email)}>
            Reenviar
          </Button>
        </div>
      )}
      <form
        aria-label="Invitar al doctor"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void invite(email)
        }}
        className="flex flex-col gap-3"
      >
        <Input label="Correo del doctor" type="email" inputMode="email" value={email} error={error} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" loading={busy} className="self-start">
          {pending ? 'Invitar a otro correo' : 'Enviar invitación'}
        </Button>
      </form>
    </Card>
  )
}

function CommissionCard({ member, tenantId, period, canManage }: { member: TeamMember; tenantId: string; period: { from: string; to: string }; canManage: boolean }) {
  const [row, setRow] = useState<CommissionRow | null | undefined>(undefined)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    commissionSummary(tenantId, period.from, period.to).then(
      (rows) => current && setRow(rows.find((r) => r.doctor_id === member.id) ?? null),
      () => current && setRow(null),
    )
    return () => {
      current = false
    }
  }, [tenantId, member.id, period.from, period.to, version])

  return (
    <Card as="section" aria-labelledby="comision-perfil-titulo" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="comision-perfil-titulo" className="m-0 text-subtitle">
          Comisión
        </h2>
        <Link to={`/doctores/comisiones?doctor=${member.id}`} className="text-ui font-semibold text-violet">
          Ver comisiones
        </Link>
      </div>
      {row === undefined ? (
        <Skeleton className="h-24 w-full" label="Cargando comisión" />
      ) : !row ? (
        <p className="m-0 text-ui text-ink-muted">No pudimos cargar su esquema.</p>
      ) : (
        <>
          <p className="m-0 text-ui">{schemeLabel(row)}</p>
          {canManage && <SchemeForm key={`${row.scheme_kind}-${row.percent}-${row.rent_amount}`} row={row} onSaved={() => setVersion((v) => v + 1)} />}
        </>
      )}
    </Card>
  )
}

/** Horario del doctor (M6-B2a): no deja agendar fuera de él. Lo cambian la gerencia y el propio doctor. */
function ScheduleCard({ member, canEdit, onSaved }: { member: TeamMember; canEdit: boolean; onSaved: (n: Notice) => void }) {
  return (
    <Card as="section" aria-labelledby="horario-titulo" className="flex flex-col gap-3">
      <h2 id="horario-titulo" className="m-0 text-subtitle">
        Horario
      </h2>
      <p className="m-0 text-caption text-ink-muted">Fuera de este horario no se le pueden agendar citas. Si no tiene, se usa el de la sucursal.</p>
      <HoursEditor
        branchName={member.fullName}
        title="Atiende"
        legend={`Horario de ${member.fullName}`}
        maxRanges={2}
        emptySummary="Sin horario propio: usa el de la sucursal"
        closedLabel="No atiende"
        initial={member.schedule ?? {}}
        canEdit={canEdit}
        onSave={async (hours) => {
          const empty = !Object.values(hours).some((r) => r?.length)
          await setDoctorSchedule(member.id, empty ? null : hours)
          onSaved({ tone: 'success', text: empty ? 'Quitamos el horario: se usará el de la sucursal.' : 'Guardamos el horario.' })
        }}
      />
    </Card>
  )
}
