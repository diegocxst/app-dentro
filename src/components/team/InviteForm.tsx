import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { InviteError, inviteMember } from '@/data/team'
import { outcomeNotice, type Notice } from './notice'
import { ASSIGNABLE_ROLES, ROLE_HINT, ROLE_LABEL } from '@/lib/roles'
import { inviteSchema, type InviteValues } from '@/lib/schemas'

const ROLE_OPTIONS = ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))

export function InviteForm({ tenantId, branches, onDone }: { tenantId: string; branches: { id: string; name: string }[]; onDone: (n: Notice) => void }) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', role: 'doctor', branchIds: [] } })
  const role = useWatch({ control, name: 'role' })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const out = await inviteMember({ tenantId, email: values.email, role: values.role, branchIds: values.branchIds })
      onDone(outcomeNotice(out, values.email))
      reset({ email: '', role: values.role, branchIds: [] })
    } catch (e) {
      onDone({ tone: 'error', text: e instanceof InviteError ? e.message : 'No pudimos enviar la invitación. Vuelve a intentarlo.' })
    }
  })

  return (
    <Card as="section" aria-label="Invita a alguien" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-subtitle">Invita a alguien</h2>
        <p className="m-0 text-caption text-ink-muted">Le llega un correo para activar su cuenta. La invitación vence en 7 días.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Correo electrónico" type="email" autoComplete="off" inputMode="email" autoCapitalize="none" error={errors.email?.message} {...register('email')} />
        <Select label="Rol" options={ROLE_OPTIONS} hint={role ? `${ROLE_HINT[role]}.` : undefined} error={errors.role?.message} {...register('role')} />
        {branches.length > 1 && (
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 p-0 text-ui font-medium">Sucursales</legend>
            <p className="m-0 mb-1 text-caption text-ink-muted">Si no marcas ninguna, podrá trabajar en todas.</p>
            {branches.map((b) => (
              <Checkbox key={b.id} label={b.name} value={b.id} {...register('branchIds')} />
            ))}
          </fieldset>
        )}
        <Button type="submit" block size="lg" loading={isSubmitting}>
          Enviar invitación
        </Button>
      </form>
    </Card>
  )
}
