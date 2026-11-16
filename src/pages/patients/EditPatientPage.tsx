import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { openPatient, updatePatient, type Patient } from '@/data/patients'
import { useDoctors } from '@/hooks/useDoctors'
import { rpcErrorMessage } from '@/lib/errors'
import { formatPhone, normalizePhone } from '@/lib/phone'
import { patientSchema, type PatientValues } from '@/lib/schemas'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'
import { PatientFields } from './PatientFields'

/** Editar datos del paciente (solo lo que cambió). */
export function EditPatientPage() {
  const { id = '' } = useParams()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    openPatient(id).then(
      (r) => current && setPatient(r.patient),
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [id, attempt])

  if (failed)
    return (
      <LoadError
        title="No pudimos abrir al paciente"
        onRetry={() => {
          setFailed(false)
          setAttempt((n) => n + 1)
        }}
      />
    )
  if (!patient) return <Skeleton className="h-64 w-full" label="Cargando paciente" />
  return <EditForm patient={patient} />
}

function EditForm({ patient }: { patient: Patient }) {
  const { active } = useWorkspace()
  const navigate = useNavigate()
  const doctors = useDoctors(active?.tenant_id)
  const [error, setError] = useState<string | null>(null)
  const canPickDoctor = ['owner', 'admin', 'reception'].includes(active?.role ?? '')
  const initial: PatientValues = {
    fullName: patient.full_name,
    birthDate: patient.birth_date ?? '',
    phone: patient.phone_e164 ? formatPhone(patient.phone_e164) : '',
    email: patient.email ?? '',
    source: patient.source,
    primaryDoctorId: patient.primary_doctor_id ?? '',
  }
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<PatientValues>({ resolver: zodResolver(patientSchema), defaultValues: initial })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await updatePatient(patient.id, {
        ...(dirtyFields.fullName ? { fullName: v.fullName } : {}),
        ...(dirtyFields.birthDate ? { birthDate: v.birthDate } : {}),
        ...(dirtyFields.phone ? { phoneE164: normalizePhone(v.phone) ?? '' } : {}),
        ...(dirtyFields.email ? { email: v.email } : {}),
        ...(dirtyFields.source ? { source: v.source } : {}),
        ...(dirtyFields.primaryDoctorId && canPickDoctor ? { primaryDoctorId: v.primaryDoctorId } : {}),
      })
      navigate(`/pacientes/${patient.id}`, { replace: true })
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa los datos del paciente.' }))
    }
  })

  return (
    <>
      <PageHeader eyebrow="Pacientes" title={`Editar a ${patient.full_name}`} actions={<Link to={`/pacientes/${patient.id}`} className="text-ui font-semibold text-violet">Cancelar</Link>} />
      <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-6">
        {error && <Alert tone="error">{error}</Alert>}
        <Card>
          <PatientFields register={register} errors={errors} doctors={doctors} canPickDoctor={canPickDoctor} />
        </Card>
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={isSubmitting}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </>
  )
}
