import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { hoursProblem, summarizeHours } from '@/lib/hours'
import { BRANCH_ID, fakeDb, fakeStorage, fakeSupabase, fakeTenant, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'logo-nuevo.png', { type: 'image/png' })
const OLD_LOGO = `${TENANT_ID}/logo-0123456789ab.png`

describe('M10 · horario de atención', () => {
  it('valida y resume igual que la base', () => {
    expect(hoursProblem({ mon: [['09:00', '14:00'], ['16:00', '20:00']] })).toBeNull()
    expect(hoursProblem({ mon: [['14:00', '09:00']] })).toMatch(/empezar antes de terminar/)
    expect(hoursProblem({ tue: [['09:00', '14:00'], ['13:00', '18:00']] })).toMatch(/no se pueden encimar/)
    expect(summarizeHours({ mon: [['09:00', '18:00']], tue: [['09:00', '18:00']], wed: [['09:00', '18:00']], sat: [['09:00', '13:00']] })).toBe(
      'Lun a Mié 09:00–18:00 · Sáb 09:00–13:00',
    )
    expect(summarizeHours({})).toBe('Sin horario')
  })

  it('edita el horario de la sucursal y lo guarda por RPC', async () => {
    const user = userEvent.setup()
    await renderApp('/configuracion/sucursales')
    const branch = await screen.findByRole('region', { name: 'Sucursal Sucursal principal' })
    expect(within(branch).getByText('Sin horario')).toBeInTheDocument()
    await user.click(within(branch).getByRole('button', { name: 'Editar horario' }))
    await user.click(within(branch).getByRole('checkbox', { name: 'Lunes' }))
    await user.click(within(branch).getByRole('checkbox', { name: 'Sábado' }))
    await user.click(within(branch).getAllByRole('button', { name: '+ Otro horario' })[0]!)
    const close = within(branch).getByLabelText('Lunes, cierra (horario 1)')
    await user.clear(close)
    await user.type(close, '14:00')
    const open2 = within(branch).getByLabelText('Lunes, abre (horario 2)')
    await user.clear(open2)
    await user.type(open2, '16:00')
    await user.click(within(branch).getByRole('button', { name: 'Guardar horario' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_branch_hours', {
      p_branch: BRANCH_ID,
      p_hours: { mon: [['09:00', '14:00'], ['16:00', '20:00']], sat: [['09:00', '18:00']] },
    })
    expect(await within(branch).findByText('Lun 09:00–14:00, 16:00–20:00 · Sáb 09:00–18:00')).toBeInTheDocument()
  })

  it('no guarda un horario que termina antes de empezar', async () => {
    const user = userEvent.setup()
    await renderApp('/configuracion/sucursales')
    const branch = await screen.findByRole('region', { name: 'Sucursal Sucursal principal' })
    await user.click(within(branch).getByRole('button', { name: 'Editar horario' }))
    await user.click(within(branch).getByRole('checkbox', { name: 'Martes' }))
    const close = within(branch).getByLabelText('Martes, cierra (horario 1)')
    await user.clear(close)
    await user.type(close, '08:00')
    await user.click(within(branch).getByRole('button', { name: 'Guardar horario' }))
    expect(await within(branch).findByText('Martes: cada horario debe empezar antes de terminar.')).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('set_branch_hours', expect.anything())
  })
})

describe('M10 · identidad de la clínica', () => {
  it('guarda nombre, responsable, color, WhatsApp y ciudad', async () => {
    const user = userEvent.setup()
    await renderApp('/configuracion/identidad')
    const name = await screen.findByLabelText('Nombre de la clínica o consultorio')
    expect(name).toHaveValue('Clínica Prueba')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await user.clear(name)
    await user.type(name, 'Clínica Sonríe')
    await user.click(screen.getByRole('button', { name: 'Frambuesa' }))
    await user.type(screen.getByLabelText('WhatsApp de la clínica'), '55 8765 4321')
    await user.type(screen.getByLabelText('Ciudad'), 'Puebla')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_tenant_identity', {
      p_tenant: TENANT_ID,
      p_display_name: 'Clínica Sonríe',
      p_owner_display_name: 'Dra. Prueba',
      p_owner_title: 'Propietaria',
      p_brand_color: '#B42A5B',
      p_whatsapp_e164: '+525587654321',
      p_city: 'Puebla',
    })
    expect(await screen.findByText('Listo. Guardamos la identidad de tu clínica.')).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Menú principal' })
    expect(await within(menu).findByText('Clínica Sonríe')).toBeInTheDocument()
  })

  it('cambia el logo y borra el anterior de Storage', async () => {
    const user = userEvent.setup()
    fakeStorage.push({ bucket: 'tenant-branding', path: OLD_LOGO, type: 'image/png' })
    await renderApp('/configuracion/identidad', { tenant: fakeTenant({ logo_path: OLD_LOGO }) })
    expect(await screen.findByRole('img', { name: 'Logo actual' })).toHaveAttribute('src', expect.stringContaining(OLD_LOGO))
    await user.upload(screen.getByLabelText('Subir logo'), png())
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Listo. Guardamos la identidad de tu clínica.')
    expect(fakeStorage.map((o) => o.path)).not.toContain(OLD_LOGO)
    expect(fakeStorage).toHaveLength(1)
    expect(fakeDb.tenants[0]!.logo_path).toBe(fakeStorage[0]!.path)
  })

  it('quita el logo y vuelve a las iniciales', async () => {
    const user = userEvent.setup()
    fakeStorage.push({ bucket: 'tenant-branding', path: OLD_LOGO, type: 'image/png' })
    await renderApp('/configuracion/identidad', { tenant: fakeTenant({ logo_path: OLD_LOGO }) })
    await user.click(await screen.findByRole('button', { name: 'Quitar logo' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Listo. Guardamos la identidad de tu clínica.')
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_tenant_identity', { p_tenant: TENANT_ID, p_logo_path: '' })
    expect(fakeStorage).toHaveLength(0)
    const menu = screen.getByRole('navigation', { name: 'Menú principal' })
    await waitFor(() => expect(within(menu).getByRole('img', { name: 'Logo de Clínica Prueba' })).toHaveTextContent('CP'))
  })

  it('recepción ve la identidad pero no la cambia', async () => {
    await renderApp('/configuracion/identidad', { role: 'reception' })
    expect(await screen.findByLabelText('Nombre de la clínica o consultorio')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
  })

  it('la guía lleva a Identidad', async () => {
    await renderApp('/', { tenant: fakeTenant({ onboarding_state: { tasks: {} } }) })
    const guide = await screen.findByRole('region', { name: 'Guía de inicio' })
    expect(within(guide).getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/configuracion/identidad')
  })
})

describe('M10 · mi perfil', () => {
  it('guarda nombre y teléfono', async () => {
    const user = userEvent.setup()
    await renderApp('/configuracion/perfil')
    const name = await screen.findByLabelText('Nombre completo')
    expect(name).toHaveValue('Dueña Prueba')
    expect(screen.getByText('duena@example.test')).toBeInTheDocument()
    await user.clear(name)
    await user.type(name, 'Ana Ruiz')
    await user.type(screen.getByLabelText('Teléfono'), '5512345678')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_my_profile', { p_full_name: 'Ana Ruiz', p_phone_e164: '+525512345678' })
    expect(await screen.findByText('Listo. Guardamos tu perfil.')).toBeInTheDocument()
  })

  it('rechaza un teléfono que no se puede interpretar', async () => {
    const user = userEvent.setup()
    await renderApp('/configuracion/perfil')
    await user.type(await screen.findByLabelText('Teléfono'), '123')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(/Escribe 10 dígitos/)).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('update_my_profile', expect.anything())
  })
})
