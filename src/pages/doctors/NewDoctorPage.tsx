import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { outcomeNotice, type Notice } from '@/components/team/notice'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createDoctor } from '@/data/doctors'
import { inviteMember } from '@/data/team'
import type { OfflineRole } from '@/lib/doctors'
import { rpcErrorMessage } from '@/lib/errors'
import { isManager, ROLE_HINT, ROLE_LABEL } from '@/lib/roles'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'
import { ColorPicker } from './ColorPicker'
import { checkDoctorForm, EMAIL_RE, type DoctorFormErrors, type DoctorFormValues } from './doctorForm'

/** Alta de un doctor. Con correo se le invita; sin correo queda como doctor sin acceso. */
export function NewDoctorPage() {
  const { active } = useWorkspace()
  const navigate = useNavigate()
  const [values, setValues] = useState<DoctorFormValues>({ name: '', specialty: '', color: null, phone: '' })
  const [role, setRole] = useState<OfflineRole>('doctor')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<DoctorFormErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!active) return null
  if (!isManager(active.role) || active.tenant.status !== 'active') return <Navigate to="/doctores" replace />
  const set = (patch: Partial<DoctorFormValues>) => setValues((v) => ({ ...v, ...patch }))

  const save = async () => {
    setError(null)
    const { errors: errs, input } = checkDoctorForm(values, false)
    const mail = email.trim().toLowerCase()
    if (mail && !EMAIL_RE.test(mail)) errs.email = 'Revisa el correo.'
    setErrors(errs)
    if (!input || errs.email) return
    setBusy(true)
    try {
      const id = await createDoctor(active.tenant_id, role, input)
      let notice: Notice = { tone: 'success', text: `Listo. Agregamos a ${input.name}. Ya puedes asignarle pacientes y citas.` }
      if (mail) {
        try {
          notice = outcomeNotice(await inviteMember({ tenantId: active.tenant_id, email: mail, role, branchIds: [], membershipId: id }), mail)
        } catch (e) {
          notice = { tone: 'warning', text: `Agregamos a ${input.name}, pero no pudimos invitarlo: ${(e as Error).message} Inténtalo desde su perfil.` }
        }
      }
      navigate(`/doctores/${id}`, { state: { notice } })
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa los datos del doctor.' }))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Doctores" title="Nuevo doctor" actions={<Link to="/doctores" className="text-ui font-semibold text-violet">Volver</Link>} />
      <Card as="section" className="max-w-2xl">
        <form
          aria-label="Nuevo doctor"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="flex flex-col gap-4"
        >
        <Input label="Nombre" value={values.name} maxLength={120} placeholder="Ej. Dra. Ana Pérez" error={errors.name} onChange={(e) => set({ name: e.target.value })} />
        <Select
          label="Tipo"
          options={(['doctor', 'doctor_collab'] as const).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          hint={ROLE_HINT[role]}
          value={role}
          onChange={(e) => setRole(e.target.value as OfflineRole)}
        />
        <Input label="Especialidad (opcional)" value={values.specialty} maxLength={80} placeholder="Ej. Ortodoncia" error={errors.specialty} onChange={(e) => set({ specialty: e.target.value })} />
        <ColorPicker value={values.color} onChange={(color) => set({ color })} />
        <Input label="Teléfono (opcional)" type="tel" inputMode="tel" value={values.phone} error={errors.phone} onChange={(e) => set({ phone: e.target.value })} />
        <Input
          label="Correo (opcional)"
          type="email"
          inputMode="email"
          value={email}
          error={errors.email}
          hint="Si lo pones, le mandamos una invitación para que entre a la app. Si no, queda como doctor sin acceso: se le asignan pacientes, citas y comisiones, pero no entra."
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" loading={busy} className="self-start">
          Agregar doctor
        </Button>
        </form>
      </Card>
    </>
  )
}
