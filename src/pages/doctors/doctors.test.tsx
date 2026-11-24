import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { doctorColorClass, memberName } from '@/lib/doctors'
import { fakeDb, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'
import { checkDoctorForm } from './doctorForm'

function seedTeam() {
  fakeDb.memberships.push(
    { id: 'm-d2', tenant_id: TENANT_ID, user_id: 'u-d2', role: 'doctor', status: 'active', display_name: '', created_at: '2026-11-15T00:00:00Z' },
    { id: 'm-off', tenant_id: TENANT_ID, user_id: null, role: 'doctor_collab', status: 'active', display_name: 'Dr. Luis Sin Correo', created_at: '2026-11-16T00:00:00Z' },
    { id: 'm-r1', tenant_id: TENANT_ID, user_id: 'u-r1', role: 'reception', status: 'active', display_name: '', created_at: '2026-11-15T00:00:00Z' },
  )
  fakeDb.profiles.push(
    { id: 'u-d2', full_name: 'Dra. Karla Vega Prueba', phone_e164: null, avatar_path: null },
    { id: 'u-r1', full_name: 'Recepción Prueba', phone_e164: null, avatar_path: null },
  )
  fakeDb.doctor_settings.push({ membership_id: 'm-d2', tenant_id: TENANT_ID, specialty: 'Endodoncia', calendar_color: 'orange', phone_e164: null })
}

describe('reglas de doctores', () => {
  it('valida el perfil y arma el nombre en la clínica', () => {
    expect(checkDoctorForm({ name: ' Dra. Ana ', specialty: ' Orto ', color: 'violet', phone: '55 1234 5678' }, false).input).toEqual({
      name: 'Dra. Ana', specialty: 'Orto', color: 'violet', phone: '+525512345678',
    })
    expect(checkDoctorForm({ name: '', specialty: '', color: null, phone: '' }, false).errors.name).toBe('Escribe el nombre del doctor.')
    expect(checkDoctorForm({ name: '', specialty: '', color: null, phone: '' }, true).input?.name).toBe('')
    expect(checkDoctorForm({ name: 'Dra. Ana', specialty: '', color: null, phone: '123' }, false).errors.phone).toMatch(/10 dígitos/)
    expect(memberName('', 'Cuenta')).toBe('Cuenta')
    expect(memberName('Clínica', 'Cuenta')).toBe('Clínica')
    expect(memberName(' ', '')).toBe('Sin nombre')
    expect(doctorColorClass('turquoise', 0)).toBe('bg-turquoise')
    expect(doctorColorClass(null, 1)).toBe('bg-turquoise')
  })
})

describe('M6-B1 · Equipo de doctores', () => {
  it('la gerencia ve a sus doctores, con y sin acceso, y entra al perfil', async () => {
    seedTeam()
    const user = userEvent.setup()
    await renderApp('/doctores')
    const list = await screen.findByRole('list', { name: 'Doctores de la clínica' })
    await within(list).findByText('Dra. Karla Vega Prueba')
    expect(within(list).getByText('Doctor/a · Endodoncia')).toBeInTheDocument()
    expect(within(list).getByText('Sin acceso')).toBeInTheDocument()
    expect(within(list).queryByText('Recepción Prueba')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Comisiones' })).toHaveAttribute('href', '/doctores/comisiones')
    await user.click(within(list).getByRole('link', { name: /Dr\. Luis Sin Correo/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dr. Luis Sin Correo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Acceso a la app' })).toBeInTheDocument()
  })

  it('da de alta a un doctor sin correo: queda sin acceso y con su perfil', async () => {
    const user = userEvent.setup()
    await renderApp('/doctores')
    await screen.findByText(/Por ahora solo estás tú/)
    await user.click(screen.getByRole('link', { name: 'Nuevo doctor' }))
    const form = await screen.findByRole('form', { name: 'Nuevo doctor' })
    await user.click(within(form).getByRole('button', { name: 'Agregar doctor' }))
    expect(await within(form).findByText('Escribe el nombre del doctor.')).toBeInTheDocument()
    await user.type(within(form).getByLabelText('Nombre'), 'Dra. Ana Prueba')
    await user.type(within(form).getByLabelText('Especialidad (opcional)'), 'Ortodoncia')
    await user.click(within(form).getByLabelText('Turquesa'))
    await user.type(within(form).getByLabelText('Teléfono (opcional)'), '123')
    await user.click(within(form).getByRole('button', { name: 'Agregar doctor' }))
    expect(await within(form).findByText(/10 dígitos/)).toBeInTheDocument()
    await user.clear(within(form).getByLabelText('Teléfono (opcional)'))
    await user.type(within(form).getByLabelText('Teléfono (opcional)'), '5512345678')
    await user.click(within(form).getByRole('button', { name: 'Agregar doctor' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dra. Ana Prueba' })).toBeInTheDocument()
    expect(screen.getByText(/Listo\. Agregamos a Dra\. Ana Prueba/)).toBeInTheDocument()
    expect(screen.getByText('Sin acceso')).toBeInTheDocument()
    const m = fakeDb.memberships.find((x) => x.display_name === 'Dra. Ana Prueba')
    expect(m).toMatchObject({ user_id: null, role: 'doctor', status: 'active' })
    expect(fakeDb.doctor_settings.find((d) => d.membership_id === m?.id)).toMatchObject({ specialty: 'Ortodoncia', calendar_color: 'turquoise', phone_e164: '+525512345678' })
    expect(fakeDb.invitations).toHaveLength(0)
  })

  it('con correo, da de alta al doctor y le manda la invitación ligada a su registro', async () => {
    const user = userEvent.setup()
    await renderApp('/doctores/nuevo')
    const form = await screen.findByRole('form', { name: 'Nuevo doctor' })
    await user.type(within(form).getByLabelText('Nombre'), 'Dr. Iker Prueba')
    await user.selectOptions(within(form).getByLabelText('Tipo'), 'doctor_collab')
    await user.type(within(form).getByLabelText('Correo (opcional)'), 'iker.prueba@example.test')
    await user.click(within(form).getByRole('button', { name: 'Agregar doctor' }))
    expect(await screen.findByText('Listo. Enviamos la invitación a iker.prueba@example.test.')).toBeInTheDocument()
    const m = fakeDb.memberships.find((x) => x.display_name === 'Dr. Iker Prueba')
    expect(m).toMatchObject({ role: 'doctor_collab', user_id: null })
    expect(fakeDb.invitations[0]).toMatchObject({ email: 'iker.prueba@example.test', role: 'doctor_collab', membership_id: m?.id })
    expect(await screen.findByText('Invitación pendiente a')).toBeInTheDocument()
  })

  it('la gerencia cambia el nombre en la clínica sin tocar la cuenta del doctor', async () => {
    seedTeam()
    const user = userEvent.setup()
    await renderApp('/doctores/m-d2')
    const form = await screen.findByRole('form', { name: 'Perfil del doctor' })
    expect(within(form).getByText(/usamos el de su cuenta: Dra\. Karla Vega Prueba/)).toBeInTheDocument()
    await user.type(within(form).getByLabelText('Nombre en tu clínica'), 'Dra. Karla Clínica')
    await user.click(within(form).getByRole('button', { name: 'Guardar perfil' }))
    expect(await screen.findByText('Listo. Guardamos el perfil.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Dra. Karla Clínica' })).toBeInTheDocument()
    expect(fakeDb.memberships.find((x) => x.id === 'm-d2')?.display_name).toBe('Dra. Karla Clínica')
    expect(fakeDb.profiles.find((p) => p.id === 'u-d2')?.full_name).toBe('Dra. Karla Vega Prueba')
    expect(fakeDb.doctor_settings.find((d) => d.membership_id === 'm-d2')).toMatchObject({ specialty: 'Endodoncia', calendar_color: 'orange' })
  })

  it('invita desde su perfil a un doctor sin acceso', async () => {
    seedTeam()
    const user = userEvent.setup()
    await renderApp('/doctores/m-off')
    const form = await screen.findByRole('form', { name: 'Invitar al doctor' })
    await user.type(within(form).getByLabelText('Correo del doctor'), 'no-es-correo')
    await user.click(within(form).getByRole('button', { name: 'Enviar invitación' }))
    expect(await within(form).findByText('Revisa el correo.')).toBeInTheDocument()
    await user.clear(within(form).getByLabelText('Correo del doctor'))
    await user.type(within(form).getByLabelText('Correo del doctor'), 'luis.prueba@example.test')
    await user.click(within(form).getByRole('button', { name: 'Enviar invitación' }))
    expect(await screen.findByText('Listo. Enviamos la invitación a luis.prueba@example.test.')).toBeInTheDocument()
    expect(fakeDb.invitations[0]).toMatchObject({ role: 'doctor_collab', membership_id: 'm-off' })
    await waitFor(() => expect(screen.getByText('luis.prueba@example.test')).toBeInTheDocument())
  })

  it('recepción ve a los doctores, pero no da de alta, no edita y no ve comisiones', async () => {
    seedTeam()
    await renderApp('/doctores', { role: 'reception' })
    await screen.findByText('Dra. Karla Vega Prueba')
    expect(screen.queryByRole('link', { name: 'Nuevo doctor' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Comisiones' })).not.toBeInTheDocument()
  })

  it('recepción ve el perfil solo para leer y no entra al alta', async () => {
    seedTeam()
    await renderApp('/doctores/m-d2', { role: 'reception' })
    expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument()
    expect(screen.getByText('Endodoncia')).toBeInTheDocument()
    expect(screen.getByText('Naranja')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar perfil' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Comisión' })).not.toBeInTheDocument()
  })

  it('el alta de doctores es solo para la gerencia', async () => {
    await renderApp('/doctores/nuevo', { role: 'reception' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Doctores' })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Nuevo doctor' })).not.toBeInTheDocument()
  })
})
