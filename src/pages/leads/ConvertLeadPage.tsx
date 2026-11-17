import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { convertLead, getLead, leadPatientMatches, type Lead, type PatientMatch } from '@/data/leads'
import { useDoctors } from '@/hooks/useDoctors'
import type { ConsentMethod } from '@/lib/db'
import { rpcErrorMessage } from '@/lib/errors'
import { leadSource } from '@/lib/leads'
import { formatPhone } from '@/lib/phone'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

/** P13 · Convertir lead en paciente: con su consentimiento, o vinculado a una ficha existente. */
export function ConvertLeadPage() {
  const { id = '' } = useParams()
  const { active } = useWorkspace()
  const navigate = useNavigate()
  const doctors = useDoctors(active?.tenant_id)
  const [lead, setLead] = useState<Lead | null | undefined>(undefined)
  const [matches, setMatches] = useState<PatientMatch[]>([])
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [method, setMethod] = useState<ConsentMethod>('papel')
  const [given, setGiven] = useState(false)
  const [birthDate, setBirthDate] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [consentError, setConsentError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    Promise.all([getLead(id), leadPatientMatches(id).catch(() => [] as PatientMatch[])]).then(
      ([l, m]) => {
        if (!current) return
        setFailed(false)
        setLead(l)
        setMatches(m)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [id, attempt])

  if (!active) return null
  if (failed) return <LoadError title="No pudimos abrir el lead" onRetry={() => setAttempt((n) => n + 1)} />
  if (lead === undefined) return <Skeleton className="h-64 w-full" label="Abriendo el lead" />
  if (lead === null || active.tenant.status !== 'active') {
    return (
      <EmptyState
        headingLevel="h1"
        icon="leads"
        title="No puedes convertir este lead"
        description="Puede que no exista, que no tengas acceso o que tu clínica esté en solo lectura."
        action={
          <Link to="/leads" className={buttonClasses('primary')}>
            Ir a Leads
          </Link>
        }
      />
    )
  }
  if (lead.status === 'convertido' && lead.converted_patient_id) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="pacientes"
        title="Este lead ya es paciente"
        description="Sus citas y datos ya están en su ficha."
        action={
          <Link to={`/pacientes/${lead.converted_patient_id}`} className={buttonClasses('primary')}>
            Abrir ficha del paciente
          </Link>
        }
      />
    )
  }

  const run = async (fn: () => Promise<{ id: string }>) => {
    setBusy(true)
    setError(null)
    try {
      const p = await fn()
      navigate(`/pacientes/${p.id}`)
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa los datos del paciente.' }))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!given) {
      setConsentError('Sin el consentimiento del paciente no podemos guardar sus datos de salud.')
      return
    }
    setConsentError(undefined)
    void run(() => convertLead(lead.id, { consentMethod: method, birthDate, primaryDoctorId: doctorId }))
  }

  return (
    <>
      <PageHeader
        eyebrow="Leads"
        title="Convertir en paciente"
        description={`${lead.full_name} pasa a ser paciente de ${active.tenant.display_name}. Sus citas se van a su ficha.`}
        actions={
          <Link to={`/leads/${lead.id}`} className="text-ui font-semibold text-violet">
            Volver
          </Link>
        }
      />

      <div className="flex max-w-3xl flex-col gap-6">
        {matches.length > 0 && (
          <Card as="section" aria-labelledby="coincidencias" className="flex flex-col gap-3 border-warning">
            <h2 id="coincidencias" className="m-0 text-subtitle">
              Ya existe un paciente con este teléfono o correo
            </h2>
            <p className="m-0 text-caption text-ink-muted">Si es la misma persona, vincúlalo para no duplicar su ficha. Ya tiene su consentimiento.</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {matches.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                  <span className="flex flex-col">
                    <span className="text-ui font-semibold">{m.full_name}</span>
                    <span className="text-caption text-ink-muted">{[m.phone_e164 ? formatPhone(m.phone_e164) : null, m.email].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Button variant="secondary" size="sm" loading={busy} onClick={() => void run(() => convertLead(lead.id, { existingPatientId: m.id }))}>
                    Vincular con {m.full_name.split(' ')[0]}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <Card as="section" aria-label="Datos del nuevo paciente" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-ui font-semibold">{lead.full_name}</span>
              <span className="text-caption text-ink-muted">
                {[lead.phone_e164 ? formatPhone(lead.phone_e164) : null, lead.email, `Llegó por: ${leadSource(lead.source).label}`].filter(Boolean).join(' · ')}
              </span>
            </div>
            <Input label="Fecha de nacimiento (opcional)" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            <Select
              label="Doctor tratante"
              options={doctors.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Sin asignar"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            />
          </Card>

          <Card as="section" aria-label="Consentimiento" className="flex flex-col gap-3">
            <h2 className="m-0 text-subtitle">Consentimiento del paciente</h2>
            <p className="m-0 text-ui text-ink-muted">
              Sus datos de salud son sensibles. Antes de guardarlos, el paciente debe aceptar el aviso de privacidad de {active.tenant.display_name} (versión{' '}
              {active.tenant.patient_notice_version}).
            </p>
            <fieldset className="m-0 flex flex-wrap gap-4 border-0 p-0">
              <legend className="sr-only">Cómo lo aceptó</legend>
              {(['papel', 'digital'] as const).map((m) => (
                <label key={m} className="flex min-h-11 items-center gap-2 text-ui">
                  <input type="radio" name="consentimiento" value={m} checked={method === m} onChange={() => setMethod(m)} className="size-5 accent-violet" />
                  {m === 'papel' ? 'Firmó en papel' : 'Aceptó en digital'}
                </label>
              ))}
            </fieldset>
            <Checkbox
              label="Confirmo que el paciente dio su consentimiento expreso para tratar sus datos personales y de salud."
              checked={given}
              error={consentError}
              onChange={(e) => setGiven(e.target.checked)}
            />
          </Card>

          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              Convertir en paciente
            </Button>
            <Link to={`/leads/${lead.id}`} className={buttonClasses('ghost')}>
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </>
  )
}
