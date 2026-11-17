import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { formatMinutes, isLate, leadWhatsappUrl, relativeAge } from '@/lib/leads'
import { fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const NOW = Date.parse('2026-11-16T12:00:00Z')

function seedLead(over: Record<string, unknown> = {}) {
  const row = {
    id: `lead-${fakeDb.leads.length + 1}`, tenant_id: TENANT_ID, full_name: 'Fernanda Lozano Prueba', phone_e164: '+525512345678', email: null,
    interest: 'Quiere precio de ortodoncia invisible', source: 'meta', status: 'nuevo', lost_reason: null, assigned_to: null,
    notice_version: 'clinica-borrador-2026-11', converted_patient_id: null, first_response_at: null,
    status_changed_at: '2026-11-15T10:00:00Z', created_by: null, created_at: '2026-11-15T10:00:00Z', updated_at: '2026-11-15T10:00:00Z', ...over,
  }
  fakeDb.leads.push(row)
  return row
}

describe('reglas de leads', () => {
  it('edad relativa, retraso y formato de minutos', () => {
    expect(relativeAge('2026-11-16T11:20:00Z', NOW)).toBe('hace 40 min')
    expect(relativeAge('2026-11-15T10:00:00Z', NOW)).toBe('hace 26 h')
    expect(relativeAge('2026-11-13T12:00:00Z', NOW)).toBe('hace 3 días')
    expect(isLate({ status: 'nuevo', first_response_at: null, created_at: '2026-11-15T10:00:00Z' }, NOW)).toBe(true)
    expect(isLate({ status: 'contactado', first_response_at: null, created_at: '2026-11-15T10:00:00Z' }, NOW)).toBe(false)
    expect(formatMinutes(130)).toBe('2 h 10 min')
    expect(formatMinutes(null)).toBe('—')
    expect(leadWhatsappUrl('+525512345678', { lead: 'Fernanda Lozano', clinic: 'Dientitos' })).toMatch(/^https:\/\/wa\.me\/525512345678\?text=Hola%20Fernanda%2C/)
  })
})

describe('M1-A · Kanban de leads', () => {
  it('muestra indicadores y cada lead en su columna, con el retraso en rojo', async () => {
    seedLead()
    seedLead({ full_name: 'Gabriela Núñez Prueba', status: 'contactado', source: 'referido', first_response_at: '2026-11-15T11:00:00Z' })
    seedLead({ full_name: 'Iván Morales Prueba', status: 'perdido', lost_reason: 'Eligió otra clínica por precio' })
    await renderApp('/leads')
    const nuevo = await screen.findByRole('region', { name: 'Nuevo' })
    expect(within(nuevo).getByText('Fernanda Lozano Prueba')).toBeInTheDocument()
    expect(within(nuevo).getByText('Anuncio en Meta')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Contactado' })).getByText('Gabriela Núñez Prueba')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Perdido' })).getByText('Eligió otra clínica por precio')).toBeInTheDocument()
    expect(screen.getByText('Leads este mes').nextElementSibling).toHaveTextContent('3')
    expect(screen.getByText('Tiempo de respuesta').nextElementSibling).toHaveTextContent('2 h 10 min')
  })

  it('filtra por origen en el servidor', async () => {
    seedLead()
    const user = userEvent.setup()
    await renderApp('/leads')
    await screen.findByRole('region', { name: 'Nuevo' })
    await user.selectOptions(screen.getByLabelText('Origen'), 'referido')
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Nuevo' })).queryByText('Fernanda Lozano Prueba')).not.toBeInTheDocument())
  })

  it('un doctor no ve los leads', async () => {
    seedLead()
    await renderApp('/leads', { role: 'doctor' })
    expect(await screen.findByRole('heading', { name: 'Los leads los trabaja recepción' })).toBeInTheDocument()
    expect(screen.queryByText('Fernanda Lozano Prueba')).not.toBeInTheDocument()
  })
})

describe('M1-A · nuevo lead', () => {
  it('exige el aviso de privacidad y un medio de contacto', async () => {
    const user = userEvent.setup()
    await renderApp('/leads/nuevo', { role: 'reception' })
    await user.type(await screen.findByLabelText('Nombre'), 'Carlos Medina Prueba')
    await user.click(screen.getByRole('button', { name: 'Guardar lead' }))
    expect(screen.getByText('Escribe un teléfono o un correo para contactarlo.')).toBeInTheDocument()
    expect(screen.getByText('Confirma que le compartiste el aviso de privacidad.')).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('create_lead', expect.anything())
  })

  it('registra el lead y abre su detalle', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/leads/nuevo', { role: 'reception' })
    await user.type(await screen.findByLabelText('Nombre'), 'Carlos Medina Prueba')
    await user.type(screen.getByLabelText('Teléfono o WhatsApp'), '55 1234 5678')
    await user.type(screen.getByLabelText('¿Qué le interesa?'), 'Dolor en muela')
    await user.click(screen.getByLabelText(/Le compartimos el aviso de privacidad/))
    await user.click(screen.getByRole('button', { name: 'Guardar lead' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('create_lead', expect.objectContaining({
      p_tenant: TENANT_ID, p_full_name: 'Carlos Medina Prueba', p_notice_shared: true, p_phone_e164: '+525512345678', p_interest: 'Dolor en muela', p_source: 'whatsapp',
    }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/leads/lead-1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Carlos Medina Prueba' })).toBeInTheDocument()
  })
})

describe('M1-A · detalle del lead', () => {
  it('WhatsApp, marcar contactado y nota quedan en el historial', async () => {
    seedLead()
    const user = userEvent.setup()
    await renderApp('/leads/lead-1')
    expect(await screen.findByRole('link', { name: 'Escribir por WhatsApp' })).toHaveAttribute('href', expect.stringContaining('wa.me/525512345678'))
    expect(screen.getByText(/y nadie le ha contestado/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Marcar contactado' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_lead_status', { p_lead: 'lead-1', p_status: 'contactado' })
    expect(await screen.findByText('Listo. Lo marcamos como contactado.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nueva nota'), 'Le mandé precios')
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))
    expect(await screen.findByText('Le mandé precios')).toBeInTheDocument()
    expect(screen.getByText('Lo movió a «Contactado»')).toBeInTheDocument()
  })

  it('perdido pide motivo y se puede reabrir', async () => {
    seedLead({ status: 'contactado' })
    const user = userEvent.setup()
    await renderApp('/leads/lead-1')
    await user.click(await screen.findByRole('button', { name: 'Marcar perdido' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('Escribe el motivo.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('¿Por qué se perdió?'), 'Eligió otra clínica')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_lead_status', { p_lead: 'lead-1', p_status: 'perdido', p_reason: 'Eligió otra clínica' })
    await user.click(await screen.findByRole('button', { name: 'Reabrir' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_lead_status', { p_lead: 'lead-1', p_status: 'contactado' })
  })

  it('editar manda solo lo que cambió', async () => {
    seedLead()
    const user = userEvent.setup()
    await renderApp('/leads/lead-1')
    const interest = await screen.findByLabelText('¿Qué le interesa?')
    await user.clear(interest)
    await user.type(interest, 'Ortodoncia para su hija')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('update_lead', { p_lead: 'lead-1', p_interest: 'Ortodoncia para su hija' })
  })
})
