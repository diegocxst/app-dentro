import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ageFrom, likePattern } from '@/lib/patients'
import { fakeDb, fakeSupabase, fakeTenant, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

function seedPatients(n: number) {
  for (let i = 1; i <= n; i++) {
    fakeDb.patients.push({
      id: `p-${i}`,
      tenant_id: TENANT_ID,
      full_name: `Paciente ${String(i).padStart(2, '0')} Prueba`,
      birth_date: '1990-01-01',
      phone_e164: `+5255000000${String(i).padStart(2, '0')}`,
      email: null,
      source: 'manual',
      primary_doctor_id: null,
      tags: [],
      archived_at: null,
      created_at: '2026-11-16T10:00:00Z',
      consent: { method: 'papel', notice_version: 'clinica-borrador-2026-11', recorded_at: '2026-11-16T10:00:00Z' },
    })
  }
}

describe('utilidades de pacientes', () => {
  it('calcula la edad cumplida', () => {
    expect(ageFrom('1990-05-10', new Date(2026, 4, 9))).toBe(35)
    expect(ageFrom('1990-05-10', new Date(2026, 4, 10))).toBe(36)
    expect(ageFrom(null)).toBeNull()
  })
  it('escapa los comodines de la búsqueda', () => {
    expect(likePattern(' 50%_ana ')).toBe('%50\\%\\_ana%')
  })
})

describe('P14 · lista de pacientes', () => {
  it('sin pacientes invita a registrar el primero', async () => {
    await renderApp('/pacientes')
    expect(await screen.findByRole('heading', { name: 'Aún no tienes pacientes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar paciente' })).toHaveAttribute('href', '/pacientes/nuevo')
  })

  it('pagina en el servidor de 25 en 25', async () => {
    const user = userEvent.setup()
    seedPatients(30)
    await renderApp('/pacientes')
    const list = await screen.findByRole('list', { name: 'Lista de pacientes' })
    expect(within(list).getAllByRole('link')).toHaveLength(25)
    expect(screen.getByText('1–25 de 30')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('26–30 de 30')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Lista de pacientes' })).getAllByRole('link')).toHaveLength(5)
  })

  it('busca por nombre o teléfono', async () => {
    const user = userEvent.setup()
    seedPatients(12)
    await renderApp('/pacientes')
    await screen.findByRole('list', { name: 'Lista de pacientes' })
    await user.type(screen.getByLabelText('Buscar pacientes'), 'Paciente 07')
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Lista de pacientes' })).getAllByRole('link')).toHaveLength(1))
    await user.clear(screen.getByLabelText('Buscar pacientes'))
    await user.type(screen.getByLabelText('Buscar pacientes'), '00000011')
    await waitFor(() => expect(screen.getByText('Paciente 11 Prueba')).toBeInTheDocument())
    await user.clear(screen.getByLabelText('Buscar pacientes'))
    await user.type(screen.getByLabelText('Buscar pacientes'), 'Nadie')
    expect(await screen.findByRole('heading', { name: 'No encontramos pacientes' })).toBeInTheDocument()
  })

  it('separa los archivados', async () => {
    const user = userEvent.setup()
    seedPatients(2)
    fakeDb.patients[1]!.archived_at = '2026-11-16T12:00:00Z'
    await renderApp('/pacientes')
    expect(await screen.findByText('Paciente 01 Prueba')).toBeInTheDocument()
    expect(screen.queryByText('Paciente 02 Prueba')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archivados' }))
    expect(await screen.findByText('Paciente 02 Prueba')).toBeInTheDocument()
  })
})

describe('P16 · nuevo paciente', () => {
  it('no guarda sin consentimiento', async () => {
    const user = userEvent.setup()
    await renderApp('/pacientes/nuevo')
    await user.type(await screen.findByLabelText('Nombre completo'), 'Laura Prueba')
    await user.click(screen.getByRole('button', { name: 'Guardar paciente' }))
    expect(await screen.findByText('Sin el consentimiento del paciente no podemos guardar sus datos.')).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('create_patient', expect.anything())
  })

  it('registra con consentimiento, marca la guía y abre la ficha', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/pacientes/nuevo', { tenant: fakeTenant({ onboarding_state: { tasks: { identity: true } } }) })
    await user.type(await screen.findByLabelText('Nombre completo'), 'Laura Prueba')
    await user.type(screen.getByLabelText('Fecha de nacimiento'), '1997-03-02')
    await user.type(screen.getByLabelText('Teléfono o WhatsApp'), '55 1234 5678')
    await user.selectOptions(screen.getByLabelText('¿Cómo llegó?'), 'referido')
    await user.click(screen.getByRole('radio', { name: 'Lo aceptó en digital' }))
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que el paciente dio su consentimiento/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar paciente' }))

    expect(fakeSupabase.rpc).toHaveBeenCalledWith('create_patient', {
      p_tenant: TENANT_ID,
      p_full_name: 'Laura Prueba',
      p_consent_method: 'digital',
      p_birth_date: '1997-03-02',
      p_phone_e164: '+525512345678',
      p_source: 'referido',
    })
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_onboarding_task', { p_tenant: TENANT_ID, p_task: 'first_patient', p_done: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/pacientes/p-1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Laura Prueba' })).toBeInTheDocument()
  })

  it('un doctor no elige doctor tratante (queda él)', async () => {
    await renderApp('/pacientes/nuevo', { role: 'doctor' })
    await screen.findByLabelText('Nombre completo')
    expect(screen.queryByLabelText('Doctor tratante')).not.toBeInTheDocument()
  })
})

describe('P15 · ficha del paciente', () => {
  it('abre la ficha con open_patient y muestra el consentimiento', async () => {
    seedPatients(1)
    await renderApp('/pacientes/p-1')
    expect(await screen.findByRole('heading', { level: 1, name: 'Paciente 01 Prueba' })).toBeInTheDocument()
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('open_patient', { p_patient: 'p-1' })
    expect(fakeDb.patient_access_log).toContainEqual({ patient_id: 'p-1', action: 'view' })
    expect(screen.getByText(/Firmado en papel/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/525500000001')
  })

  it('escribe una nota', async () => {
    const user = userEvent.setup()
    seedPatients(1)
    await renderApp('/pacientes/p-1')
    await user.click(await screen.findByRole('tab', { name: /Notas/ }))
    await user.type(screen.getByLabelText('Nueva nota'), 'Le preocupa el precio')
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('add_patient_note', { p_patient: 'p-1', p_body: 'Le preocupa el precio' })
    expect(await screen.findByText('Le preocupa el precio')).toBeInTheDocument()
  })

  it('las pestañas de módulos futuros explican qué va ahí', async () => {
    const user = userEvent.setup()
    seedPatients(1)
    await renderApp('/pacientes/p-1')
    await user.click(await screen.findByRole('tab', { name: 'Citas' }))
    expect(screen.getByText(/cuando llegue la Agenda/)).toBeInTheDocument()
  })

  it('recepción archiva; un doctor no ve el botón', async () => {
    const user = userEvent.setup()
    seedPatients(1)
    const first = await renderApp('/pacientes/p-1', { role: 'reception' })
    await user.click(await screen.findByRole('button', { name: 'Archivar' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_patient_archived', { p_patient: 'p-1', p_archived: true })
    expect(await screen.findByText('Archivamos al paciente. Sus datos se conservan.')).toBeInTheDocument()
    first.unmount()
  })

  it('un doctor no ve «Archivar»', async () => {
    seedPatients(1)
    await renderApp('/pacientes/p-1', { role: 'doctor' })
    await screen.findByRole('heading', { level: 1, name: 'Paciente 01 Prueba' })
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument()
  })

  it('si no existe o no hay acceso, lo explica', async () => {
    await renderApp('/pacientes/no-existe')
    expect(await screen.findByRole('heading', { level: 1, name: 'No encontramos a este paciente' })).toBeInTheDocument()
  })

  it('al editar solo manda lo que cambió', async () => {
    const user = userEvent.setup()
    seedPatients(1)
    const { router } = await renderApp('/pacientes/p-1/editar')
    const phone = await screen.findByLabelText('Teléfono o WhatsApp')
    await user.clear(phone)
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_patient', { p_patient: 'p-1', p_phone_e164: '' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/pacientes/p-1'))
  })
})
