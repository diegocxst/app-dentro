import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeStorage, fakeSupabase, fakeTenant, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'logo-sonrie.png', { type: 'image/png' })

describe('logo en el alta de la clínica', () => {
  it('rechaza un SVG sin previsualizarlo', async () => {
    const user = userEvent.setup({ applyAccept: false })
    await renderApp('/bienvenida', { tenant: null })
    await user.upload(await screen.findByLabelText('Subir logo'), new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Usa una imagen PNG, JPG o WebP.')
    expect(screen.queryByRole('img', { name: 'Logo elegido' })).not.toBeInTheDocument()
  })

  it('rechaza un logo de más de 20 MB', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida', { tenant: null })
    const big = new File([new Uint8Array(8)], 'enorme.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 })
    await user.upload(await screen.findByLabelText('Subir logo'), big)
    expect(screen.getByRole('alert')).toHaveTextContent('El logo pesa más de 20 MB.')
  })

  it('si no puede reducir un logo pesado, avisa y no lo elige', async () => {
    // jsdom no tiene canvas: la reducción falla como fallaría con una imagen dañada.
    const user = userEvent.setup()
    await renderApp('/bienvenida', { tenant: null })
    await user.upload(await screen.findByLabelText('Subir logo'), new File([new Uint8Array(2 * 1024 * 1024)], 'pesado.png', { type: 'image/png' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos reducir esta imagen.')
    expect(screen.queryByRole('img', { name: 'Logo elegido' })).not.toBeInTheDocument()
  })

  it('sube el logo al crear la clínica y lo muestra en el menú con URL firmada', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/bienvenida', { tenant: null })
    await user.upload(await screen.findByLabelText('Subir logo'), png())
    expect(await screen.findByRole('img', { name: 'Logo elegido' })).toHaveAttribute('src', expect.stringMatching(/^blob:/))
    expect(screen.getByText('logo-sonrie.png')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nombre de la clínica o consultorio'), 'Clínica Dental Sonríe')
    await user.type(screen.getByLabelText('Doctora o doctor responsable'), 'Dra. Ana Ruiz')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('heading', { level: 2, name: '¿Dónde atiendes?' })
    await router.navigate('/')

    const nav = await screen.findByRole('navigation', { name: 'Menú principal' })
    const newTenant = '10000000-0000-4000-8000-0000000000ff'
    expect(fakeStorage).toHaveLength(1)
    expect(fakeStorage[0]).toMatchObject({ bucket: 'tenant-branding', type: 'image/png' })
    expect(fakeStorage[0]!.path).toMatch(new RegExp(`^${newTenant}/logo-[a-z0-9-]+\\.png$`))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_tenant_identity', { p_tenant: newTenant, p_logo_path: fakeStorage[0]!.path })
    const logo = await within(nav).findByRole('img', { name: 'Logo de Clínica Dental Sonríe' })
    expect(logo).toHaveAttribute('src', expect.stringContaining(`https://storage.test/tenant-branding/${fakeStorage[0]!.path}`))
  })

  it('sin logo, crea la clínica sin tocar Storage', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida', { tenant: null })
    await user.type(await screen.findByLabelText('Nombre de la clínica o consultorio'), 'Consultorio Norte')
    await user.type(screen.getByLabelText('Doctora o doctor responsable'), 'Dr. Luis Prueba')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('heading', { level: 2, name: '¿Dónde atiendes?' })
    expect(fakeSupabase.storage.from).not.toHaveBeenCalled()
  })

  it('una clínica con logo lo muestra en el menú', async () => {
    await renderApp('/', { tenant: fakeTenant({ logo_path: `${TENANT_ID}/logo-0123456789ab.png` }) })
    const nav = await screen.findByRole('navigation', { name: 'Menú principal' })
    // Mientras llega la URL firmada se ven las iniciales (mismo nombre accesible): esperar la imagen.
    await waitFor(() =>
      expect(within(nav).getByRole('img', { name: 'Logo de Clínica Prueba' })).toHaveAttribute(
        'src',
        `https://storage.test/tenant-branding/${TENANT_ID}/logo-0123456789ab.png?token=firmado`,
      ),
    )
  })
})
