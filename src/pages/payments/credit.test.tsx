import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { registerPayment } from '@/data/payments'
import { fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const DOCTOR = `m-${TENANT_ID}`

function patient() {
  fakeDb.patients.push({ id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', phone_e164: '+525512345678', email: null, archived_at: null, tags: [], source: 'manual', primary_doctor_id: null, created_at: '2026-11-01T00:00:00Z', consent: null })
}
function quote(id: string, folio: number, status: string, total: number, title: string) {
  fakeDb.quotes.push({
    id, tenant_id: TENANT_ID, folio, patient_id: 'p-1', doctor_id: DOCTOR, title, status, total, down_payment: 0, installments: 0, valid_until: '2026-12-18',
    notes: null, lost_reason: null, sent_at: '2026-11-18T12:00:00Z', last_followup_at: null, status_changed_at: '2026-11-18T12:00:00Z', created_by: null,
    created_at: '2026-11-18T12:00:00Z', updated_at: '2026-11-18T12:00:00Z',
  })
  fakeDb.quote_items.push({ id: `${id}-0`, tenant_id: TENANT_ID, quote_id: id, position: 0, treatment_id: null, concept: title, note: '', quantity: 1, unit_price: total })
}

describe('M5-C · cobrar contra presupuesto', () => {
  it('«Saldo completo» llena el saldo y no se edita; «Apartado o abono» vuelve a la sugerencia', async () => {
    patient()
    quote('q-1', 7, 'aceptado', 3950, 'Endodoncia y resina')
    fakeDb.payments.push({ id: 'pay-0', tenant_id: TENANT_ID, folio: 1, patient_id: 'p-1', quote_id: 'q-1', doctor_id: DOCTOR, amount: 950, method: 'efectivo', paid_at: '2026-11-18T12:00:00Z', voided_at: null })
    const user = userEvent.setup()
    await renderApp('/cobros/nuevo?paciente=p-1&presupuesto=q-1')
    const amount = await screen.findByLabelText('Monto')
    await waitFor(() => expect(amount).toHaveValue(3000))
    const how = screen.getByRole('group', { name: '¿Cuánto paga?' })
    expect(within(how).getByRole('button', { name: 'Apartado o abono' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(how).getByRole('button', { name: 'Saldo completo · $3,000' }))
    expect(amount).toHaveValue(3000)
    expect(amount).toHaveAttribute('readonly')
    expect(screen.getByText('Liquida el presupuesto.')).toBeInTheDocument()

    await user.click(within(how).getByRole('button', { name: 'Apartado o abono' }))
    expect(amount).not.toHaveAttribute('readonly')
    await user.clear(amount)
    await user.type(amount, '1000')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('register_payment', expect.objectContaining({ p_patient: 'p-1', p_quote: 'q-1', p_amount: 1000 }))
  })

  it('con varios presupuestos hay que elegir uno (o «Sin presupuesto»)', async () => {
    patient()
    quote('q-1', 7, 'aceptado', 3000, 'Endodoncia')
    quote('q-2', 8, 'presentado', 2000, 'Blanqueamiento')
    const user = userEvent.setup()
    await renderApp('/cobros/nuevo?paciente=p-1')
    const select = await screen.findByLabelText('¿A qué presupuesto?')
    expect(select).toHaveValue('')
    await user.type(screen.getByLabelText('Monto'), '500')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(screen.getByText('Elige el presupuesto o «Sin presupuesto».')).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('register_payment', expect.anything())
    expect(within(select).getByRole('option', { name: 'Sin presupuesto: queda como saldo a favor' })).toBeInTheDocument()
  })
})

describe('M5-C · saldo a favor', () => {
  it('sin presupuestos con saldo, el pago queda a favor y la ficha lo muestra', async () => {
    patient()
    const user = userEvent.setup()
    const { router } = await renderApp('/cobros/nuevo?paciente=p-1&volver=/pacientes/p-1')
    expect(await screen.findByText(/No tiene presupuestos con saldo. El pago queda como saldo a favor/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '¿Cuánto paga?' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Monto'), '3200')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    const call = fakeSupabase.rpc.mock.calls.find(([fn]) => fn === 'register_payment')!
    expect(call[1]).toMatchObject({ p_patient: 'p-1', p_amount: 3200 })
    expect(call[1]).not.toHaveProperty('p_quote')
    expect(await screen.findByText('Listo. Registramos el pago R-0001 por $3,200 como saldo a favor.')).toBeInTheDocument()

    await router.navigate('/pacientes/p-1')
    await user.click(await screen.findByRole('tab', { name: 'Pagos' }))
    const region = await screen.findByRole('region', { name: 'Pagos del paciente' })
    expect(within(region).getByText(/Saldo a favor/)).toBeInTheDocument()
    expect(await screen.findByText('$3,200', { selector: 'dd.text-success' })).toBeInTheDocument()
    expect(screen.getByText(/se aplica solo en cuanto el paciente acepte un presupuesto/)).toBeInTheDocument()
  })

  it('al aceptar un presupuesto se le aplica el saldo a favor y se ve en sus pagos', async () => {
    patient()
    quote('q-1', 7, 'presentado', 2000, 'Blanqueamiento')
    await registerPayment({ patientId: 'p-1', quoteId: null, amount: 3200, method: 'efectivo', paidAt: '2026-11-26T12:00:00Z', reference: '', notes: '' })
    expect(fakeDb.payment_allocations).toHaveLength(0)
    const user = userEvent.setup()
    await renderApp('/presupuestos/q-1')
    await user.click(await screen.findByRole('button', { name: 'Aceptó' }))
    // El editor se vuelve a montar al cambiar de etapa: se busca la tarjeta de nuevo.
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Pagos' })).getByText(/Desde saldo a favor/)).toBeInTheDocument())
    expect(within(screen.getByRole('region', { name: 'Pagos' })).getByText(/Pagado/)).toHaveTextContent('Pagado $2,000 · Saldo $0')
    expect(fakeDb.payment_allocations).toEqual([expect.objectContaining({ quote_id: 'q-1', amount: 2000, source: 'saldo_a_favor' })])
  })

  it('al anular el pago, lo aplicado se reabre', async () => {
    patient()
    quote('q-1', 7, 'aceptado', 2000, 'Blanqueamiento')
    const pay = await registerPayment({ patientId: 'p-1', quoteId: null, amount: 1500, method: 'efectivo', paidAt: '2026-11-26T12:00:00Z', reference: '', notes: '' })
    expect(fakeDb.payment_allocations).toEqual([expect.objectContaining({ quote_id: 'q-1', amount: 1500, source: 'saldo_a_favor', voided_at: null })])
    const user = userEvent.setup()
    await renderApp('/presupuestos/q-1')
    const card = await screen.findByRole('region', { name: 'Pagos' })
    await user.click(await within(card).findByRole('button', { name: `Anular pago R-000${String(pay.folio)}` }))
    await user.type(within(card).getByLabelText('¿Por qué se anula?'), 'Prueba')
    await user.click(within(card).getByRole('button', { name: 'Sí, anular' }))
    await waitFor(() => expect(fakeDb.payment_allocations[0]!.voided_at).not.toBeNull())
  })
})
