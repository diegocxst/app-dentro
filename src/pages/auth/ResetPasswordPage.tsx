import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { EmailLinkPrompt } from '@/components/auth/EmailLinkPrompt'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Input } from '@/components/ui/Input'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useEmailLink } from '@/lib/emailLink'
import { authErrorMessage } from '@/lib/errors'
import { useCodeExchange } from '@/lib/pkceExchange'
import { newPasswordSchema, type NewPasswordValues } from '@/lib/schemas'
import { supabase } from '@/lib/supabase'

function readLinkError(): boolean {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return Boolean(params.get('error') || params.get('error_code') || hash.get('error'))
}

function InvalidLink({ subtitle }: { subtitle: string }) {
  return (
    <AuthLayout title="El enlace ya no es válido" subtitle={subtitle}>
      <Link to="/recuperar" className={buttonClasses('primary', 'lg', undefined, true)} data-reset-view="invalid">
        Pedir un enlace nuevo
      </Link>
    </AuthLayout>
  )
}

/** Destino del enlace de recuperación (token_hash o PKCE). Origen: core-base. */
export function ResetPasswordPage() {
  const { user, loading, recovery, clearRecovery } = useAuth()
  // Primero, para retirar el token del fragmento antes de leer el resto de la URL.
  const emailLink = useEmailLink('recovery')
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [linkError] = useState(readLinkError)
  const [waited, setWaited] = useState(false)
  const exchange = useCodeExchange()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', confirmPassword: '' } })

  // Margen para que termine el canje del código antes de declarar el enlace inválido.
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 2500)
    return () => window.clearTimeout(t)
  }, [])

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setFormError(authErrorMessage(error))
      return
    }
    clearRecovery()
    navigate('/', { replace: true })
  })

  // token_hash: el formulario SOLO aparece tras verificar el enlace.
  if (emailLink.present) {
    if (emailLink.state === 'invalid') return <InvalidLink subtitle="El enlace para crear una nueva contraseña venció o ya se usó." />
    if (emailLink.state !== 'ok') {
      return (
        <EmailLinkPrompt
          title="Crea una nueva contraseña"
          subtitle="Toca «Continuar» para elegir tu nueva contraseña."
          actionLabel="Continuar"
          state={emailLink.state}
          onConfirm={() => void emailLink.verify()}
          otherSession={Boolean(user)}
        />
      )
    }
    if (!user || !recovery) return <FullPageSpinner label="Validando enlace…" />
  }

  if (!emailLink.present && !linkError && exchange.state === 'failed') {
    return (
      <InvalidLink subtitle="Por seguridad, el enlace funciona solo unos minutos y en el navegador donde lo pediste. Pide uno nuevo y ábrelo en cuanto llegue." />
    )
  }

  if (loading || exchange.state === 'pending' || (!user && !waited && !linkError)) return <FullPageSpinner label="Validando enlace…" />

  if (!user || linkError) return <InvalidLink subtitle="El enlace para crear una nueva contraseña venció o ya se usó." />

  return (
    <AuthLayout title="Crea una nueva contraseña" subtitle={recovery ? `Para la cuenta ${user.email ?? ''}.` : 'Actualiza la contraseña de tu cuenta.'}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Input
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres, con al menos una letra y un número."
          error={errors.password?.message}
          {...register('password')}
        />
        <Input label="Confirma la contraseña" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" block size="lg" loading={isSubmitting}>
          Guardar contraseña
        </Button>
      </form>
    </AuthLayout>
  )
}
