import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { agendaErrorMessage } from '@/data/agenda'
import { canSeeCommissions, canSeeSection, menuFor, mobileTabsFor, seesMoney } from '@/lib/access'
import { doctorRanges, intersectRanges, OUT_OF_DOCTOR_HOURS } from '@/lib/agenda'
import { hoursProblem } from '@/lib/hours'
import { ROLE_LABEL } from '@/lib/roles'
import { BRANCH_ID, fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const ME = `m-${TENANT_ID}`
const DAY = '2030-01-07' // lunes
const BRANCH = { opening_hours: { mon: [['09:00', '14:00']], tue: [['09:00', '14:00']] } }

function seedDoctor(schedule: Record<string, [string, string][]> | null = null) {
  fakeDb.memberships.push({ id: 'm-d2', tenant_id: TENANT_ID, user_id: 'u-d2', role: 'doctor', status: 'active', display_name: '', created_at: '2026-11-15T00:00:00Z' })
  fakeDb.profiles.push({ id: 'u-d2', full_name: 'Dra. Karla Vega Prueba', phone_e164: null, avatar_path: null, title: '' })
  fakeDb.doctor_settings.push({ membership_id: 'm-d2', tenant_id: TENANT_ID, specialty: 'Endodoncia', calendar_color: null, phone_e164: null, schedule })
}

describe('M6-B2a · reglas de horario y pasante', () => {
  it('cruza el horario de la sucursal con el del doctor', () => {
    expect(intersectRanges([['09:00', '19:00']], [['09:00', '14:00'], ['16:00', '20:00']])).toEqual([
      ['09:00', '14:00'],
      ['16:00', '19:00'],
    ])
    expect(doctorRanges({ mon: [['09:00', '14:00']] }, { mon: [['10:00', '12:00']] }, DAY)).toEqual([['10:00', '12:00']])
    expect(doctorRanges({ mon: [['09:00', '14:00']] }, null, DAY)).toEqual([['09:00', '14:00']])
    expect(doctorRanges({ mon: [['09:00', '14:00']] }, { tue: [['09:00', '14:00']] }, DAY)).toEqual([])
    expect(hoursProblem({ mon: [['09:00', '10:00'], ['11:00', '12:00'], ['13:00', '14:00']] }, 2)).toBe('Lunes: máximo 2 horarios por día.')
    expect(agendaErrorMessage({ code: 'DH002' })).toBe(OUT_OF_DOCTOR_HOURS)
  })

  it('el pasante no ve presupuestos, cobros ni comisiones', () => {
    expect(ROLE_LABEL.doctor_intern).toBe('Pasante')
    expect(seesMoney('doctor_intern')).toBe(false)
    expect(seesMoney('doctor')).toBe(true)
    expect(canSeeSection('doctor_intern', 'presupuestos')).toBe(false)
    expect(canSeeSection('doctor_intern', 'cobros')).toBe(false)
    expect(canSeeCommissions('doctor_intern')).toBe(false)
    expect(menuFor('doctor_intern').map((s) => s.label)).toEqual(['Inicio', 'Agenda', 'Pacientes', 'Seguimientos', 'Tu equipo', 'Configuración'])
    expect(mobileTabsFor('doctor_intern')).toEqual(['inicio', 'agenda', 'pacientes', 'seguimientos'])
  })
})

describe('M6-B2a · horario del doctor', () => {
  it('la gerencia pone el horario en el perfil del doctor (hasta dos turnos)', async () => {
    seedDoctor()
    const user = userEvent.setup()
    await renderApp('/doctores/m-d2')
    const card = await screen.findByRole('region', { name: 'Horario' })
    expect(card).toHaveTextContent('Sin horario propio: usa el de la sucursal')
    await user.click(within(card).getByRole('button', { name: 'Editar horario' }))
    await user.click(within(card).getByRole('checkbox', { name: 'Lunes' }))
    const from = within(card).getByLabelText('Lunes, abre (horario 1)')
    await user.clear(from)
    await user.type(from, '10:00')
    await user.click(within(card).getByRole('button', { name: '+ Otro horario' }))
    expect(within(card).queryByRole('button', { name: '+ Otro horario' })).not.toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Guardar horario' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_doctor_schedule', {
      p_membership: 'm-d2',
      p_hours: { mon: [['10:00', '18:00'], ['18:00', '20:00']] },
    })
    expect(await screen.findByText('Guardamos el horario.')).toBeInTheDocument()
  })

  it('el doctor edita su propio horario y, si lo deja vacío, vuelve al de la sucursal', async () => {
    fakeDb.doctor_settings.push({ membership_id: ME, tenant_id: TENANT_ID, specialty: '', calendar_color: null, phone_e164: null, schedule: { mon: [['09:00', '11:00']] } })
    const user = userEvent.setup()
    await renderApp(`/doctores/${ME}`, { role: 'doctor' })
    const card = await screen.findByRole('region', { name: 'Horario' })
    expect(card).toHaveTextContent('Lun 09:00–11:00')
    await user.click(within(card).getByRole('button', { name: 'Editar horario' }))
    await user.click(within(card).getByRole('checkbox', { name: 'Lunes' }))
    await user.click(within(card).getByRole('button', { name: 'Guardar horario' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_doctor_schedule', { p_membership: ME, p_hours: null })
    expect(await screen.findByText('Quitamos el horario: se usará el de la sucursal.')).toBeInTheDocument()
  })

  it('recepción ve el horario pero no lo cambia', async () => {
    seedDoctor({ mon: [['09:00', '11:00']] })
    await renderApp('/doctores/m-d2', { role: 'reception' })
    const card = await screen.findByRole('region', { name: 'Horario' })
    expect(card).toHaveTextContent('Lun 09:00–11:00')
    expect(within(card).queryByRole('button', { name: 'Editar horario' })).not.toBeInTheDocument()
  })

  it('en la agenda, fuera del horario del doctor no hay huecos para agendar', async () => {
    seedDoctor({ mon: [['10:00', '12:00']] })
    await renderApp(`/agenda?fecha=${DAY}`, { branch: BRANCH })
    expect(await screen.findByRole('button', { name: 'Agendar a las 10:00 con Dra. Karla Vega Prueba' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agendar a las 09:00 con Dra. Karla Vega Prueba' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agendar a las 12:00 con Dra. Karla Vega Prueba' })).not.toBeInTheDocument()
    // Quien no tiene horario propio sigue con el de la sucursal.
    expect(screen.getByRole('button', { name: 'Agendar a las 09:00 con Dueña Prueba' })).toBeInTheDocument()
  })

  it('al agendar solo ofrece horas dentro del horario del doctor', async () => {
    seedDoctor({ mon: [['10:00', '11:00']] })
    fakeDb.chairs.push({ id: 'ch-1', tenant_id: TENANT_ID, branch_id: BRANCH_ID, name: 'Sillón 1', is_active: true })
    const user = userEvent.setup()
    await renderApp(`/agenda/nueva?fecha=${DAY}`, { branch: BRANCH })
    await screen.findByRole('option', { name: 'Dra. Karla Vega Prueba' })
    await user.selectOptions(screen.getByLabelText('Doctor'), 'm-d2')
    const hours = within(screen.getByLabelText('Hora')).getAllByRole('option').map((o) => o.textContent)
    expect(hours).toContain('10:00')
    expect(hours).not.toContain('09:00')
    expect(hours).not.toContain('12:00')
  })
})

describe('M6-B2a · pasante en pantalla', () => {
  it('Inicio sin montos ni comisiones; menú sin presupuestos ni cobros', async () => {
    await renderApp('/', { role: 'doctor_intern' })
    const summary = await screen.findByRole('region', { name: 'Mi resumen' })
    await waitFor(() => expect(within(summary).getByText('Mis pacientes')).toBeInTheDocument())
    expect(within(summary).queryByText(/Presupuestos aceptados/)).not.toBeInTheDocument()
    expect(within(summary).queryByRole('link', { name: 'Ver mis comisiones' })).not.toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('quote_stats', expect.anything())
    const nav = screen.getByRole('navigation', { name: 'Menú principal' })
    const links = within(nav).getAllByRole('link').map((l) => l.textContent)
    expect(links).not.toContain('Presupuestos')
    expect(links).not.toContain('Cobros')
    expect(within(nav).getByText(/· Pasante$/)).toBeInTheDocument()
  })

  it.each(['/presupuestos', '/presupuestos/nuevo', '/cobros', '/doctores/comisiones'])('si abre %s vuelve a Inicio', async (path) => {
    const { router } = await renderApp(path, { role: 'doctor_intern' })
    await waitFor(() => expect(router.state.location.pathname).not.toBe(path))
  })

  it('en la ficha del paciente no ve Presupuestos, Pagos ni la cuenta', async () => {
    fakeDb.patients.push({ id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', primary_doctor_id: ME, phone_e164: null, email: null, archived_at: null, tags: [], source: 'manual', created_at: '2026-11-16T10:00:00Z' })
    await renderApp('/pacientes/p-1', { role: 'doctor_intern' })
    const tabs = await screen.findByRole('tablist')
    const names = within(tabs).getAllByRole('tab').map((t) => t.textContent)
    expect(names.some((n) => n?.startsWith('Presupuestos'))).toBe(false)
    expect(names.some((n) => n?.startsWith('Pagos'))).toBe(false)
    expect(screen.queryByText('Cuenta')).not.toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('patient_account', expect.anything())
  })

  it('la gerencia puede dar de alta un pasante sin acceso', async () => {
    const user = userEvent.setup()
    await renderApp('/doctores/nuevo')
    await user.type(await screen.findByLabelText('Nombre'), 'Pasante Prueba')
    await user.selectOptions(screen.getByLabelText('Tipo'), 'doctor_intern')
    await user.click(screen.getByRole('button', { name: 'Agregar doctor' }))
    await waitFor(() => expect(fakeSupabase.rpc).toHaveBeenCalledWith('create_doctor', expect.objectContaining({ p_role: 'doctor_intern' })))
  })
})
