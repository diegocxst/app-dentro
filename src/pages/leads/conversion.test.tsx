import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BRANCH_ID, fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const DAY = '2030-01-07' // lunes lejano; CDMX = UTC-6
const DOCTOR = `m-${TENANT_ID}`
const BRANCH = { opening_hours: { mon: [['09:00', '14:00']] } }

function seed(over: Record<string, unknown> = {}) {
  fakeDb.chairs.push({ id: 'ch-1', tenant_id: TENANT_ID, branch_id: BRANCH_ID, name: 'Sillón 1', is_active: true })
  fakeDb.leads.push({
    id: 'lead-1', tenant_id: TENANT_ID, full_name: 'Andrés Lara Prueba', phone_e164: '+525512345678', email: null, interest: 'Valoración de implante',
    source: 'meta', status: 'contactado', lost_reason: null, assigned_to: null, notice_version: 'clinica-borrador-2026-11', converted_patient_id: null,
    first_response_at: '2026-11-15T11:00:00Z', status_changed_at: '2026-11-15T11:00:00Z', created_by: null, created_at: '2026-11-15T10:00:00Z', updated_at: '2026-11-15T10:00:00Z',
    ...over,
  })
}
function seedValoracion(start = '2030-01-07T22:30:00Z', end = '2030-01-07T23:00:00Z') {
  fakeDb.appointments.push({
    id: 'cita-1', tenant_id: TENANT_ID, branch_id: BRANCH_ID, chair_id: 'ch-1', doctor_id: DOCTOR, patient_id: null, lead_id: 'lead-1', treatment_id: null,
    kind: 'valoracion', status: 'programada', starts_at: start, ends_at: end, notes: null, cancel_reason: null,
  })
}

describe('M1-B · valoración del lead', () => {
  it('desde el lead se agenda su valoración sin crearlo como paciente', async () => {
    seed()
    const user = userEvent.setup()
    const { router } = await renderApp('/leads/lead-1', { branch: BRANCH })
    await user.click(await screen.findByRole('link', { name: 'Agendar valoración' }))
    await waitFor(() => expect(router.state.location.search).toBe('?lead=lead-1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Agendar valoración' })).toBeInTheDocument()
    expect(await screen.findByText('Andrés Lara Prueba')).toBeInTheDocument()
    expect(screen.getByLabelText('Tipo de cita')).toHaveValue('valoracion')
    expect(screen.getByLabelText('Tipo de cita')).toBeDisabled()
    await user.clear(screen.getByLabelText('Fecha'))
    await user.type(screen.getByLabelText('Fecha'), DAY)
    await screen.findByRole('option', { name: 'Sillón 1' })
    await user.selectOptions(screen.getByLabelText('Unidad dental'), 'ch-1')
    await user.selectOptions(screen.getByLabelText('Doctor'), DOCTOR)
    await user.selectOptions(screen.getByLabelText('Hora'), '10:00')
    await user.click(screen.getByRole('button', { name: 'Agendar cita' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('create_lead_appointment', expect.objectContaining({
      p_lead: 'lead-1', p_doctor: DOCTOR, p_branch: BRANCH_ID, p_chair: 'ch-1', p_starts_at: '2030-01-07T16:00:00.000Z', p_ends_at: '2030-01-07T17:00:00.000Z',
    }))
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('create_appointment', expect.anything())
    await waitFor(() => expect(router.state.location.pathname).toBe('/agenda'))
  })

  it('en la agenda la valoración se marca «Paciente nuevo» y ofrece convertirlo', async () => {
    seed({ status: 'valoracion' })
    seedValoracion()
    await renderApp(`/agenda?fecha=${DAY}&cita=cita-1`, { branch: BRANCH })
    const panel = await screen.findByRole('complementary', { name: 'Cita seleccionada' })
    expect(await within(panel).findByText('Paciente nuevo')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Convertir en paciente' })).toHaveAttribute('href', '/leads/lead-1/convertir')
    expect(within(panel).queryByRole('link', { name: 'Abrir ficha del paciente' })).not.toBeInTheDocument()
  })

  it('el doctor ve la valoración pero no el lead', async () => {
    seed({ status: 'valoracion' })
    seedValoracion()
    await renderApp(`/agenda?fecha=${DAY}&cita=cita-1`, { branch: BRANCH, role: 'doctor' })
    const panel = await screen.findByRole('complementary', { name: 'Cita seleccionada' })
    expect(await within(panel).findByText(/Aún no es paciente/)).toBeInTheDocument()
    expect(within(panel).queryByRole('link', { name: 'Abrir lead' })).not.toBeInTheDocument()
  })

  it('el detalle del lead lista sus valoraciones', async () => {
    seed({ status: 'valoracion' })
    const start = new Date(Date.now() + 7 * 86_400_000)
    start.setUTCMinutes(0, 0, 0)
    seedValoracion(start.toISOString(), new Date(start.getTime() + 1_800_000).toISOString())
    await renderApp('/leads/lead-1')
    const card = await screen.findByRole('region', { name: 'Valoraciones' })
    expect(within(card).getByText(/Sin confirmar/)).toBeInTheDocument()
  })
})

describe('M1-B · convertir en paciente', () => {
  it('exige el consentimiento y lleva a la ficha nueva con sus citas', async () => {
    seed({ status: 'valoracion' })
    seedValoracion()
    const user = userEvent.setup()
    const { router } = await renderApp('/leads/lead-1/convertir')
    expect(await screen.findByRole('heading', { level: 1, name: 'Convertir en paciente' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Convertir en paciente' }))
    expect(screen.getByText('Sin el consentimiento del paciente no podemos guardar sus datos de salud.')).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('convert_lead', expect.anything())
    await user.click(screen.getByLabelText('Aceptó en digital'))
    await user.click(screen.getByLabelText(/Confirmo que el paciente dio su consentimiento/))
    await user.click(screen.getByRole('button', { name: 'Convertir en paciente' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('convert_lead', { p_lead: 'lead-1', p_consent_method: 'digital' })
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/pacientes\/p-conv-/))
    expect(fakeDb.appointments[0]).toMatchObject({ lead_id: null, patient_id: expect.stringMatching(/^p-conv-/) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Andrés Lara Prueba' })).toBeInTheDocument()
  })

  it('si ya hay un paciente con su teléfono, ofrece vincularlo sin duplicar', async () => {
    seed()
    fakeDb.patients.push({ id: 'p-9', tenant_id: TENANT_ID, full_name: 'Andrés Lara', phone_e164: '+525512345678', email: null, archived_at: null, tags: [], source: 'manual', created_at: '2026-01-01T00:00:00Z' })
    const user = userEvent.setup()
    const { router } = await renderApp('/leads/lead-1/convertir')
    expect(await screen.findByRole('heading', { name: 'Ya existe un paciente con este teléfono o correo' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vincular con Andrés' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('convert_lead', { p_lead: 'lead-1', p_patient: 'p-9' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/pacientes/p-9'))
    expect(fakeDb.patients).toHaveLength(1)
  })

  it('un lead convertido lleva a su ficha', async () => {
    seed({ status: 'convertido', converted_patient_id: 'p-9' })
    await renderApp('/leads/lead-1/convertir')
    expect(await screen.findByRole('link', { name: 'Abrir ficha del paciente' })).toHaveAttribute('href', '/pacientes/p-9')
  })
})
