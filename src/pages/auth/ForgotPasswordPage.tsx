import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthLayout } from '@/layouts/AuthLayout'
import { env } from '@/lib/env'
import { authErrorMessage } from '@/lib/errors'
import { emailOnlySchema, type EmailOnlyValues } from '@/lib/schemas'
import { supabase } from '@/lib/supabase'
import { linkClass } from './links'

/** P03 · Recuperar contraseña. */
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnlyValues>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.siteUrl}/restablecer` })
    // Solo se muestran errores que no revelan si la cuenta existe (red, límite de envíos).
    if (error && (error.status === 429 || error.name === 'AuthRetryableFetchError')) {
      setFormError(authErrorMessage(error))
      return
    }
    setSent(true)
  })

  return (
    <AuthLayout
      title="Recupera tu contraseña"
      subtitle="Escribe el correo de tu cuenta y te enviamos un enlace para crear una nueva."
      footer={
        <Link to="/ingresar" className={linkClass}>
          Volver a entrar
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success" title="Revisa tu correo">
          Si hay una cuenta con ese correo, te llegará un enlace para crear una nueva contraseña. Ábrelo desde este dispositivo y revisa
          también spam.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {formError && <Alert tone="error">{formError}</Alert>}
          <Input label="Correo electrónico" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" error={errors.email?.message} {...register('email')} />
          <Button type="submit" block size="lg" loading={isSubmitting}>
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
