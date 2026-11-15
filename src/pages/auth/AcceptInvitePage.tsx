import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { EmailLinkPrompt } from '@/components/auth/EmailLinkPrompt'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useEmailLink } from '@/lib/emailLink'
import { authErrorMessage } from '@/lib/errors'
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacy'
import { acceptInviteSchema, type AcceptInviteValues } from '@/lib/schemas'
import { supabase } from '@/lib/supabase'
import { linkClass } from './links'
import { PrivacyConsent } from './PrivacyConsent'

/**
 * P05 · Aceptar invitación (doctores y recepción, D4).
 * Enlace de la plantilla «Invite user»: {{ .SiteURL }}/auth/invitacion#token_hash=…&type=invite.
 * 1. Se verifica SOLO al tocar el botón. 2. Supabase abre la sesión.
 * 3. La persona escribe su nombre y contraseña y acepta el aviso. Origen: core-base.
 */
export function AcceptInvitePage() {
  const { user, loading } = useAuth()
  const emailLink = useEmailLink('invite')
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { fullName: '', password: '', confirmPassword: '', acceptPrivacy: false },
  })

  const onSubmit = handleSubmit(async ({ fullName, password }) => {
    setFormError(null)
    const { error } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName, privacy_notice_version: PRIVACY_NOTICE_VERSION, privacy_accepted_at: new Date().toISOString() },
    })
    if (error) {
      setFormError(authErrorMessage(error))
      return
    }
    // El nombre del perfil se guarda por RPC; si falla, se corrige después en el perfil.
    await supabase.rpc('update_my_profile', { p_full_name: fullName }).then(
      () => undefined,
      () => undefined,
    )
    navigate('/', { replace: true })
  })

  if (!emailLink.present || emailLink.state === 'invalid') {
    return (
      <AuthLayout
        title="La invitación no es válida"
        subtitle="El enlace venció, ya se usó o está incompleto. Pide a tu clínica que te envíe una invitación nueva."
        footer={
          <>
            ¿Ya activaste tu cuenta?{' '}
            <Link to="/ingresar" className={linkClass}>
              Entra aquí
            </Link>
          </>
        }
      >
        <div data-invite-view="invalid" />
      </AuthLayout>
    )
  }

  if (emailLink.state !== 'ok') {
    return (
      <EmailLinkPrompt
        title="Acepta tu invitación"
        subtitle="Te invitaron a una clínica en dentro. Toca el botón para continuar y crear tu contraseña."
        actionLabel="Aceptar invitación"
        state={emailLink.state}
        onConfirm={() => void emailLink.verify()}
        otherSession={Boolean(user)}
      />
    )
  }

  if (loading || !user) return <FullPageSpinner label="Activando tu cuenta…" />

  return (
    <AuthLayout title="Activa tu cuenta" subtitle={`Para ${user.email ?? 'tu correo'}. Elige tu contraseña para entrar.`}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" data-invite-view="form">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Input label="Nombre completo" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres, con al menos una letra y un número."
          error={errors.password?.message}
          {...register('password')}
        />
        <Input label="Confirma tu contraseña" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <PrivacyConsent error={errors.acceptPrivacy?.message} {...register('acceptPrivacy')} />
        <Button type="submit" block size="lg" loading={isSubmitting}>
          Activar mi cuenta
        </Button>
      </form>
    </AuthLayout>
  )
}
