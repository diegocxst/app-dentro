import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { updateMyProfile } from '@/data/profile'
import { rpcErrorMessage } from '@/lib/errors'
import { formatPhone, normalizePhone } from '@/lib/phone'
import { ROLE_LABEL } from '@/lib/roles'
import { profileSchema, type ProfileValues } from '@/lib/schemas'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

/** Mi perfil: nombre y teléfono de la persona (cuenta global, no de la clínica). */
export function ProfilePage() {
  const { user } = useAuth()
  const { state, active, refresh } = useWorkspace()
  const profile = state.status === 'ready' ? state.profile : null
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: profile?.full_name ?? '', phone: profile?.phone_e164 ? formatPhone(profile.phone_e164) : '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    setNotice(null)
    try {
      await updateMyProfile(v.fullName, normalizePhone(v.phone))
      await refresh()
      reset(v)
      setNotice({ tone: 'success', text: 'Listo. Guardamos tu perfil.' })
    } catch (e) {
      setNotice({ tone: 'error', text: rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa tu teléfono.' }) })
    }
  })

  return (
    <>
      <PageHeader eyebrow="Configuración" title="Mi perfil" actions={<Link to="/configuracion" className="text-ui font-semibold text-violet">Volver</Link>} />
      <Card className="flex max-w-xl flex-col gap-5">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          <Input label="Nombre completo" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
          <Input label="Teléfono" type="tel" inputMode="tel" autoComplete="tel" placeholder="55 1234 5678" hint="Opcional. Lo ve tu equipo." error={errors.phone?.message} {...register('phone')} />
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui">
            <dt className="text-ink-muted">Correo</dt>
            <dd className="m-0 break-all">{user?.email}</dd>
            {active && (
              <>
                <dt className="text-ink-muted">Rol en {active.tenant.display_name}</dt>
                <dd className="m-0">{ROLE_LABEL[active.role]}</dd>
              </>
            )}
          </dl>
          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={isSubmitting} disabled={!isDirty}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
