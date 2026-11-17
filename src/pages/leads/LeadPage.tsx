import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { addLeadNote, getLead, listLeadActivity, setLeadStatus, updateLead, type Lead, type LeadActivity } from '@/data/leads'
import { fetchTeam, type TeamMember } from '@/data/team'
import type { PatientSource } from '@/lib/db'
import { rpcErrorMessage } from '@/lib/errors'
import { isLate, LEAD_COLUMNS, LEAD_SOURCES, leadSource, leadStatusLabel, leadWhatsappUrl, relativeAge, type LeadStatus } from '@/lib/leads'
import { formatPhone, normalizePhone } from '@/lib/phone'
import { useWorkspace } from '@/workspace/workspace-context'

const dateTimeFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const textareaClasses = 'w-full rounded-sm border border-border bg-surface-raised p-3 text-ui text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-violet'
type Notice = { tone: 'success' | 'error'; text: string } | null

/** P12 · Detalle del lead: contacto, embudo, notas e historial. */
export function LeadPage() {
  const { id = '' } = useParams()
  const { active } = useWorkspace()
  const [lead, setLead] = useState<Lead | null | undefined>(undefined)
  const [activity, setActivity] = useState<LeadActivity[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [now] = useState(() => Date.now())
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const tenantId = active?.tenant_id

  useEffect(() => {
    let current = true
    Promise.all([getLead(id), listLeadActivity(id)]).then(
      ([l, a]) => {
        if (!current) return
        setFailed(false)
        setLead(l)
        setActivity(a)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [id, attempt])

  useEffect(() => {
    if (!tenantId) return
    let current = true
    fetchTeam(tenantId).then(
      (t) => current && setTeam(t.filter((m) => ['owner', 'admin', 'reception'].includes(m.role))),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [tenantId])

  if (!active) return null
  if (failed) return <LoadError title="No pudimos abrir el lead" onRetry={reload} />
  if (lead === undefined) return <Skeleton className="h-64 w-full" label="Abriendo el lead" />
  if (lead === null) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="leads"
        title="No encontramos este lead"
        description="Puede que no exista o que no tengas acceso: los leads los trabajan la gerencia y recepción."
        action={
          <Link to="/leads" className={buttonClasses('primary')}>
            Ir a Leads
          </Link>
        }
      />
    )
  }

  const canWrite = active.tenant.status === 'active'
  const run = async (fn: () => Promise<void>, ok: string) => {
    setNotice(null)
    try {
      await fn()
      setNotice({ tone: 'success', text: ok })
      reload()
    } catch (e) {
      setNotice({ tone: 'error', text: rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa los datos.' }) })
    }
  }
  const src = leadSource(lead.source)
  const col = LEAD_COLUMNS.find((c) => c.value === lead.status)!
  const late = isLate(lead, now)

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="text-ui text-ink-muted">
        <Link to="/leads" className="text-violet">
          Leads
        </Link>{' '}
        / {lead.full_name}
      </nav>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <Card as="section" aria-label="Datos del lead" className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-[24px] leading-8 font-bold md:text-title">{lead.full_name}</h1>
            <Badge tone={col.tone}>{col.label}</Badge>
            <Badge tone={src.badge}>{src.label}</Badge>
          </div>
          <span className="text-ui text-ink-muted">
            {[lead.phone_e164 ? formatPhone(lead.phone_e164) : null, lead.email].filter(Boolean).join(' · ')}
          </span>
          <span className={late ? 'text-ui font-semibold text-error' : 'text-ui text-ink-muted'}>
            Llegó {relativeAge(lead.created_at, now)}
            {late ? ' y nadie le ha contestado' : ''}
          </span>
          {lead.interest && <p className="m-0 text-ui">{lead.interest}</p>}
        </div>
        {lead.phone_e164 && (
          <a href={leadWhatsappUrl(lead.phone_e164, { lead: lead.full_name, clinic: active.tenant.display_name })} target="_blank" rel="noreferrer" className={buttonClasses('primary')}>
            Escribir por WhatsApp
          </a>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {canWrite && <StatusActions lead={lead} onRun={run} />}
          {canWrite && <NoteForm leadId={lead.id} onRun={run} />}
          <Card as="section" aria-labelledby="historial" className="flex flex-col gap-3">
            <h2 id="historial" className="m-0 text-subtitle">
              Historial
            </h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 border-b border-border pb-3 last:border-0 last:pb-0">
                  <span className="text-ui">{describe(a)}</span>
                  {a.body && a.kind === 'note' && <p className="m-0 text-ui whitespace-pre-line">{a.body}</p>}
                  <span className="text-caption text-ink-muted">
                    {a.actorName} · {dateTimeFmt.format(new Date(a.created_at))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <EditCard key={lead.updated_at} lead={lead} team={team} canWrite={canWrite} onRun={run} />
      </div>
    </div>
  )
}

function describe(a: LeadActivity): string {
  switch (a.kind) {
    case 'created':
      return 'Registró el lead'
    case 'status':
      return a.to_status === 'perdido' ? `Lo marcó como perdido: ${a.body ?? ''}` : `Lo movió a «${leadStatusLabel(a.to_status as LeadStatus)}»`
    case 'note':
      return 'Escribió una nota'
    case 'assigned':
      return 'Cambió al responsable'
    default:
      return 'Editó los datos'
  }
}

type Run = (fn: () => Promise<void>, ok: string) => Promise<void>

function StatusActions({ lead, onRun }: { lead: Lead; onRun: Run }) {
  const [losing, setLosing] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const move = (s: LeadStatus, ok: string, why?: string) => onRun(() => setLeadStatus(lead.id, s, why), ok)

  if (lead.status === 'convertido') {
    return (
      <Card className="flex flex-col gap-2">
        <span className="text-ui">Este lead ya es paciente.</span>
        {lead.converted_patient_id && (
          <Link to={`/pacientes/${lead.converted_patient_id}`} className={buttonClasses('secondary', 'md', 'self-start')}>
            Abrir ficha del paciente
          </Link>
        )}
      </Card>
    )
  }

  return (
    <Card as="section" aria-labelledby="seguimiento" className="flex flex-col gap-3">
      <h2 id="seguimiento" className="m-0 text-subtitle">
        Seguimiento
      </h2>
      <div className="flex flex-wrap gap-2">
        {lead.status === 'nuevo' && <Button onClick={() => void move('contactado', 'Listo. Lo marcamos como contactado.')}>Marcar contactado</Button>}
        {lead.status === 'contactado' && (
          <Button onClick={() => void move('valoracion', 'Listo. Lo pasamos a «Valoración agendada».')}>Valoración agendada</Button>
        )}
        {lead.status === 'perdido' && (
          <Button variant="secondary" onClick={() => void move('contactado', 'Reabrimos el lead.')}>
            Reabrir
          </Button>
        )}
        {lead.status !== 'perdido' && !losing && (
          <Button variant="ghost" onClick={() => setLosing(true)}>
            Marcar perdido
          </Button>
        )}
      </div>
      {lead.status === 'contactado' && <p className="m-0 text-caption text-ink-muted">Pronto podrás agendar la valoración desde aquí y convertirlo en paciente.</p>}
      {lead.status === 'perdido' && lead.lost_reason && <p className="m-0 text-ui text-ink-muted">Motivo: {lead.lost_reason}</p>}
      {losing && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Input label="¿Por qué se perdió?" value={reason} maxLength={300} placeholder="Ej. Eligió otra clínica por precio" error={error ?? undefined} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (!reason.trim()) return setError('Escribe el motivo.')
                setError(null)
                setLosing(false)
                void move('perdido', 'Marcamos el lead como perdido.', reason)
              }}
            >
              Guardar
            </Button>
            <Button variant="ghost" onClick={() => setLosing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function NoteForm({ leadId, onRun }: { leadId: string; onRun: Run }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    await onRun(() => addLeadNote(leadId, body), 'Guardamos la nota.')
    setBody('')
    setBusy(false)
  }
  return (
    <Card as="section" aria-label="Agregar nota" className="flex flex-col gap-2">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
        <label htmlFor="nota-lead" className="text-ui font-medium">
          Nueva nota
        </label>
        <textarea id="nota-lead" rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ej. Le mandé precios; quiere venir el sábado." className={textareaClasses} />
        <div>
          <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
            Guardar nota
          </Button>
        </div>
      </form>
    </Card>
  )
}

function EditCard({ lead, team, canWrite, onRun }: { lead: Lead; team: TeamMember[]; canWrite: boolean; onRun: Run }) {
  const [name, setName] = useState(lead.full_name)
  const [phone, setPhone] = useState(lead.phone_e164 ? formatPhone(lead.phone_e164) : '')
  const [email, setEmail] = useState(lead.email ?? '')
  const [interest, setInterest] = useState(lead.interest)
  const [source, setSource] = useState<PatientSource>(lead.source)
  const [error, setError] = useState<string | null>(null)

  const assign = (v: string) => void onRun(() => updateLead(lead.id, { assignedTo: v }), 'Cambiamos al responsable.')
  const save = (e: FormEvent) => {
    e.preventDefault()
    const phoneE164 = phone.trim() ? normalizePhone(phone) : ''
    if (phoneE164 === null) return setError('Revisa el teléfono.')
    if (!phoneE164 && !email.trim()) return setError('Deja un teléfono o un correo.')
    setError(null)
    const c: Parameters<typeof updateLead>[1] = {}
    if (name.trim() !== lead.full_name) c.fullName = name.trim()
    if (phoneE164 !== (lead.phone_e164 ?? '')) c.phoneE164 = phoneE164
    if (email.trim().toLowerCase() !== (lead.email ?? '')) c.email = email.trim()
    if (interest.trim() !== lead.interest) c.interest = interest.trim()
    if (source !== lead.source) c.source = source
    if (Object.keys(c).length === 0) return
    void onRun(() => updateLead(lead.id, c), 'Guardamos los datos del lead.')
  }

  return (
    <Card as="section" aria-label="Editar lead" className="flex flex-col gap-4 self-start">
      <Select
        label="Responsable"
        options={team.map((m) => ({ value: m.id, label: m.fullName }))}
        placeholder="Sin asignar"
        value={lead.assigned_to ?? ''}
        disabled={!canWrite}
        onChange={(e) => assign(e.target.value)}
      />
      <form onSubmit={save} noValidate className="flex flex-col gap-3 border-t border-border pt-4">
        <Input label="Nombre" value={name} maxLength={160} disabled={!canWrite} onChange={(e) => setName(e.target.value)} />
        <Input label="Teléfono o WhatsApp" type="tel" value={phone} disabled={!canWrite} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Correo" type="email" value={email} disabled={!canWrite} onChange={(e) => setEmail(e.target.value)} />
        <Input label="¿Qué le interesa?" value={interest} maxLength={300} disabled={!canWrite} onChange={(e) => setInterest(e.target.value)} />
        <Select label="¿Cómo llegó?" options={LEAD_SOURCES.map(({ value, label }) => ({ value, label }))} value={source} disabled={!canWrite} onChange={(e) => setSource(e.target.value as PatientSource)} />
        {error && (
          <p role="alert" className="m-0 text-caption text-error">
            {error}
          </p>
        )}
        {canWrite && (
          <div>
            <Button type="submit" variant="secondary" size="sm">
              Guardar cambios
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}
