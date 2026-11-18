import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { followupTag, money, monthly, planText, quoteTotal } from '@/lib/quotes'
import { fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const DOCTOR = `m-${TENANT_ID}`
const NOW = Date.parse('2026-11-18T12:00:00Z')

function seed() {
  fakeDb.patients.push({ id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', phone_e164: '+525512345678', email: null, archived_at: null, tags: [], source: 'manual', primary_doctor_id: null, created_at: '2026-11-01T00:00:00Z' })
  fakeDb.treatments.push(
    { id: 't-1', tenant_id: TENANT_ID, category: 'ortodoncia', name: 'Alineadores transparentes', price_mxn: 34500, duration_minutes: 60, is_active: true },
    { id: 't-2', tenant_id: TENANT_ID, category: 'preventiva', name: 'Limpieza dental', price_mxn: 850, duration_minutes: 45, is_active: true },
  )
}
function seedQuote(over: Record<string, unknown> = {}) {
  fakeDb.quotes.push({
    id: 'q-1', tenant_id: TENANT_ID, folio: 142, patient_id: 'p-1', doctor_id: DOCTOR, title: 'Ortodoncia invisible', status: 'presentado', total: 38000,
    down_payment: 5000, installments: 12, valid_until: '2026-12-18', notes: null, lost_reason: null, sent_at: '2026-11-09T12:00:00Z', last_followup_at: null,
    status_changed_at: '2026-11-09T12:00:00Z', created_by: null, created_at: '2026-11-09T12:00:00Z', updated_at: '2026-11-09T12:00:00Z', ...over,
  })
  fakeDb.quote_items.push({ id: 'qi-1', tenant_id: TENANT_ID, quote_id: 'q-1', position: 0, treatment_id: 't-1', concept: 'Alineadores transparentes', note: '18 meses', quantity: 1, unit_price: 38000 })
}

describe('reglas de presupuestos', () => {
  it('dinero, totales con descuento y plan de pagos', () => {
    expect(money(38000)).toBe('$38,000')
    expect(money(-850)).toBe('−$850')
    expect(quoteTotal([{ quantity: 1, unitPrice: 34500 }, { quantity: 2, unitPrice: 850 }, { quantity: 1, unitPrice: -850 }])).toBe(35350)
    expect(monthly(38000, 5000, 12)).toBe(2750)
    expect(planText(38000, 5000, 12)).toBe('$5,000 de anticipo y 12 mensualidades de $2,750')
    expect(planText(4650, 0, 0)).toBe('De contado: $4,650')
  })

  it('etiqueta de seguimiento según los días sin respuesta', () => {
    expect(followupTag({ status: 'presentado', sent_at: '2026-11-17T12:00:00Z', last_followup_at: null }, NOW)).toEqual({ text: 'Enviado hace 1 día', tone: 'info' })
    expect(followupTag({ status: 'en_duda', sent_at: '2026-11-09T12:00:00Z', last_followup_at: null }, NOW)).toEqual({ text: 'Sin respuesta 9 días', tone: 'error' })
    expect(followupTag({ status: 'aceptado', sent_at: '2026-11-09T12:00:00Z', last_followup_at: null }, NOW)).toBeNull()
  })
})

describe('M4-A · nuevo presupuesto', () => {
  it('arma el presupuesto con el catálogo, un descuento y el plan, y lo guarda', async () => {
    seed()
    const user = userEvent.setup()
    const { router } = await renderApp('/presupuestos/nuevo?paciente=p-1')
    expect(await screen.findByRole('link', { name: 'Laura Méndez Prueba' })).toBeInTheDocument()
    await screen.findByRole('option', { name: /Alineadores transparentes/ })
    await user.selectOptions(screen.getByLabelText('Agregar del catálogo'), 't-1')
    await user.selectOptions(screen.getByLabelText('Agregar del catálogo'), 't-2')
    await user.click(screen.getByRole('button', { name: 'Descuento' }))
    const discount = screen.getByLabelText('Descuento')
    await user.clear(discount)
    await user.type(discount, '850')
    await user.click(screen.getByRole('button', { name: '12 meses' }))
    const down = screen.getByLabelText('Anticipo para apartar')
    await user.clear(down)
    await user.type(down, '5000')
    await user.type(screen.getByLabelText('Tratamiento principal'), 'Ortodoncia invisible')
    const preview = screen.getByRole('complementary', { name: 'Así lo verá el paciente' })
    expect(within(preview).getAllByText('$34,500')).toHaveLength(2) // la partida y el total (el descuento anula la limpieza)
    expect(within(preview).getByText('−$850')).toBeInTheDocument()
    expect(within(preview).getByText(/\$5,000 de anticipo y 12 mensualidades de \$2,459/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar presupuesto' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('save_quote', expect.objectContaining({
      p_quote: null, p_patient: 'p-1', p_title: 'Ortodoncia invisible', p_down_payment: 5000, p_installments: 12,
      p_items: [
        { treatment_id: 't-1', concept: 'Alineadores transparentes', note: '', quantity: 1, unit_price: 34500 },
        { treatment_id: 't-2', concept: 'Limpieza dental', note: '', quantity: 1, unit_price: 850 },
        { concept: 'Descuento', note: '', quantity: 1, unit_price: -850 },
      ],
    }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_onboarding_task', { p_tenant: TENANT_ID, p_task: 'first_quote', p_done: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/presupuestos/q-1'))
  })

  it('sin tratamientos no se guarda', async () => {
    seed()
    const user = userEvent.setup()
    await renderApp('/presupuestos/nuevo?paciente=p-1')
    await screen.findByRole('link', { name: 'Laura Méndez Prueba' })
    await user.click(screen.getByRole('button', { name: 'Guardar presupuesto' }))
    expect(screen.getByText('Agrega al menos un tratamiento.')).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('save_quote', expect.anything())
  })
})

describe('M4-A · Kanban y etapas', () => {
  it('muestra el presupuesto en su columna con monto, doctor y seguimiento', async () => {
    seed()
    seedQuote({ status: 'en_duda' })
    await renderApp('/presupuestos')
    const col = await screen.findByRole('region', { name: 'En duda' })
    expect(within(col).getByText('Laura Méndez Prueba')).toBeInTheDocument()
    expect(within(col).getAllByText('$38,000').length).toBeGreaterThan(0)
    expect(within(col).getByText(/^Sin respuesta \d+ días$/)).toBeInTheDocument()
    expect(screen.getByText('En duda, por recuperar').nextElementSibling).toHaveTextContent('$38,000')
  })

  it('desde el detalle se acepta, se registra seguimiento y se pierde con motivo', async () => {
    seed()
    seedQuote()
    const user = userEvent.setup()
    await renderApp('/presupuestos/q-1')
    expect(await screen.findByRole('heading', { level: 1, name: 'Laura Méndez Prueba' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar seguimiento' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('mark_quote_followup', { p_quote: 'q-1' })
    expect(await screen.findByText(/Último seguimiento/)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Marcar perdido' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('Escribe el motivo.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('¿Por qué se perdió?'), 'Le pareció caro')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_quote_status', { p_quote: 'q-1', p_status: 'perdido', p_reason: 'Le pareció caro' })
    expect(await screen.findByRole('button', { name: 'Reabrir' })).toBeInTheDocument()
  })

  it('un presupuesto aceptado ya no se edita', async () => {
    seed()
    seedQuote({ status: 'aceptado' })
    await renderApp('/presupuestos/q-1')
    expect(await screen.findByLabelText('Concepto 1')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Empezó el tratamiento' })).toBeInTheDocument()
  })

  it('la ficha lista los presupuestos del paciente', async () => {
    seed()
    seedQuote()
    const user = userEvent.setup()
    await renderApp('/pacientes/p-1')
    await user.click(await screen.findByRole('tab', { name: 'Presupuestos' }))
    const list = await screen.findByRole('list', { name: 'Presupuestos del paciente' })
    expect(within(list).getByText('Ortodoncia invisible · $38,000')).toBeInTheDocument()
    expect(within(list).getByText(/P-0142/)).toBeInTheDocument()
  })
})
