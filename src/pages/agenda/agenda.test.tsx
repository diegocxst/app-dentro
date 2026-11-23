import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { confirmWhatsappUrl, dayKey, startOptions, withinHours, zonedParts, zonedToUtc } from '@/lib/agenda'
import { BRANCH_ID, fakeDb, fakeSupabase, fakeTenant, rpcOverrides, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

// Lunes lejano (siempre en el futuro). CDMX = UTC-6 todo el año.
const DAY = '2030-01-07'
const DOCTOR = `m-${TENANT_ID}`

const BRANCH = { opening_hours: { mon: [['09:00', '14:00']] } }
function seedAgenda() {
  fakeDb.chairs.push({ id: 'ch-1', tenant_id: TENANT_ID, branch_id: BRANCH_ID, name: 'Sillón 1', is_active: true, created_at: '2026-11-15T00:00:00Z' })
  fakeDb.patients.push({
    id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', birth_date: null, phone_e164: '+525512345678', email: null,
    source: 'manual', primary_doctor_id: null, tags: [], archived_at: null, created_at: '2026-11-16T10:00:00Z',
    consent: { method: 'papel', notice_version: 'clinica-borrador-2026-11', recorded_at: '2026-11-16T10:00:00Z' },
  })
}
function seedAppointment(over: Record<string, unknown> = {}) {
  fakeDb.appointments.push({
    id: 'cita-1', tenant_id: TENANT_ID, branch_id: BRANCH_ID, chair_id: 'ch-1', doctor_id: DOCTOR, patient_id: 'p-1', treatment_id: null,
    kind: 'valoracion', status: 'programada', starts_at: '2030-01-07T16:00:00Z', ends_at: '2030-01-07T17:00:00Z', notes: null, cancel_reason: null, ...over,
  })
}

describe('reglas de la agenda', () => {
  it('convierte la hora local de la sucursal a UTC según su zona', () => {
    expect(zonedToUtc('2030-01-07', '10:00', 'America/Mexico_City')).toBe('2030-01-07T16:00:00.000Z')
    expect(zonedToUtc('2030-01-07', '10:00', 'America/Tijuana')).toBe('2030-01-07T18:00:00.000Z')
    expect(zonedToUtc('2030-07-08', '10:00', 'America/Tijuana')).toBe('2030-07-08T17:00:00.000Z') // horario de verano en la frontera
    expect(zonedParts(new Date('2030-01-07T16:00:00Z'), 'America/Cancun')).toEqual({ date: '2030-01-07', time: '11:00' })
    expect(dayKey('2030-01-07')).toBe('mon')
  })

  it('solo ofrece horas dentro del horario de la sucursal', () => {
    expect(startOptions([['09:00', '10:00']], 30)).toEqual(['09:00', '09:15', '09:30'])
    expect(withinHours([['09:00', '14:00']], '13:30', '14:30')).toBe(false)
    expect(withinHours([['09:00', '14:00']], '13:00', '14:00')).toBe(true)
    expect(confirmWhatsappUrl('+525512345678', { patient: 'Laura Méndez', clinic: 'Dientitos', date: '2030-01-07', time: '10:00' })).toMatch(
      /^https:\/\/wa\.me\/525512345678\?text=Hola%20Laura%2C/,
    )
  })
})

describe('M3-A · agenda del día', () => {
  it('muestra la cita en la columna del doctor y se confirma desde el detalle', async () => {
    seedAgenda()
    seedAppointment()
    const user = userEvent.setup()
    await renderApp(`/agenda?fecha=${DAY}`, { branch: BRANCH })
    const block = await screen.findByRole('button', { name: '10:00 Laura Méndez Prueba · Sin confirmar' })
    await user.click(block)
    const panel = screen.getByRole('complementary', { name: 'Cita seleccionada' })
    expect(within(panel).getByRole('heading', { name: 'Laura Méndez Prueba' })).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Confirmar por WhatsApp' })).toHaveAttribute('href', expect.stringContaining('wa.me/525512345678'))
    await user.click(within(panel).getByRole('button', { name: 'Marcar confirmada' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_appointment_status', { p_appointment: 'cita-1', p_status: 'confirmada' })
    expect(await screen.findByRole('button', { name: '10:00 Laura Méndez Prueba · Confirmada' })).toBeInTheDocument()
  })

  it('pide la agenda del día en la zona de la sucursal', async () => {
    seedAgenda()
    await renderApp(`/agenda?fecha=${DAY}`, { branch: BRANCH })
    await waitFor(() =>
      expect(fakeSupabase.rpc).toHaveBeenCalledWith('list_appointments', { p_from: '2030-01-07T06:00:00.000Z', p_to: '2030-01-08T06:00:00.000Z', p_branch: BRANCH_ID }),
    )
  })

  it('un día cerrado lo explica y no ofrece horarios', async () => {
    seedAgenda()
    await renderApp('/agenda?fecha=2030-01-06', { branch: BRANCH })
    expect(await screen.findByText('La sucursal no abre este día.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Agendar a las/ })).not.toBeInTheDocument()
  })

  it('cancelar pide confirmación y guarda el motivo', async () => {
    seedAgenda()
    seedAppointment()
    const user = userEvent.setup()
    await renderApp(`/agenda?fecha=${DAY}&cita=cita-1`, { branch: BRANCH })
    await user.click(await screen.findByRole('button', { name: 'Cancelar cita' }))
    await user.type(screen.getByLabelText('Motivo (opcional)'), 'Avisó que no puede')
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar la cita' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_appointment_status', { p_appointment: 'cita-1', p_status: 'cancelada', p_reason: 'Avisó que no puede' })
  })
})

describe('M3-A · nueva cita', () => {
  it('agenda desde un hueco de la agenda con el doctor y la hora puestos', async () => {
    seedAgenda()
    const user = userEvent.setup()
    const { router } = await renderApp(`/agenda?fecha=${DAY}`, { branch: BRANCH })
    await user.click(await screen.findByRole('button', { name: 'Agendar a las 11:00 con Dueña Prueba' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/agenda/nueva'))
    await user.type(screen.getByLabelText('Busca al paciente'), 'Laura')
    await user.click(await screen.findByRole('button', { name: /Laura Méndez Prueba/ }))
    await screen.findByRole('option', { name: 'Sillón 1' })
    await user.selectOptions(screen.getByLabelText('Unidad dental'), 'ch-1')
    expect(screen.getByLabelText('Hora')).toHaveValue('11:00')
    expect(screen.getByLabelText('Doctor')).toHaveValue(DOCTOR)
    await user.click(screen.getByRole('button', { name: 'Agendar cita' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('create_appointment', expect.objectContaining({
      p_patient: 'p-1', p_doctor: DOCTOR, p_branch: BRANCH_ID, p_chair: 'ch-1',
      p_starts_at: '2030-01-07T17:00:00.000Z', p_ends_at: '2030-01-07T18:00:00.000Z', p_kind: 'tratamiento',
    }))
    await waitFor(() => expect(router.state.location.search).toContain('cita=cita-1'))
  })

  it('si el horario está ocupado lo explica', async () => {
    seedAgenda()
    seedAppointment()
    const user = userEvent.setup()
    await renderApp(`/agenda/nueva?fecha=${DAY}&hora=10:00&paciente=p-1&doctor=${DOCTOR}`, { branch: BRANCH })
    await screen.findByText('Laura Méndez Prueba')
    await screen.findByRole('option', { name: 'Sillón 1' })
    await user.selectOptions(screen.getByLabelText('Unidad dental'), 'ch-1')
    await user.click(screen.getByRole('button', { name: 'Agendar cita' }))
    expect(await screen.findByText('Ese horario ya está ocupado: la unidad dental o el doctor tienen otra cita.')).toBeInTheDocument()
  })

  it('fuera de horario no se agenda y manda a escribir a la clínica', async () => {
    seedAgenda()
    rpcOverrides.create_appointment = () => Promise.resolve({ data: null, error: { code: 'DH001', message: 'Fuera del horario de la sucursal' } })
    const user = userEvent.setup()
    await renderApp(`/agenda/nueva?fecha=${DAY}&hora=10:00&paciente=p-1&doctor=${DOCTOR}`, { branch: BRANCH, tenant: fakeTenant({ whatsapp_e164: '+525598765432' }) })
    await screen.findByText('Laura Méndez Prueba')
    await screen.findByRole('option', { name: 'Sillón 1' })
    await user.selectOptions(screen.getByLabelText('Unidad dental'), 'ch-1')
    await user.click(screen.getByRole('button', { name: 'Agendar cita' }))
    expect(await screen.findByText(/fuera del horario de la sucursal\. Escribe a la clínica o al doctor/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Escribir a la clínica por WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/525598765432')
  })

  it('un día cerrado no ofrece horas', async () => {
    seedAgenda()
    await renderApp('/agenda/nueva?fecha=2030-01-06&paciente=p-1', { branch: BRANCH })
    expect(await screen.findByText(/La sucursal no abre ese día/)).toBeInTheDocument()
    expect(within(screen.getByLabelText('Hora')).queryAllByRole('option').filter((o) => (o as HTMLOptionElement).value)).toHaveLength(0)
  })

  it('un doctor solo agenda en su agenda', async () => {
    seedAgenda()
    await renderApp(`/agenda/nueva?fecha=${DAY}&paciente=p-1`, { role: 'doctor', branch: BRANCH })
    const doctor = await screen.findByLabelText('Doctor')
    expect(doctor).toBeDisabled()
    await waitFor(() => expect(doctor).toHaveValue(DOCTOR))
  })
})

describe('M3-A · ficha y configuración', () => {
  it('la ficha muestra la próxima cita y la pestaña Citas', async () => {
    seedAgenda()
    // La ficha mira un año hacia adelante: la cita es en una semana.
    const start = new Date(Date.now() + 7 * 86_400_000)
    start.setUTCMinutes(0, 0, 0)
    seedAppointment({ starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 3_600_000).toISOString() })
    const user = userEvent.setup()
    await renderApp('/pacientes/p-1', { branch: BRANCH })
    expect(await screen.findByRole('link', { name: /· \d{2}:00$/ })).toHaveAttribute('href', expect.stringContaining('cita=cita-1'))
    await user.click(screen.getByRole('tab', { name: /Citas/ }))
    expect(await screen.findByRole('region', { name: 'Citas próximas' })).toHaveTextContent('Sin confirmar')
    expect(screen.getByRole('link', { name: 'Agendar cita' })).toHaveAttribute('href', '/agenda/nueva?paciente=p-1')
  })

  it('la sucursal guarda su zona horaria', async () => {
    seedAgenda()
    const user = userEvent.setup()
    await renderApp('/configuracion/sucursales', { branch: BRANCH })
    await user.selectOptions(await screen.findByLabelText('Zona horaria'), 'America/Tijuana')
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_branch_timezone', { p_branch: BRANCH_ID, p_timezone: 'America/Tijuana' })
  })
})
