import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeDb, fakeSupabase, fakeTenant, rpcOverrides, seedClinic, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const menu = () => screen.getByRole('navigation', { name: 'Menú principal' })

describe('P04 paso 1 · alta de la clínica', () => {
  it('sin clínica, el panel manda a /bienvenida', async () => {
    const { router } = await renderApp('/agenda', { tenant: null })
    expect(await screen.findByRole('heading', { level: 2, name: 'Así se verá tu clínica' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/bienvenida')
    expect(screen.getByText('Paso 1 de 5')).toBeInTheDocument()
  })

  it('con clínica, /bienvenida manda al panel', async () => {
    const { router } = await renderApp('/bienvenida')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('valida antes de crear', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida', { tenant: null })
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Escribe al menos 2 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Escribe el nombre de la doctora o el doctor responsable.')).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('create_tenant', expect.anything())
  })

  it('sugiere la dirección, muestra la vista previa y crea la clínica', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/bienvenida', { tenant: null })
    await user.type(await screen.findByLabelText('Nombre de la clínica o consultorio'), 'Clínica Dental Sonríe')
    await user.type(screen.getByLabelText('Doctora o doctor responsable'), 'Dra. Ana Ruiz')
    await user.selectOptions(screen.getByLabelText('Cargo'), 'Directora médica')
    await user.click(screen.getByRole('button', { name: 'Frambuesa' }))
    await user.type(screen.getByLabelText('WhatsApp de la clínica'), '55 1234 5678')
    await user.type(screen.getByLabelText('Ciudad'), 'Ciudad de México')

    expect(screen.getByText('dentro.mx/clinica-dental-sonrie')).toBeInTheDocument()
    const preview = screen.getByRole('complementary', { name: 'Vista previa' })
    expect(within(preview).getAllByText('Clínica Dental Sonríe').length).toBeGreaterThan(0)
    expect(within(preview).getByText('Dra. Ana Ruiz · Directora médica')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Logo actual' })).toHaveTextContent('CS')
    expect(screen.getByRole('button', { name: 'Frambuesa' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('create_tenant', {
      p_display_name: 'Clínica Dental Sonríe',
      p_kind: 'clinic',
      p_slug: 'clinica-dental-sonrie',
      p_owner_display_name: 'Dra. Ana Ruiz',
      p_owner_title: 'Directora médica',
      p_brand_color: '#B42A5B',
      p_whatsapp_e164: '+525512345678',
      p_city: 'Ciudad de México',
    })
    // Sigue al paso 2 del onboarding…
    expect(await screen.findByRole('heading', { level: 2, name: '¿Dónde atiendes?' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/bienvenida/sucursales')
    // …y el panel ya muestra la clínica nueva.
    await router.navigate('/')
    const nav = await screen.findByRole('navigation', { name: 'Menú principal' })
    expect(await within(nav).findByText('Clínica Dental Sonríe')).toBeInTheDocument()
    expect(within(nav).getByText('Dra. Ana Ruiz · Directora médica')).toBeInTheDocument()
  })

  it('rechaza un WhatsApp que no se puede interpretar', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida', { tenant: null })
    await user.type(await screen.findByLabelText('WhatsApp de la clínica'), '5512')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Escribe 10 dígitos (México) o el número con +lada internacional.')).toBeInTheDocument()
  })

  it('avisa cuando oscurece un color claro', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida', { tenant: null })
    const code = await screen.findByLabelText('Código')
    await user.clear(code)
    await user.type(code, '#2DD4E0')
    expect(screen.getByText(/Oscurecimos un poco tu color/)).toBeInTheDocument()
  })

  it('rechaza una dirección reservada', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida', { tenant: null })
    const slug = await screen.findByLabelText('Dirección de tu perfil público')
    await user.type(screen.getByLabelText('Nombre de la clínica o consultorio'), 'Pacientes')
    await user.type(screen.getByLabelText('Doctora o doctor responsable'), 'Dra. Ana Ruiz')
    expect(slug).toHaveValue('pacientes')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Esa dirección está reservada. Elige otra.')).toBeInTheDocument()
  })

  it('traduce el error de dirección ocupada', async () => {
    const user = userEvent.setup()
    rpcOverrides.create_tenant = () => Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate' } })
    await renderApp('/bienvenida', { tenant: null })
    await user.type(await screen.findByLabelText('Nombre de la clínica o consultorio'), 'Clínica Prueba Dos')
    await user.type(screen.getByLabelText('Doctora o doctor responsable'), 'Dra. Ana Ruiz')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esa dirección ya la usa otra clínica.')
  })
})

describe('clínica activa', () => {
  it('suspendida: el panel avisa que está en solo lectura', async () => {
    await renderApp('/', { tenant: fakeTenant({ status: 'suspended' }) })
    expect(await screen.findByText('Tu clínica está en solo lectura')).toBeInTheDocument()
  })

  it('cancelada: no muestra el panel ni pide sus sucursales', async () => {
    await renderApp('/', { tenant: fakeTenant({ status: 'cancelled' }) })
    expect(await screen.findByText(/Esta cuenta está cancelada/)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Menú principal' })).not.toBeInTheDocument()
    expect(fakeSupabase.from).not.toHaveBeenCalledWith('branches')
  })

  it('si falla la carga, deja reintentar', async () => {
    const user = userEvent.setup()
    rpcOverrides.am_i_platform_admin = () => Promise.resolve({ data: null, error: { code: '500', message: 'x' } })
    await renderApp('/')
    expect(await screen.findByText('No pudimos cargar tu clínica')).toBeInTheDocument()
    delete rpcOverrides.am_i_platform_admin
    await user.click(screen.getByRole('button', { name: 'Volver a intentar' }))
    expect(await within(await screen.findByRole('navigation', { name: 'Menú principal' })).findByText('Clínica Prueba')).toBeInTheDocument()
  })

  it('con dos clínicas muestra el selector y recuerda la elegida', async () => {
    const user = userEvent.setup()
    seedClinic(fakeTenant({ id: '10000000-0000-4000-8000-000000000002', display_name: 'Consultorio Norte', slug: 'consultorio-norte' }))
    await renderApp('/')
    const picker = await screen.findByRole('combobox', { name: 'Clínica' })
    await screen.findByRole('navigation', { name: 'Menú principal' })
    // Sin preferencia guardada, la activa es la primera membresía.
    expect(within(menu()).getByText('Consultorio Norte')).toBeInTheDocument()
    await user.selectOptions(picker, 'Clínica Prueba')
    expect(await within(menu()).findByText('Clínica Prueba')).toBeInTheDocument()
    expect(window.localStorage.getItem('dentro.activeTenantId')).toBe(TENANT_ID)
  })

  it('una sola clínica: sin selector', async () => {
    await renderApp('/')
    await screen.findByRole('combobox', { name: 'Sucursal' })
    expect(screen.queryByRole('combobox', { name: 'Clínica' })).not.toBeInTheDocument()
  })

  it('la sucursal elegida se recuerda por clínica', async () => {
    const user = userEvent.setup()
    fakeDb.branches.push({ id: '20000000-0000-4000-8000-000000000002', tenant_id: TENANT_ID, name: 'Sucursal Norte', address: '', is_active: true })
    await renderApp('/')
    const picker = await screen.findByRole('combobox', { name: 'Sucursal' })
    await user.selectOptions(picker, 'Sucursal Norte')
    expect(picker).toHaveDisplayValue('Sucursal Norte')
    expect(window.localStorage.getItem(`dentro.activeBranchId.${TENANT_ID}`)).toBe('20000000-0000-4000-8000-000000000002')
  })
})
