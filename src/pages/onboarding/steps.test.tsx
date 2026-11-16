import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BRANCH_ID, fakeDb, fakeSupabase, fakeTenant, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

describe('onboarding · paso 2 sucursales y sillones', () => {
  it('pide al menos un sillón antes de continuar', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida/sucursales')
    expect(await screen.findByText('Paso 2 de 5')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText(/Agrega al menos un sillón/)).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('set_onboarding_task', expect.anything())
  })

  it('agrega sillones, quita uno y al continuar marca la guía y pasa al paso 3', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/bienvenida/sucursales')
    const branch = await screen.findByRole('region', { name: 'Sucursal Sucursal principal' })
    const input = within(branch).getByLabelText('Nuevo sillón en Sucursal principal')
    await user.type(input, 'Sillón 1')
    await user.click(within(branch).getByRole('button', { name: 'Agregar sillón' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('create_chair', { p_branch: BRANCH_ID, p_name: 'Sillón 1' })
    expect(await within(branch).findByText('Sillón 1')).toBeInTheDocument()

    await user.type(within(branch).getByLabelText('Nuevo sillón en Sucursal principal'), 'Sillón 2')
    await user.click(within(branch).getByRole('button', { name: 'Agregar sillón' }))
    await user.click(await within(branch).findByRole('button', { name: 'Quitar Sillón 2' }))
    await waitFor(() => expect(within(branch).queryByText('Sillón 2')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_onboarding_task', { p_tenant: TENANT_ID, p_task: 'branches', p_done: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/bienvenida/equipo'))
  })

  it('avisa si el sillón ya existe', async () => {
    const user = userEvent.setup()
    fakeDb.chairs.push({ id: 'c1', tenant_id: TENANT_ID, branch_id: BRANCH_ID, name: 'Sillón 1', is_active: true, created_at: '2026-11-16T00:00:00Z' })
    await renderApp('/bienvenida/sucursales')
    const branch = await screen.findByRole('region', { name: 'Sucursal Sucursal principal' })
    await user.type(await within(branch).findByLabelText('Nuevo sillón en Sucursal principal'), 'sillón 1')
    await user.click(within(branch).getByRole('button', { name: 'Agregar sillón' }))
    expect(await screen.findByText('Ya hay un sillón con ese nombre en esta sucursal.')).toBeInTheDocument()
  })

  it('edita el nombre y la dirección de la sucursal', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida/sucursales')
    const branch = await screen.findByRole('region', { name: 'Sucursal Sucursal principal' })
    await user.type(within(branch).getByLabelText('Dirección'), 'Av. Prueba 123')
    await user.click(within(branch).getByRole('button', { name: 'Guardar sucursal' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_branch', { p_branch: BRANCH_ID, p_name: 'Sucursal principal', p_address: 'Av. Prueba 123' })
  })

  it('los pasos hechos se ven con palomita y se pueden abrir', async () => {
    await renderApp('/bienvenida/sucursales', { tenant: fakeTenant({ onboarding_state: { tasks: { identity: true, team: true } } }) })
    const steps = await screen.findByRole('list', { name: 'Pasos' })
    expect(within(steps).getAllByText('(listo)', { exact: false })).toHaveLength(2) // identidad y equipo
    expect(within(steps).getByRole('link', { name: /Tu equipo/ })).toHaveAttribute('href', '/bienvenida/equipo')
  })
})

describe('onboarding · paso 3 equipo', () => {
  it('invita y al continuar pasa a tratamientos', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/bienvenida/equipo')
    const form = await screen.findByRole('region', { name: 'Invita a alguien' })
    await user.type(within(form).getByLabelText('Correo electrónico'), 'doc@example.test')
    await user.click(within(form).getByRole('button', { name: 'Enviar invitación' }))
    expect(await screen.findByText('Listo. Enviamos la invitación a doc@example.test.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_onboarding_task', { p_tenant: TENANT_ID, p_task: 'team', p_done: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/bienvenida/tratamientos'))
  })

  it('«Hacerlo después» vuelve a Inicio sin marcar', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/bienvenida/equipo')
    await user.click(await screen.findByRole('link', { name: 'Hacerlo después' }))
    expect(router.state.location.pathname).toBe('/')
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('set_onboarding_task', expect.anything())
  })
})

describe('onboarding · paso 4 tratamientos', () => {
  it('muestra sugerencias sin precio y sin marcar', async () => {
    await renderApp('/bienvenida/tratamientos')
    expect(await screen.findByText('Limpieza dental')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Limpieza dental' })).not.toBeChecked()
    expect(screen.getByLabelText('Precio de Limpieza dental')).toHaveValue('')
  })

  it('no deja continuar sin un tratamiento con precio', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida/tratamientos')
    await user.click(await screen.findByRole('checkbox', { name: 'Limpieza dental' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Escribe el precio de Limpieza dental.')).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('save_treatments', expect.anything())
  })

  it('guarda solo los marcados con su precio y pasa al paso 5', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/bienvenida/tratamientos')
    await user.type(await screen.findByLabelText('Precio de Limpieza dental'), '$850')
    await user.click(screen.getByRole('button', { name: 'Ortodoncia' }))
    expect(screen.queryByText('Limpieza dental')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Agregar otro tratamiento' }))
    await user.type(screen.getByLabelText('Nombre del tratamiento'), 'Retenedor')
    await user.type(screen.getByLabelText('Precio de Retenedor'), '1,500')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(fakeSupabase.rpc).toHaveBeenCalledWith('save_treatments', {
      p_tenant: TENANT_ID,
      p_items: [
        { category: 'preventiva', name: 'Limpieza dental', price_mxn: 850, duration_minutes: 45, is_active: true },
        { category: 'ortodoncia', name: 'Retenedor', price_mxn: 1500, duration_minutes: null, is_active: true },
      ],
    })
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_onboarding_task', { p_tenant: TENANT_ID, p_task: 'treatments', p_done: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/bienvenida/whatsapp'))
  })

  it('muestra los tratamientos que ya existen con su precio', async () => {
    fakeDb.treatments.push({ id: 't1', tenant_id: TENANT_ID, category: 'preventiva', name: 'Limpieza dental', price_mxn: 900, duration_minutes: 45, is_active: true })
    await renderApp('/bienvenida/tratamientos')
    expect(await screen.findByLabelText('Precio de Limpieza dental')).toHaveValue('900')
    expect(screen.getByRole('checkbox', { name: 'Limpieza dental' })).toBeChecked()
    expect(screen.getAllByText('Limpieza dental')).toHaveLength(1)
  })
})

describe('onboarding · paso 5 WhatsApp', () => {
  it('guarda el número normalizado, marca la guía y termina en Inicio', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/bienvenida/whatsapp')
    await user.type(await screen.findByLabelText('WhatsApp de la clínica'), '55 1234 5678')
    await user.click(screen.getByRole('button', { name: 'Terminar' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_tenant_identity', { p_tenant: TENANT_ID, p_whatsapp_e164: '+525512345678' })
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_onboarding_task', { p_tenant: TENANT_ID, p_task: 'whatsapp', p_done: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('rechaza un número que no se puede interpretar', async () => {
    const user = userEvent.setup()
    await renderApp('/bienvenida/whatsapp')
    await user.type(await screen.findByLabelText('WhatsApp de la clínica'), '5512')
    await user.click(screen.getByRole('button', { name: 'Terminar' }))
    expect(await screen.findByText(/Escribe 10 dígitos/)).toBeInTheDocument()
  })
})

describe('Configuración reusa los editores', () => {
  it('Configuración enlaza a sucursales y tratamientos', async () => {
    await renderApp('/configuracion')
    expect(await screen.findByRole('link', { name: /Sucursales y sillones/ })).toHaveAttribute('href', '/configuracion/sucursales')
    expect(screen.getByRole('link', { name: /Tratamientos y precios/ })).toHaveAttribute('href', '/configuracion/tratamientos')
  })

  it('una recepcionista ve el catálogo pero no lo edita', async () => {
    fakeDb.treatments.push({ id: 't1', tenant_id: TENANT_ID, category: 'preventiva', name: 'Limpieza dental', price_mxn: 900, duration_minutes: 45, is_active: true })
    await renderApp('/configuracion/tratamientos', { role: 'reception' })
    expect(await screen.findByLabelText('Precio de Limpieza dental')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
  })
})
