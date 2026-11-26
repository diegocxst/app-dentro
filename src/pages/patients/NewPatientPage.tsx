import { Link, useNavigate } from 'react-router'
import { NewPatientForm } from '@/components/patients/NewPatientForm'
import { PageHeader } from '@/pages/PageHeader'

/** P16 · Nuevo paciente con consentimiento expreso (obligatorio). */
export function NewPatientPage() {
  const navigate = useNavigate()
  return (
    <>
      <PageHeader eyebrow="Pacientes" title="Nuevo paciente" actions={<Link to="/pacientes" className="text-ui font-semibold text-violet">Cancelar</Link>} />
      <NewPatientForm onCreated={(p) => navigate(`/pacientes/${p.id}`, { replace: true })} />
    </>
  )
}
