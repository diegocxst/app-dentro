import { useState } from 'react'
import { useForm, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { setGuideTask } from '@/data/onboarding'
import { createPatient } from '@/data/patients'
import { useDoctors } from '@/hooks/useDoctors'
import { rpcErrorMessage } from '@/lib/errors'
import { normalizePhone } from '@/lib/phone'
import { isManager } from '@/lib/roles'
import { newPatientSchema, type NewPatientValues, type PatientValues } from '@/lib/schemas'
import { PageHeader } from '@/pages/PageHeader'
import { isTreating } from '@/lib/access'
import { useWorkspace } from '@/workspace/workspace-context'
import { PatientFields } from './PatientFields'

/** P16 · Nuevo paciente con consentimiento expreso (obligatorio). */
export function NewPatientPage() {
  const { active, refresh } = useWorkspace()
  const navigate = useNavigate()
  const doctors = useDoctors(active?.tenant_id)
  const [error, setError] = useState<string | null>(null)
  const canPickDoctor = !isTreating(active?.role)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPatientValues>({
    resolver: zodResolver(newPatientSchema),
    defaultValues: { fullName: '', birthDate: '', phone: '', email: '', source: 'manual', primaryDoctorId: '', consentMethod: 'papel', consentGiven: false },
  })

  if (!active) return null
  const clinic = active.tenant.display_name

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      const patient = await createPatient({
        tenantId: active.tenant_id,
        fullName: v.fullName,
        consentMethod: v.consentMethod,
        birthDate: v.birthDate || null,
        phoneE164: normalizePhone(v.phone),
        email: v.email,
        source: v.source,
        primaryDoctorId: v.primaryDoctorId || null,
      })
      // Primera tarea de la guía cumplida (solo gerencia la marca; si falla, no importa).
      if (isManager(active.role)) {
        await setGuideTask(active.tenant_id, 'first_patient', true)
          .then(() => refresh())
          .catch(() => undefined)
      }
      navigate(`/pacientes/${patient.id}`, { replace: true })
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa los datos del paciente.' }))
    }
  })

  return (
    <>
      <PageHeader eyebrow="Pacientes" title="Nuevo paciente" actions={<Link to="/pacientes" className="text-ui font-semibold text-violet">Cancelar</Link>} />
      <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-6">
        {error && <Alert tone="error">{error}</Alert>}
        <Card className="flex flex-col gap-4">
          <PatientFields register={register as unknown as UseFormRegister<PatientValues>} errors={errors} doctors={doctors} canPickDoctor={canPickDoctor} />
        </Card>
        <Card as="section" aria-label="Consentimiento" className="flex flex-col gap-3">
          <h2 className="m-0 text-subtitle">Consentimiento del paciente</h2>
          <p className="m-0 text-ui text-ink-muted">
            Sus datos de salud son sensibles. Antes de guardarlos, el paciente debe aceptar el aviso de privacidad de {clinic} (versión{' '}
            {active.tenant.patient_notice_version}).
          </p>
          <fieldset className="m-0 flex flex-wrap gap-4 border-0 p-0">
            <legend className="mb-1 p-0 text-ui font-medium">¿Cómo lo dio?</legend>
            <label className="flex min-h-11 items-center gap-2 text-ui">
              <input type="radio" value="papel" className="size-5 accent-violet" {...register('consentMethod')} />
              Firmó en papel
            </label>
            <label className="flex min-h-11 items-center gap-2 text-ui">
              <input type="radio" value="digital" className="size-5 accent-violet" {...register('consentMethod')} />
              Lo aceptó en digital
            </label>
          </fieldset>
          <Checkbox
            label="Confirmo que el paciente dio su consentimiento expreso para tratar sus datos personales y de salud."
            error={errors.consentGiven?.message}
            {...register('consentGiven')}
          />
          <p className="m-0 text-caption text-ink-muted">El texto del aviso para pacientes está en revisión legal. Podrás subir el consentimiento firmado en Documentos.</p>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={isSubmitting}>
            Guardar paciente
          </Button>
        </div>
      </form>
    </>
  )
}
