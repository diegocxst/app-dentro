import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router'
import { safeNextPath } from '@/auth/safeNextPath'
import { ResendConfirmation } from '@/components/auth/ResendConfirmation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthLayout } from '@/layouts/AuthLayout'
import { authErrorMessage } from '@/lib/errors'
import { loginSchema, type LoginValues } from '@/lib/schemas'
import { signupMode } from '@/lib/signupAccess'
import { supabase } from '@/lib/supabase'
import { linkClass } from './links'

type LoginState = { from?: unknown; email?: string } | null

/** P01 · Ingresar con correo y contraseña (D3: el código por correo queda apagado). */
export function LoginPage() {
  const navigate = useNavigate()
  const state = useLocation().state as LoginState
  const [formError, setFormError] = useState<string | null>(null)
  /** Contraseña correcta pero correo sin confirmar: solo entonces se ofrece reenviar. */
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: state?.email ?? '', password: '' } })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    setUnconfirmed(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setFormError(authErrorMessage(error))
      if (error.code === 'email_not_confirmed') setUnconfirmed(email)
      return
    }
    navigate(safeNextPath(state?.from), { replace: true })
  })

  const footer =
    signupMode() === 'closed' ? (
      <>¿Aún no tienes cuenta? Por ahora el registro es por invitación.</>
    ) : (
      <>
        ¿Aún no tienes cuenta?{' '}
        <Link to="/registro" className={linkClass}>
          Registra tu clínica
        </Link>
      </>
    )

  return (
    <AuthLayout title="Entra a tu clínica" subtitle="Escribe tu correo y tu contraseña." footer={footer}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        {unconfirmed && <ResendConfirmation email={unconfirmed} />}
        <Input label="Correo electrónico" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" error={errors.email?.message} {...register('email')} />
        <div className="flex flex-col gap-1">
          <Input label="Contraseña" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
          <Link to="/recuperar" className={`${linkClass} inline-flex min-h-11 items-center self-end text-ui`}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Button type="submit" block size="lg" loading={isSubmitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
