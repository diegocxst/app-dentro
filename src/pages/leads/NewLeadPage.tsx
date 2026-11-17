import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createLead } from '@/data/leads'
import { fetchTeam, type TeamMember } from '@/data/team'
import type { PatientSource } from '@/lib/db'
import { rpcErrorMessage } from '@/lib/errors'
import { LEAD_SOURCES } from '@/lib/leads'
import { normalizePhone } from '@/lib/phone'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

const ROLE_NAMES: Record<string, string> = { owner: 'Dueña o dueño', admin: 'Administración', reception: 'Recepción' }

/** Nuevo lead (alta manual). Exige confirmar que se compartió el aviso de privacidad. */
export function NewLeadPage() {
  const { active } = useWorkspace()
  const navigate = useNavigate()
  const [team, setTeam] = useState<TeamMember[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [interest, setInterest] = useState('')
  const [source, setSource] = useState<PatientSource>('whatsapp')
  const [assignedTo, setAssignedTo] = useState(active?.id ?? '')
  const [notice, setNotice] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tenantId = active?.tenant_id ?? ''

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
  if (!['owner', 'admin', 'reception'].includes(active.role) || active.tenant.status !== 'active') {
    return <EmptyState headingLevel="h1" icon="leads" title="No puedes registrar leads" description="Los registran la dueña, la administración o recepción de una clínica activa." />
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    const phoneE164 = phone.trim() ? normalizePhone(phone) : null
    if (name.trim().length < 2) next.name = 'Escribe el nombre.'
    if (phone.trim() && !phoneE164) next.phone = 'Revisa el teléfono (10 dígitos).'
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) next.email = 'Revisa el correo.'
    if (!phoneE164 && !email.trim()) next.phone = 'Escribe un teléfono o un correo para contactarlo.'
    if (!notice) next.notice = 'Confirma que le compartiste el aviso de privacidad.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    setError(null)
    try {
      const lead = await createLead({ tenantId, fullName: name.trim(), phoneE164, email, interest, source, assignedTo: assignedTo || null, noticeShared: notice })
      navigate(`/leads/${lead.id}`)
    } catch (err) {
      setError(rpcErrorMessage(err as { code?: string }, { invalid: 'Revisa los datos del lead.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Leads"
        title="Nuevo lead"
        actions={
          <Link to="/leads" className="text-ui font-semibold text-violet">
            Volver
          </Link>
        }
      />
      <form onSubmit={(e) => void submit(e)} noValidate className="flex max-w-3xl flex-col gap-6">
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Nombre" value={name} maxLength={160} autoComplete="off" error={errors.name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Input label="Teléfono o WhatsApp" type="tel" inputMode="tel" autoComplete="off" placeholder="55 1234 5678" value={phone} error={errors.phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Correo (opcional)" type="email" autoComplete="off" value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
          <div className="sm:col-span-2">
            <Input label="¿Qué le interesa?" value={interest} maxLength={300} placeholder="Ej. Precio de ortodoncia invisible" onChange={(e) => setInterest(e.target.value)} />
          </div>
          <Select label="¿Cómo llegó?" options={LEAD_SOURCES.map(({ value, label }) => ({ value, label }))} value={source} onChange={(e) => setSource(e.target.value as PatientSource)} />
          <Select
            label="Responsable"
            options={team.map((m) => ({ value: m.id, label: `${m.fullName} · ${ROLE_NAMES[m.role] ?? m.role}` }))}
            placeholder="Sin asignar"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          />
        </Card>

        <Card className="flex flex-col gap-2">
          <Checkbox
            label={`Le compartimos el aviso de privacidad de la clínica (versión ${active.tenant.patient_notice_version}).`}
            checked={notice}
            error={errors.notice}
            onChange={(e) => setNotice(e.target.checked)}
          />
          <p className="m-0 text-caption text-ink-muted">La ley pide darlo a conocer cuando recabas datos personales. Al convertirlo en paciente se pide su consentimiento completo.</p>
        </Card>

        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            Guardar lead
          </Button>
          <Link to="/leads" className={buttonClasses('ghost')}>
            Cancelar
          </Link>
        </div>
      </form>
    </>
  )
}
