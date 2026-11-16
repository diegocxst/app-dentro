import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { agendaErrorMessage, createAppointment, getAppointment, getPatientName, updateAppointment, type Appointment } from '@/data/agenda'
import { fetchChairs, fetchTreatments, type Chair, type Treatment } from '@/data/catalog'
import { listPatients, type PatientListItem } from '@/data/patients'
import { useDebounced } from '@/hooks/useDebounced'
import { useDoctors } from '@/hooks/useDoctors'
import {
  APPOINTMENT_KINDS,
  DEFAULT_TZ,
  DURATIONS,
  hoursFor,
  OUT_OF_HOURS,
  startOptions,
  todayIn,
  toMinutes,
  fromMinutes,
  withinHours,
  zonedParts,
  zonedToUtc,
  type AppointmentKind,
  type Hours,
} from '@/lib/agenda'
import { formatPhone } from '@/lib/phone'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

const textareaClasses = 'w-full rounded-sm border border-border bg-surface-raised p-3 text-ui text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-violet'

/** P09 · Nueva cita (/agenda/nueva) y reagendar (/agenda/:id/editar). */
export function AppointmentFormPage() {
  const { id } = useParams()
  const { active } = useWorkspace()
  const [existing, setExisting] = useState<Appointment | null | undefined>(id ? undefined : null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!id) return
    let current = true
    getAppointment(id).then(
      (a) => current && setExisting(a),
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [id])

  if (!active) return null
  if (active.tenant.status !== 'active') {
    return <EmptyState headingLevel="h1" icon="agenda" title="Tu clínica está en solo lectura" description="Mientras esté suspendida no se pueden agendar ni mover citas." />
  }
  if (failed) return <LoadError title="No pudimos abrir la cita" onRetry={() => window.location.reload()} />
  if (existing === undefined) return <Skeleton className="h-96 w-full" label="Abriendo la cita" />
  if (id && existing === null) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="agenda"
        title="No encontramos esta cita"
        description="Puede que no exista o que no tengas acceso."
        action={
          <Link to="/agenda" className={buttonClasses('primary')}>
            Ir a la agenda
          </Link>
        }
      />
    )
  }
  return <AppointmentForm existing={existing} />
}

function AppointmentForm({ existing }: { existing: Appointment | null }) {
  const { active, branches, activeBranchId } = useWorkspace()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tenantId = active?.tenant_id ?? ''
  const isDoctor = active?.role === 'doctor' || active?.role === 'doctor_collab'
  const doctors = useDoctors(tenantId)
  const [chairs, setChairs] = useState<Chair[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])

  // La sucursal se calcula en cada render: al abrir la URL directo, el espacio de trabajo
  // puede terminar de cargar las sucursales después del primer render.
  const [pickedBranch, setPickedBranch] = useState<string | null>(null)
  const branchId = pickedBranch ?? existing?.branch_id ?? activeBranchId ?? branches[0]?.id ?? ''
  const branch = branches.find((b) => b.id === branchId) ?? null
  const tz = branch?.timezone ?? DEFAULT_TZ
  const startLocal = existing ? zonedParts(new Date(existing.starts_at), tz) : null
  const initialDuration = existing ? Math.round((new Date(existing.ends_at).getTime() - new Date(existing.starts_at).getTime()) / 60000) : 60

  const [patient, setPatient] = useState<{ id: string; name: string } | null>(existing ? { id: existing.patient_id, name: '' } : null)
  const [doctorId, setDoctorId] = useState(existing?.doctor_id ?? (isDoctor ? (active?.id ?? '') : (params.get('doctor') ?? '')))
  const [chairId, setChairId] = useState(existing?.chair_id ?? '')
  const [treatmentId, setTreatmentId] = useState(existing?.treatment_id ?? '')
  const [kind, setKind] = useState<AppointmentKind>(existing?.kind ?? 'tratamiento')
  const [date, setDate] = useState(startLocal?.date ?? params.get('fecha') ?? todayIn(tz))
  const [duration, setDuration] = useState(initialDuration)
  const [time, setTime] = useState(startLocal?.time ?? params.get('hora') ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [outOfHours, setOutOfHours] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    let current = true
    Promise.all([fetchChairs(tenantId), fetchTreatments(tenantId)]).then(
      ([c, t]) => {
        if (!current) return
        setChairs(c)
        setTreatments(t.filter((x) => x.is_active))
      },
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [tenantId])

  // Paciente que viene de la ficha (?paciente=) o de la cita que se reagenda.
  const presetPatient = existing?.patient_id ?? params.get('paciente')
  useEffect(() => {
    if (!presetPatient) return
    let current = true
    getPatientName(presetPatient).then(
      (name) => current && name && setPatient({ id: presetPatient, name }),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [presetPatient])

  const branchChairs = chairs.filter((c) => c.branch_id === branchId && (c.is_active || c.id === existing?.chair_id))
  const ranges = hoursFor(branch?.opening_hours as Hours | null, date)
  const options = startOptions(ranges, duration)
  const timeOptions = time && !options.includes(time) ? [time, ...options].sort() : options
  const doctorOptions = isDoctor ? doctors.filter((d) => d.id === active?.id) : doctors

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setOutOfHours(false)
    if (!patient) return setError('Elige al paciente.')
    if (!doctorId) return setError('Elige al doctor.')
    if (!chairId) return setError('Elige el sillón.')
    if (!time) return setError('Elige la hora.')
    const endTime = fromMinutes(toMinutes(time) + duration)
    if (!withinHours(ranges, time, endTime)) {
      setOutOfHours(true)
      return setError(OUT_OF_HOURS)
    }
    if (!branch) return setError('Elige la sucursal.')
    const input = {
      patientId: patient.id,
      doctorId,
      branchId,
      chairId,
      startsAt: zonedToUtc(date, time, tz),
      endsAt: zonedToUtc(date, endTime, tz),
      kind,
      treatmentId: treatmentId || null,
      notes,
    }
    setBusy(true)
    try {
      const saved = existing ? await updateAppointment(existing.id, input) : await createAppointment(input)
      navigate(`/agenda?${new URLSearchParams({ fecha: date, cita: saved.id }).toString()}`)
    } catch (err) {
      const ex = err as { code?: string; message?: string }
      setOutOfHours(ex.code === 'DH001')
      setError(agendaErrorMessage(ex))
    } finally {
      setBusy(false)
    }
  }

  const whatsapp = active?.tenant.whatsapp_e164
  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title={existing ? 'Reagendar cita' : 'Nueva cita'}
        actions={
          <Link to="/agenda" className="text-ui font-semibold text-violet">
            Volver
          </Link>
        }
      />
      <form onSubmit={(e) => void submit(e)} noValidate className="flex max-w-3xl flex-col gap-6">
        <Card as="section" aria-label="Paciente" className="flex flex-col gap-3">
          <h2 className="m-0 text-subtitle">Paciente</h2>
          {patient ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-ui font-semibold">{patient.name || 'Cargando…'}</span>
              {!existing && (
                <button type="button" onClick={() => setPatient(null)} className="min-h-11 text-ui font-semibold text-violet">
                  Cambiar
                </button>
              )}
            </div>
          ) : (
            <PatientPicker tenantId={tenantId} onPick={setPatient} />
          )}
        </Card>

        <Card as="section" aria-label="Cuándo y con quién" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {branches.length > 1 && (
            <Select
              label="Sucursal"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              value={branchId}
              onChange={(e) => {
                setPickedBranch(e.target.value)
                setChairId('')
              }}
            />
          )}
          <Select
            label="Doctor"
            options={doctorOptions.map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Elige al doctor"
            value={doctorId}
            disabled={isDoctor}
            onChange={(e) => setDoctorId(e.target.value)}
          />
          <Select
            label="Sillón"
            options={branchChairs.map((c) => ({ value: c.id, label: c.name }))}
            placeholder={branchChairs.length ? 'Elige el sillón' : 'Esta sucursal no tiene sillones'}
            value={chairId}
            onChange={(e) => setChairId(e.target.value)}
          />
          <Select
            label="Tratamiento (opcional)"
            options={treatments.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Sin tratamiento"
            value={treatmentId}
            onChange={(e) => {
              setTreatmentId(e.target.value)
              const t = treatments.find((x) => x.id === e.target.value)
              if (t?.duration_minutes) setDuration(t.duration_minutes)
            }}
          />
          <Select label="Tipo de cita" options={APPOINTMENT_KINDS} value={kind} onChange={(e) => setKind(e.target.value as AppointmentKind)} />
          <Input label="Fecha" type="date" min={todayIn(tz)} value={date} onChange={(e) => setDate(e.target.value)} />
          <Select
            label="Duración"
            options={[...new Set([...DURATIONS, duration])].sort((a, b) => a - b).map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` }))}
            value={String(duration)}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
          <Select
            label="Hora"
            options={timeOptions.map((t) => ({ value: t, label: t }))}
            placeholder={options.length ? 'Elige la hora' : 'Sin horario disponible'}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            hint={ranges.length ? `Horario del día: ${ranges.map(([a, b]) => `${a}–${b}`).join(', ')}` : undefined}
          />
          {ranges.length === 0 && (
            <p className="m-0 text-caption text-warning sm:col-span-2">
              La sucursal no abre ese día. No se agendan citas fuera del horario: escribe a la clínica o al doctor para revisar este caso.
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cita-notas" className="text-ui font-medium">
            Notas (opcional)
          </label>
          <textarea id="cita-notas" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Trae sus radiografías." className={textareaClasses} />
        </div>

        {error && (
          <Alert tone="error">
            {error}
            {outOfHours && whatsapp && (
              <>
                {' '}
                <a href={`https://wa.me/${whatsapp.replace('+', '')}`} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Escribir a la clínica por WhatsApp ({formatPhone(whatsapp)})
                </a>
              </>
            )}
          </Alert>
        )}

        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            {existing ? 'Guardar cambios' : 'Agendar cita'}
          </Button>
          <Link to="/agenda" className={buttonClasses('ghost')}>
            Cancelar
          </Link>
        </div>
      </form>
    </>
  )
}

function PatientPicker({ tenantId, onPick }: { tenantId: string; onPick: (p: { id: string; name: string }) => void }) {
  const [q, setQ] = useState('')
  const search = useDebounced(q.trim(), 250)
  const [results, setResults] = useState<PatientListItem[] | null>(null)

  useEffect(() => {
    if (!tenantId || search.length < 2) return
    let current = true
    listPatients({ tenantId, search, page: 0 }).then(
      (r) => current && setResults(r.rows.slice(0, 8)),
      () => current && setResults([]),
    )
    return () => {
      current = false
    }
  }, [tenantId, search])

  const shown = search.length >= 2 ? results : null
  return (
    <div className="flex flex-col gap-2">
      <Input label="Busca al paciente" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o teléfono" autoComplete="off" />
      {shown && shown.length === 0 && (
        <p className="m-0 text-caption text-ink-muted">
          No encontramos a nadie.{' '}
          <Link to="/pacientes/nuevo" className="font-semibold text-violet">
            Registrar paciente
          </Link>
        </p>
      )}
      {shown && shown.length > 0 && (
        <ul aria-label="Pacientes encontrados" className="m-0 flex list-none flex-col gap-1 p-0">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick({ id: p.id, name: p.full_name })}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-3 text-left text-ui hover:bg-lavender"
              >
                <span className="font-semibold">{p.full_name}</span>
                {p.phone_e164 && <span className="text-caption text-ink-muted">{formatPhone(p.phone_e164)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
