import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { DoctorOption } from '@/hooks/useDoctors'
import { PATIENT_SOURCES } from '@/lib/patients'
import type { PatientValues } from '@/lib/schemas'

type Props = {
  register: UseFormRegister<PatientValues>
  errors: FieldErrors<PatientValues>
  doctors: DoctorOption[]
  /** Un doctor o colaborador queda como tratante: no elige. */
  canPickDoctor: boolean
}

/** Campos del paciente (alta y edición). */
export function PatientFields({ register, errors, doctors, canPickDoctor }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Input label="Nombre completo" autoComplete="off" error={errors.fullName?.message} {...register('fullName')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Fecha de nacimiento" type="date" hint="Opcional." error={errors.birthDate?.message} {...register('birthDate')} />
        <Select label="¿Cómo llegó?" options={PATIENT_SOURCES} error={errors.source?.message} {...register('source')} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Teléfono o WhatsApp" type="tel" inputMode="tel" autoComplete="off" placeholder="55 1234 5678" error={errors.phone?.message} {...register('phone')} />
        <Input label="Correo" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" hint="Opcional." error={errors.email?.message} {...register('email')} />
      </div>
      {canPickDoctor && (
        <Select
          label="Doctor tratante"
          options={[{ value: '', label: 'Sin asignar' }, ...doctors.map((d) => ({ value: d.id, label: d.name }))]}
          hint="Los doctores solo ven a sus pacientes."
          error={errors.primaryDoctorId?.message}
          {...register('primaryDoctorId')}
        />
      )}
    </div>
  )
}
