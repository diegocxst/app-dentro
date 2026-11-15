import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacy'
import { emitAuth, fakeDb, fakeSession, fakeSupabase, fakeUser, NOTICE_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const withMeta = (meta: Record<string, unknown>) => fakeSession(fakeUser({ user_metadata: meta }))

describe('aviso de privacidad (consentimiento de la cuenta)', () => {
  it('la versión del registro es la que la migración deja vigente', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261115000300_account_consents.sql'), 'utf8')
    expect(sql).toContain(`values ('${PRIVACY_NOTICE_VERSION}'`)
  })

  it('con la aceptación registrada, entra directo al panel', async () => {
    await renderApp('/')
    expect(await screen.findByRole('navigation', { name: 'Menú principal' })).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('accept_privacy_notice', expect.anything())
  })

  it('si aceptó al registrarse, registra la evidencia sin volver a preguntar', async () => {
    await renderApp('/', { signedIn: false, consented: false })
    emitAuth('SIGNED_IN', withMeta({ privacy_notice_version: PRIVACY_NOTICE_VERSION, privacy_source: 'signup' }))
    expect(await screen.findByRole('navigation', { name: 'Menú principal' })).toBeInTheDocument()
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('accept_privacy_notice', { p_version: PRIVACY_NOTICE_VERSION, p_source: 'signup' })
    expect(fakeDb.account_consents).toHaveLength(1)
  })

  it('al activar una invitación, el origen queda como invitación', async () => {
    await renderApp('/', { signedIn: false, consented: false })
    emitAuth('SIGNED_IN', withMeta({ privacy_notice_version: PRIVACY_NOTICE_VERSION, privacy_source: 'invite' }))
    await screen.findByRole('navigation', { name: 'Menú principal' })
    expect(fakeDb.account_consents[0]).toMatchObject({ notice_id: NOTICE_ID, source: 'invite' })
  })

  it('sin aceptación, pide aceptar antes de entrar', async () => {
    const user = userEvent.setup()
    await renderApp('/', { consented: false })
    expect(await screen.findByRole('heading', { level: 1, name: 'Acepta el aviso de privacidad' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Menú principal' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Aceptar y continuar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Marca la casilla para continuar.')
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('accept_privacy_notice', expect.anything())

    await user.click(screen.getByRole('checkbox', { name: 'Leí y acepto el aviso de privacidad.' }))
    await user.click(screen.getByRole('button', { name: 'Aceptar y continuar' }))
    expect(await screen.findByRole('navigation', { name: 'Menú principal' })).toBeInTheDocument()
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('accept_privacy_notice', { p_version: PRIVACY_NOTICE_VERSION, p_source: 'renewal' })
  })

  it('si se publicó una versión nueva, avisa que el aviso se actualizó', async () => {
    await renderApp('/', { signedIn: false, consented: false })
    fakeDb.privacy_notices[0]!.version = 'version-2027-01-01'
    emitAuth('SIGNED_IN', withMeta({ privacy_notice_version: PRIVACY_NOTICE_VERSION }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Actualizamos el aviso de privacidad' })).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('accept_privacy_notice', expect.anything())
  })

  it('si falla la revisión, deja reintentar sin entrar al panel', async () => {
    const user = userEvent.setup()
    fakeSupabase.from.mockImplementationOnce(() => {
      throw Object.assign(new Error('red'), { code: 'x' })
    })
    await renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'No pudimos revisar tu aviso de privacidad' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a intentar' }))
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Menú principal' })).toBeInTheDocument())
  })
})
