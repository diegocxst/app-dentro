import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daysLeft, exportFileName } from '@/lib/arco'
import { fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

vi.mock('./exportPdf', () => ({ renderExportPdf: vi.fn(() => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' }))) }))

function seedPatient() {
  fakeDb.patients.push({
    id: 'p-1', tenant_id: TENANT_ID, full_name: 'Ana López Prueba', birth_date: null, phone_e164: null, email: null,
    source: 'manual', primary_doctor_id: null, tags: [], archived_at: null, created_at: '2026-11-16T10:00:00Z',
    consent: { method: 'papel', notice_version: 'clinica-borrador-2026-11', recorded_at: '2026-11-16T10:00:00Z' },
  })
}
function seedRequest(over: Record<string, unknown> = {}) {
  fakeDb.arco_requests.push({
    id: 'arco-1', tenant_id: TENANT_ID, patient_id: 'p-1', right: 'acceso', channel: 'correo', received_on: '2026-11-10',
    due_on: '2026-12-08', details: 'Pide copia', status: 'recibida', response: null, created_by: 'u-1',
    created_at: '2026-11-10T12:00:00Z', resolved_by: null, resolved_at: null, ...over,
  })
}

describe('reglas ARCO', () => {
  it('cuenta los días al vencimiento y arma un nombre de archivo seguro', () => {
    expect(daysLeft('2026-12-08', '2026-11-16')).toBe(22)
    expect(daysLeft('2026-11-10', '2026-11-16')).toBe(-6)
    expect(exportFileName('Ana López / Prueba', 'pdf', '2026-11-16')).toBe('datos-ana-lopez-prueba-2026-11-16.pdf')
  })
})

describe('M2-B · privacidad y ARCO en la ficha', () => {
  const created: Blob[] = []
  beforeEach(() => {
    created.length = 0
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b)
      return `blob:${created.length}`
    }) as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('la dueña exporta PDF y JSON y queda registrado', async () => {
    seedPatient()
    const user = userEvent.setup()
    await renderApp('/pacientes/p-1', { role: 'owner' })
    await user.click(await screen.findByRole('button', { name: 'Exportar datos' }))
    expect(await screen.findByText('Descargamos el PDF y el JSON. La exportación quedó en la bitácora.')).toBeInTheDocument()
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('export_patient_data', { p_patient: 'p-1' })
    expect(created.map((b) => b.type)).toEqual(['application/json', 'application/pdf'])
    const json = JSON.parse(await created[0]!.text()) as { patient: { full_name: string } }
    expect(json.patient.full_name).toBe('Ana López Prueba')
  })

  it('registra una solicitud y la muestra con su plazo', async () => {
    seedPatient()
    const user = userEvent.setup()
    await renderApp('/pacientes/p-1', { role: 'admin' })
    expect(await screen.findByText('Este paciente no ha hecho solicitudes.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar solicitud' }))
    const form = screen.getByRole('form', { name: 'Nueva solicitud ARCO' })
    await user.selectOptions(within(form).getByLabelText('Qué pide'), 'cancelacion')
    expect(within(form).getByText(/El expediente se conserva 5 años/)).toBeInTheDocument()
    await user.selectOptions(within(form).getByLabelText('Cómo llegó'), 'whatsapp')
    await user.type(within(form).getByLabelText('Detalles (opcional)'), 'Pide borrar su teléfono')
    await user.click(within(form).getByRole('button', { name: 'Guardar solicitud' }))

    expect(fakeSupabase.rpc).toHaveBeenCalledWith('create_arco_request', expect.objectContaining({
      p_patient: 'p-1', p_right: 'cancelacion', p_channel: 'whatsapp', p_details: 'Pide borrar su teléfono',
    }))
    const list = await screen.findByRole('list', { name: 'Solicitudes ARCO' })
    expect(within(list).getByText(/Cancelación del/)).toBeInTheDocument()
    expect(within(list).getByText(/responde antes del/)).toBeInTheDocument()
  })

  it('responder exige texto y cierra la solicitud', async () => {
    seedPatient()
    seedRequest()
    const user = userEvent.setup()
    await renderApp('/pacientes/p-1', { role: 'owner' })
    await user.click(await screen.findByRole('button', { name: /^Responder: Acceso/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe la respuesta que diste al paciente.')
    await user.type(screen.getByLabelText('Respuesta al paciente'), 'Entregamos copia en PDF')
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_arco_request', { p_request: 'arco-1', p_status: 'atendida', p_response: 'Entregamos copia en PDF' })
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Responder: Acceso/ })).not.toBeInTheDocument())
    expect(screen.getByText('Entregamos copia en PDF')).toBeInTheDocument()
  })

  it('una solicitud vencida se marca', async () => {
    seedPatient()
    seedRequest({ due_on: '2020-01-10' })
    await renderApp('/pacientes/p-1', { role: 'owner' })
    expect(await screen.findByText(/^Vencida hace/)).toBeInTheDocument()
  })

  it('recepción registra pero no exporta ni ve solicitudes', async () => {
    seedPatient()
    seedRequest()
    const user = userEvent.setup()
    await renderApp('/pacientes/p-1', { role: 'reception' })
    await user.click(await screen.findByRole('button', { name: 'Registrar solicitud' }))
    expect(screen.queryByRole('button', { name: 'Exportar datos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Solicitudes ARCO' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar solicitud' }))
    expect(await screen.findByText('Registramos la solicitud. La dueña o la administración le darán seguimiento.')).toBeInTheDocument()
  })

  it('un doctor no ve la sección de privacidad', async () => {
    seedPatient()
    await renderApp('/pacientes/p-1', { role: 'doctor' })
    await screen.findByRole('heading', { name: 'Última nota' })
    expect(screen.queryByRole('heading', { name: 'Privacidad y derechos ARCO' })).not.toBeInTheDocument()
  })
})
