import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { ResendConfirmation } from '@/components/auth/ResendConfirmation'
import { signupRedirectUrl } from '@/lib/authRedirects'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthLayout } from '@/layouts/AuthLayout'
import { authErrorMessage } from '@/lib/errors'
import { savePendingSignup } from '@/lib/pendingSignup'
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacy'
import { registerSchema, type RegisterValues } from '@/lib/schemas'
import { signupOpen } from '@/lib/signupAccess'
import { supabase } from '@/lib/supabase'
import { linkClass } from './links'
import { PrivacyConsent } from './PrivacyConsent'

const PASSWORD_HINT = 'Mínimo 8 caracteres, con al menos una letra y un número.'

/** P02 · Registro del dueño de la clínica (D4: doctores y recepción entran por invitación). */
export function RegisterPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '', acceptPrivacy: false },
  })

  const toLogin = (
    <>
      ¿Ya tienes cuenta?{' '}
      <Link to="/ingresar" className={linkClass}>
        Entra aquí
      </Link>
    </>
  )

  const onSubmit = handleSubmit(async ({ fullName, email, password }) => {
    setFormError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Lo que aceptó en este formulario. Al entrar, ConsentGate lo registra como
        // evidencia en `account_consents` (migración 0003).
        data: {
          full_name: fullName,
          privacy_notice_version: PRIVACY_NOTICE_VERSION,
          privacy_source: 'signup',
          privacy_accepted_at: new Date().toISOString(),
        },
        emailRedirectTo: signupRedirectUrl(),
      },
    })
    if (error) {
      setFormError(authErrorMessage(error))
      return
    }
    if (data.session) {
      // El proyecto no pide confirmar el correo: la sesión ya existe.
      window.location.assign('/')
      return
    }
    // Si el correo ya existía, Supabase responde igual: mismo mensaje (anti-enumeración).
    savePendingSignup(email)
    setSentTo(email)
  })

  if (sentTo) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        subtitle={
          <>
            Si <strong className="font-semibold text-ink">{sentTo}</strong> puede registrarse, te enviamos un enlace para confirmar tu
            cuenta. Ábrelo desde este dispositivo.
          </>
        }
        footer={toLogin}
      >
        <div className="flex flex-col gap-4">
          <p className="m-0 text-ui text-ink-muted">¿No llegó? Revisa spam y promociones. Por seguridad, el enlace vence después de un tiempo.</p>
          <ResendConfirmation email={sentTo} startCooling />
        </div>
      </AuthLayout>
    )
  }

  if (!signupOpen()) {
    return (
      <AuthLayout
        title="Registro cerrado por ahora"
        subtitle="Estamos sumando clínicas poco a poco. Si te invitaron, revisa tu correo para activar tu cuenta."
        footer={toLogin}
      >
        <div data-signup-closed />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Registra tu clínica" subtitle="Crea tu cuenta de dueña o dueño. A tu equipo lo invitas después." footer={toLogin}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Input label="Nombre completo" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
        <Input label="Correo electrónico" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" error={errors.email?.message} {...register('email')} />
        <Input label="Contraseña" type="password" autoComplete="new-password" hint={PASSWORD_HINT} error={errors.password?.message} {...register('password')} />
        <Input label="Confirma tu contraseña" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <PrivacyConsent error={errors.acceptPrivacy?.message} {...register('acceptPrivacy')} />
        <Button type="submit" block size="lg" loading={isSubmitting}>
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  )
}
