import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeDb, fakeSupabase, functionOverrides, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const DOCTOR = '00000000-0000-4000-8000-0000000000d9'

function seedDoctor() {
  fakeDb.memberships.push({ id: 'm-doc', tenant_id: TENANT_ID, user_id: DOCTOR, role: 'doctor', status: 'active', created_at: '2026-11-15T01:00:00Z' })
  fakeDb.profiles.push({ id: DOCTOR, full_name: 'Dr. Luis Prueba' })
}

describe('Configuración › Tu equipo', () => {
  it('Configuración enlaza a «Tu equipo»', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/configuracion')
    await user.click(await screen.findByRole('link', { name: /Tu equipo/ }))
    expect(router.state.location.pathname).toBe('/configuracion/equipo')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tu equipo' })).toBeInTheDocument()
  })

  it('muestra el equipo; la propietaria no se puede editar ni quitar', async () => {
    seedDoctor()
    await renderApp('/configuracion/equipo')
    const team = await screen.findByRole('region', { name: 'Equipo' })
    expect(await within(team).findByText('Dueña Prueba')).toBeInTheDocument()
    expect(within(team).getByText('(tú)')).toBeInTheDocument()
    expect(within(team).getByText('Propietaria/o')).toBeInTheDocument()
    expect(within(team).getByRole('combobox', { name: 'Rol de Dr. Luis Prueba' })).toHaveDisplayValue('Doctor/a')
    expect(within(team).getAllByRole('button', { name: 'Quitar' })).toHaveLength(1)
  })

  it('invita con la Edge Function y lista la invitación pendiente', async () => {
    const user = userEvent.setup()
    await renderApp('/configuracion/equipo')
    const form = await screen.findByRole('region', { name: 'Invita a alguien' })
    await user.type(within(form).getByLabelText('Correo electrónico'), 'recepcion@example.test')
    await user.selectOptions(within(form).getByLabelText('Rol'), 'reception')
    await user.click(within(form).getByRole('button', { name: 'Enviar invitación' }))

    expect(fakeSupabase.functions.invoke).toHaveBeenCalledWith('invite-member', {
      body: { tenant_id: TENANT_ID, email: 'recepcion@example.test', role: 'reception', branch_ids: [] },
    })
    expect(await screen.findByText('Listo. Enviamos la invitación a recepcion@example.test.')).toBeInTheDocument()
    const pending = screen.getByRole('region', { name: 'Invitaciones pendientes' })
    expect(await within(pending).findByText('recepcion@example.test')).toBeInTheDocument()
    expect(within(form).getByLabelText('Correo electrónico')).toHaveValue('')
  })

  it('con varias sucursales deja elegir dónde trabaja', async () => {
    const user = userEvent.setup()
    fakeDb.branches.push({ id: '20000000-0000-4000-8000-000000000002', tenant_id: TENANT_ID, name: 'Sucursal Norte', address: '', is_active: true })
    await renderApp('/configuracion/equipo')
    const form = await screen.findByRole('region', { name: 'Invita a alguien' })
    await user.type(within(form).getByLabelText('Correo electrónico'), 'doc@example.test')
    await user.click(await within(form).findByRole('checkbox', { name: 'Sucursal Norte' }))
    await user.click(within(form).getByRole('button', { name: 'Enviar invitación' }))
    expect(fakeSupabase.functions.invoke).toHaveBeenCalledWith('invite-member', {
      body: expect.objectContaining({ branch_ids: ['20000000-0000-4000-8000-000000000002'] }),
    })
  })

  it('valida el correo antes de llamar a la función', async () => {
    const user = userEvent.setup()
    await renderApp('/configuracion/equipo')
    const form = await screen.findByRole('region', { name: 'Invita a alguien' })
    await user.click(within(form).getByRole('button', { name: 'Enviar invitación' }))
    expect(await within(form).findByText('Escribe tu correo.')).toBeInTheDocument()
    expect(fakeSupabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('muestra el error que devuelve la función (ya es miembro)', async () => {
    const user = userEvent.setup()
    functionOverrides['invite-member'] = () =>
      Promise.resolve({
        data: null,
        error: { context: { json: () => Promise.resolve({ status: 'error', code: 'already_member', message: 'Esa persona ya es parte de tu equipo.' }) } },
      })
    await renderApp('/configuracion/equipo')
    const form = await screen.findByRole('region', { name: 'Invita a alguien' })
    await user.type(within(form).getByLabelText('Correo electrónico'), 'doc@example.test')
    await user.click(within(form).getByRole('button', { name: 'Enviar invitación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esa persona ya es parte de tu equipo.')
  })

  it('si ya tiene cuenta, avisa que verá la clínica al entrar', async () => {
    const user = userEvent.setup()
    functionOverrides['invite-member'] = () => Promise.resolve({ data: { status: 'existing_user' }, error: null })
    await renderApp('/configuracion/equipo')
    const form = await screen.findByRole('region', { name: 'Invita a alguien' })
    await user.type(within(form).getByLabelText('Correo electrónico'), 'ya@example.test')
    await user.click(within(form).getByRole('button', { name: 'Enviar invitación' }))
    expect(await screen.findByText(/ya tiene cuenta en dentro/)).toBeInTheDocument()
  })

  it('cambia el rol y quita a un miembro (con confirmación)', async () => {
    const user = userEvent.setup()
    seedDoctor()
    await renderApp('/configuracion/equipo')
    const team = await screen.findByRole('region', { name: 'Equipo' })
    await user.selectOptions(await within(team).findByRole('combobox', { name: 'Rol de Dr. Luis Prueba' }), 'doctor_collab')
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_member_role', { p_membership: 'm-doc', p_role: 'doctor_collab' })
    expect(await screen.findByText('Cambiamos el rol de Dr. Luis Prueba.')).toBeInTheDocument()

    await user.click(within(team).getByRole('button', { name: 'Quitar' }))
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('revoke_member', expect.anything())
    await user.click(within(team).getByRole('button', { name: 'Sí, quitar' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('revoke_member', { p_membership: 'm-doc' })
    await waitFor(() => expect(within(team).queryByText('Dr. Luis Prueba')).not.toBeInTheDocument())
  })

  it('cancela una invitación pendiente', async () => {
    const user = userEvent.setup()
    fakeDb.invitations.push({ id: 'inv-9', tenant_id: TENANT_ID, email: 'pendiente@example.test', role: 'doctor', branch_ids: [], status: 'pending', expires_at: '2026-11-22T00:00:00Z', created_at: '2026-11-15T00:00:00Z' })
    await renderApp('/configuracion/equipo')
    const pending = await screen.findByRole('region', { name: 'Invitaciones pendientes' })
    await within(pending).findByText('pendiente@example.test')
    await user.click(within(pending).getByRole('button', { name: 'Cancelar' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('revoke_invitation', { p_invitation: 'inv-9' })
    expect(await within(pending).findByText('No hay invitaciones pendientes.')).toBeInTheDocument()
  })

  it('un doctor ve el equipo pero no puede invitar ni editar', async () => {
    await renderApp('/configuracion/equipo', { role: 'doctor' })
    expect(await screen.findByText(/Solo la gerencia invita y cambia el equipo/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Invita a alguien' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Invitaciones pendientes' })).not.toBeInTheDocument()
    expect(fakeSupabase.from).not.toHaveBeenCalledWith('invitations')
  })

  it('al entrar, la app acepta las invitaciones de tu correo', async () => {
    await renderApp('/')
    await screen.findByRole('navigation', { name: 'Menú principal' })
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('accept_my_invitations')
  })
})
