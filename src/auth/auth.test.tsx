import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacy'
import { emitAuth, fakeSession, fakeSupabase } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'
import { safeNextPath } from './safeNextPath'
import { stableUser } from './stableUser'
import { fakeUser } from '@/test/fakeSupabase'

const authError = (code: string, status = 400) => ({ name: 'AuthApiError', code, status, message: code })

describe('rutas protegidas', () => {
  it('sin sesión, el panel manda a /ingresar', async () => {
    const { router } = await renderApp('/agenda', { signedIn: false })
    expect(await screen.findByRole('heading', { level: 1, name: 'Entra a tu clínica' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/ingresar')
    expect(screen.queryByRole('navigation', { name: 'Menú principal' })).not.toBeInTheDocument()
  })

  it('con sesión, /ingresar y /registro mandan al inicio', async () => {
    const { router } = await renderApp('/ingresar')
    expect(router.state.location.pathname).toBe('/')
    await router.navigate('/registro')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('cerrar sesión regresa a /ingresar', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/')
    await user.click(within(screen.getByRole('navigation', { name: 'Menú principal' })).getByRole('button', { name: 'Cerrar sesión' }))
    expect(fakeSupabase.auth.signOut).toHaveBeenCalledOnce()
    await waitFor(() => expect(router.state.location.pathname).toBe('/ingresar'))
  })
})

describe('P01 · ingresar', () => {
  it('valida antes de llamar a Supabase', async () => {
    const user = userEvent.setup()
    await renderApp('/ingresar', { signedIn: false })
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Escribe tu correo.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(fakeSupabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('entra y vuelve a la sección que pidió', async () => {
    const user = userEvent.setup()
    fakeSupabase.auth.signInWithPassword.mockImplementation(async () => {
      emitAuth('SIGNED_IN', fakeSession())
      return { data: {}, error: null }
    })
    const { router } = await renderApp('/agenda', { signedIn: false })
    await user.type(await screen.findByLabelText('Correo electrónico'), 'duena@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(fakeSupabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'duena@example.test', password: 'secreta123' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/agenda'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Agenda' })).toBeInTheDocument()
  })

  it('credenciales incorrectas: mensaje neutro', async () => {
    const user = userEvent.setup()
    fakeSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: authError('invalid_credentials') })
    await renderApp('/ingresar', { signedIn: false })
    await user.type(screen.getByLabelText('Correo electrónico'), 'nadie@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'x')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(screen.queryByRole('button', { name: /Reenviar confirmación/ })).not.toBeInTheDocument()
  })

  it('correo sin confirmar: ofrece reenviar la confirmación', async () => {
    const user = userEvent.setup()
    fakeSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: authError('email_not_confirmed') })
    await renderApp('/ingresar', { signedIn: false })
    await user.type(screen.getByLabelText('Correo electrónico'), 'nueva@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await user.click(await screen.findByRole('button', { name: 'Reenviar confirmación' }))
    expect(fakeSupabase.auth.resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'nueva@example.test' }))
    expect(await screen.findByText(/te enviamos un enlace nuevo/)).toBeInTheDocument()
  })
})

describe('P02 · registro', () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana Prueba')
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await user.type(screen.getByLabelText('Confirma tu contraseña'), 'secreta123')
  }

  it('exige aceptar el aviso de privacidad', async () => {
    const user = userEvent.setup()
    await renderApp('/registro', { signedIn: false })
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByText('Acepta el aviso de privacidad para crear tu cuenta.')).toBeInTheDocument()
    expect(fakeSupabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('valida la contraseña y su confirmación', async () => {
    const user = userEvent.setup()
    await renderApp('/registro', { signedIn: false })
    await user.type(screen.getByLabelText('Contraseña'), 'corta')
    await user.type(screen.getByLabelText('Confirma tu contraseña'), 'otra')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByText('Usa al menos 8 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
  })

  it('crea la cuenta con la versión del aviso y pide revisar el correo', async () => {
    const user = userEvent.setup()
    fakeSupabase.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null })
    await renderApp('/registro', { signedIn: false })
    await fill(user)
    await user.click(screen.getByRole('checkbox', { name: /aviso de privacidad/ }))
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeInTheDocument()
    const arg = fakeSupabase.auth.signUp.mock.calls[0]![0] as { email: string; options: { data: Record<string, string>; emailRedirectTo: string } }
    expect(arg.email).toBe('ana@example.test')
    expect(arg.options.data).toMatchObject({ full_name: 'Ana Prueba', privacy_notice_version: PRIVACY_NOTICE_VERSION })
    expect(arg.options.emailRedirectTo).toMatch(/\/auth\/callback$/)
    expect(window.localStorage.getItem('dentro.pendingSignup')).toContain('ana@example.test')
  })
})

describe('P03 · recuperar contraseña', () => {
  it('responde igual exista o no la cuenta', async () => {
    const user = userEvent.setup()
    fakeSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: null, error: authError('user_not_found', 404) } as never)
    await renderApp('/recuperar', { signedIn: false })
    await user.type(screen.getByLabelText('Correo electrónico'), 'nadie@example.test')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument()
    expect(fakeSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('nadie@example.test', expect.objectContaining({ redirectTo: expect.stringMatching(/\/restablecer$/) }))
  })

  it('sí avisa del límite de intentos', async () => {
    const user = userEvent.setup()
    fakeSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: null, error: authError('over_email_send_rate_limit', 429) } as never)
    await renderApp('/recuperar', { signedIn: false })
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.test')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos')
  })
})

describe('enlaces de correo (token_hash)', () => {
  const TOKEN = 'pkce_0123456789abcdef0123456789abcdef'

  it('P05 · sin token, la invitación no es válida', async () => {
    await renderApp('/auth/invitacion', { signedIn: false })
    expect(screen.getByRole('heading', { level: 1, name: 'La invitación no es válida' })).toBeInTheDocument()
  })

  it('P05 · retira el token de la URL y solo lo verifica al tocar el botón', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', `/auth/invitacion#token_hash=${TOKEN}&type=invite`)
    fakeSupabase.auth.verifyOtp.mockImplementation(async () => {
      emitAuth('SIGNED_IN', fakeSession(fakeUser({ email: 'doctor@example.test' })))
      return { data: {}, error: null }
    })
    await renderApp('/auth/invitacion', { signedIn: false })
    expect(window.location.hash).toBe('')
    expect(fakeSupabase.auth.verifyOtp).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Aceptar invitación' }))
    expect(fakeSupabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: 'invite' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Activa tu cuenta' })).toBeInTheDocument()
    expect(screen.getByText(/doctor@example\.test/)).toBeInTheDocument()
  })

  it('P05 · enlace vencido: mismo mensaje que uno inválido', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', `/auth/invitacion#token_hash=${TOKEN}&type=invite`)
    fakeSupabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: authError('otp_expired', 403) })
    await renderApp('/auth/invitacion', { signedIn: false })
    await user.click(screen.getByRole('button', { name: 'Aceptar invitación' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'La invitación no es válida' })).toBeInTheDocument()
  })

  it('confirmación de registro: verifica con type email y entra al panel', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', `/auth/callback#token_hash=${TOKEN}&type=email`)
    fakeSupabase.auth.verifyOtp.mockImplementation(async () => {
      emitAuth('SIGNED_IN', fakeSession())
      return { data: {}, error: null }
    })
    const { router } = await renderApp('/auth/callback', { signedIn: false })
    await user.click(screen.getByRole('button', { name: 'Confirmar mi correo' }))
    expect(fakeSupabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: 'email' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('un token con tipo equivocado se trata como inválido sin llamar a Supabase', async () => {
    window.history.replaceState(null, '', `/auth/invitacion#token_hash=${TOKEN}&type=recovery`)
    await renderApp('/auth/invitacion', { signedIn: false })
    expect(screen.getByRole('heading', { level: 1, name: 'La invitación no es válida' })).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(fakeSupabase.auth.verifyOtp).not.toHaveBeenCalled()
  })
})

describe('utilidades de sesión', () => {
  it('safeNextPath evita redirecciones abiertas', () => {
    expect(safeNextPath('/agenda?x=1')).toBe('/agenda?x=1')
    expect(safeNextPath('//evil.example')).toBe('/')
    expect(safeNextPath('/\\evil.example')).toBe('/')
    expect(safeNextPath('https://evil.example')).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
  })

  it('stableUser conserva el mismo objeto si el usuario no cambió', () => {
    const a = fakeUser()
    const b = fakeUser()
    expect(stableUser(a, b)).toBe(a)
    expect(stableUser(a, fakeUser({ email: 'otro@example.test' }))).not.toBe(a)
    expect(stableUser(a, null)).toBeNull()
  })
})
