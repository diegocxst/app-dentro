import { useState } from 'react'
import { useForm, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { setGuideTask } from '@/data/onboarding'
import { createPatient, type Patient } from '@/data/patients'
import { useDoctors } from '@/hooks/useDoctors'
import { isTreating } from '@/lib/access'
import { rpcErrorMessage } from '@/lib/errors'
import { normalizePhone } from '@/lib/phone'
import { isManager } from '@/lib/roles'
import { newPatientSchema, type NewPatientValues, type PatientValues } from '@/lib/schemas'
import { PatientFields } from '@/pages/patients/PatientFields'
import { useWorkspace } from '@/workspace/workspace-context'

type Props = {
  /** Se llama con el paciente ya guardado. */
  onCreated: (patient: Patient) => void
  /** Si se da, aparece «Cancelar» junto a «Guardar paciente». */
  onCancel?: () => void
  initialName?: string
  initialDoctorId?: string
}

/**
 * Alta completa de paciente con consentimiento expreso (obligatorio, LFPDPPP).
 * La usan «Nuevo paciente» (P16) y el presupuesto (M4-C).
 */
export function NewPatientForm({ onCreated, onCancel, initialName = '', initialDoctorId = '' }: Props) {
  const { active, refresh } = useWorkspace()
  const doctors = useDoctors(active?.tenant_id)
  const [error, setError] = useState<string | null>(null)
  const canPickDoctor = !isTreating(active?.role)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPatientValues>({
    resolver: zodResolver(newPatientSchema),
    defaultValues: {
      fullName: initialName,
      birthDate: '',
      phone: '',
      email: '',
      source: 'manual',
      primaryDoctorId: canPickDoctor ? initialDoctorId : '',
      consentMethod: 'papel',
      consentGiven: false,
    },
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
      onCreated(patient)
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa los datos del paciente.' }))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Nuevo paciente" className="flex max-w-2xl flex-col gap-6">
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
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" size="lg" loading={isSubmitting}>
          Guardar paciente
        </Button>
      </div>
    </form>
  )
}
