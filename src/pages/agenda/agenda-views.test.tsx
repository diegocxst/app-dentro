import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assignLanes, weekStart } from '@/lib/agenda'
import { GUIDE_TASKS } from '@/lib/onboarding'
import { BRANCH_ID, fakeDb, fakeSupabase, fakeTenant, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const DOCTOR = `m-${TENANT_ID}`
const BRANCH = { opening_hours: { mon: [['09:00', '14:00']], tue: [['09:00', '14:00']], wed: [['09:00', '14:00']] } }

function seed() {
  fakeDb.chairs.push(
    { id: 'ch-1', tenant_id: TENANT_ID, branch_id: BRANCH_ID, name: 'Sillón 1', is_active: true },
    { id: 'ch-2', tenant_id: TENANT_ID, branch_id: BRANCH_ID, name: 'Sillón 2', is_active: true },
  )
  fakeDb.patients.push(
    { id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', phone_e164: null, archived_at: null, tags: [], source: 'manual', created_at: '2026-11-16T10:00:00Z' },
    { id: 'p-2', tenant_id: TENANT_ID, full_name: 'Jorge Ramírez Prueba', phone_e164: null, archived_at: null, tags: [], source: 'manual', created_at: '2026-11-16T10:00:00Z' },
  )
}
function cita(id: string, patient: string, chair: string, start: string, end: string, status = 'programada') {
  fakeDb.appointments.push({
    id, tenant_id: TENANT_ID, branch_id: BRANCH_ID, chair_id: chair, doctor_id: DOCTOR, patient_id: patient, treatment_id: null,
    kind: 'tratamiento', status, starts_at: start, ends_at: end, notes: null, cancel_reason: null,
  })
}

describe('reglas de las vistas', () => {
  it('la semana empieza en lunes', () => {
    expect(weekStart('2030-01-09')).toBe('2030-01-07')
    expect(weekStart('2030-01-13')).toBe('2030-01-07')
    expect(weekStart('2030-01-07')).toBe('2030-01-07')
  })

  it('reparte en carriles las citas que se enciman', () => {
    const m = assignLanes([
      { id: 'a', from: 600, to: 660 },
      { id: 'b', from: 630, to: 690 },
      { id: 'c', from: 700, to: 730 },
    ])
    expect(m.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(m.get('b')).toEqual({ lane: 1, lanes: 2 })
    expect(m.get('c')).toEqual({ lane: 0, lanes: 1 })
  })
})

describe('M3-B · vistas de la agenda', () => {
  it('Semana: pide los 7 días y pinta cada cita en su día', async () => {
    seed()
    cita('c1', 'p-1', 'ch-1', '2030-01-07T16:00:00Z', '2030-01-07T17:00:00Z')
    cita('c2', 'p-2', 'ch-2', '2030-01-09T17:00:00Z', '2030-01-09T18:00:00Z', 'confirmada')
    const user = userEvent.setup()
    const { router } = await renderApp('/agenda?fecha=2030-01-09&vista=semana', { branch: BRANCH })
    expect(await screen.findByRole('heading', { name: 'Semana del lun 7 de ene al dom 13 de ene' })).toBeInTheDocument()
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('list_appointments', { p_from: '2030-01-07T06:00:00.000Z', p_to: '2030-01-14T06:00:00.000Z', p_branch: BRANCH_ID })
    expect(await screen.findByRole('button', { name: '10:00 Laura Méndez Prueba · Sin confirmar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '11:00 Jorge Ramírez Prueba · Confirmada' })).toBeInTheDocument()
    // Clic en el encabezado de un día → vista Día de esa fecha.
    await user.click(screen.getByRole('button', { name: /Ver el día mié/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?fecha=2030-01-09'))
  })

  it('Semana: avanzar mueve 7 días y un hueco agenda ese día', async () => {
    seed()
    const user = userEvent.setup()
    const { router } = await renderApp('/agenda?fecha=2030-01-07&vista=semana', { branch: BRANCH })
    await user.click(await screen.findByRole('button', { name: 'Semana siguiente' }))
    await waitFor(() => expect(router.state.location.search).toContain('fecha=2030-01-14'))
    await user.click(await screen.findByRole('button', { name: /^Agendar el mar 15 a las 10:00$/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?fecha=2030-01-15&hora=10%3A00'))
  })

  it('Por sillón: una columna por sillón y el hueco pasa el sillón al formulario', async () => {
    seed()
    cita('c1', 'p-1', 'ch-2', '2030-01-07T16:00:00Z', '2030-01-07T17:00:00Z')
    const user = userEvent.setup()
    const { router } = await renderApp('/agenda?fecha=2030-01-07&vista=sillon', { branch: BRANCH })
    expect(await screen.findByRole('button', { name: '10:00 Laura Méndez Prueba · Sin confirmar' })).toBeInTheDocument()
    expect(screen.getByText('Sillón 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Agendar a las 11:00 en Sillón 1' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/agenda/nueva'))
    await screen.findByRole('option', { name: 'Sillón 1' })
    expect(screen.getByLabelText('Sillón')).toHaveValue('ch-1')
    expect(screen.getByLabelText('Hora')).toHaveValue('11:00')
  })

  it('el selector cambia de vista y conserva la fecha', async () => {
    seed()
    const user = userEvent.setup()
    const { router } = await renderApp('/agenda?fecha=2030-01-07', { branch: BRANCH })
    await user.click(await screen.findByRole('button', { name: 'Por sillón' }))
    await waitFor(() => expect(router.state.location.search).toBe('?fecha=2030-01-07&vista=sillon'))
    expect(screen.getByRole('button', { name: 'Por sillón' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('M3-B · Mi día', () => {
  afterEach(() => vi.useRealTimers())

  it('muestra las citas de hoy, las que faltan por confirmar y las siguientes', async () => {
    // Lunes 7 ene 2030, 9:00 en CDMX (solo se finge la fecha, no los temporizadores).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-07T15:00:00Z'))
    seed()
    cita('c1', 'p-1', 'ch-1', '2030-01-07T16:00:00Z', '2030-01-07T17:00:00Z')
    cita('c2', 'p-2', 'ch-2', '2030-01-07T18:00:00Z', '2030-01-07T18:30:00Z', 'confirmada')
    cita('c3', 'p-2', 'ch-1', '2030-01-07T19:00:00Z', '2030-01-07T19:30:00Z', 'cancelada')
    const done = Object.fromEntries(GUIDE_TASKS.map((t) => [t.id, true]))
    await renderApp('/', { branch: BRANCH, tenant: fakeTenant({ onboarding_state: { tasks: done } }) })
    const day = await screen.findByRole('region', { name: 'Mi día' })
    await waitFor(() => expect(within(day).getByText('Citas hoy', { selector: 'dt' }).nextElementSibling).toHaveTextContent('2'))
    expect(within(day).getByText('Sin confirmar', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
    const list = within(day).getByRole('list', { name: 'Siguientes citas' })
    expect(within(list).getAllByRole('link').map((l) => l.textContent)).toEqual([
      expect.stringContaining('10:00'),
      expect.stringContaining('12:00'),
    ])
    expect(within(list).getAllByRole('link')[0]).toHaveAttribute('href', '/agenda?fecha=2030-01-07&cita=c1')
  })

  it('sin citas lo dice y lleva a la agenda', async () => {
    seed()
    await renderApp('/', { branch: BRANCH })
    const day = await screen.findByRole('region', { name: 'Mi día' })
    expect(await within(day).findByText(/No tienes más citas hoy/)).toBeInTheDocument()
  })
})
