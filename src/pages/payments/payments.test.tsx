import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { suggestedAmount } from '@/lib/payments'
import { fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const DOCTOR = `m-${TENANT_ID}`

function seed(quote: Record<string, unknown> = {}) {
  fakeDb.patients.push({ id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', phone_e164: '+525512345678', email: null, archived_at: null, tags: [], source: 'manual', primary_doctor_id: null, created_at: '2026-11-01T00:00:00Z', consent: null })
  fakeDb.quotes.push({
    id: 'q-1', tenant_id: TENANT_ID, folio: 142, patient_id: 'p-1', doctor_id: DOCTOR, title: 'Ortodoncia invisible', status: 'presentado', total: 38000,
    down_payment: 5000, installments: 12, valid_until: '2026-12-18', notes: null, lost_reason: null, sent_at: '2026-11-18T12:00:00Z', last_followup_at: null,
    status_changed_at: '2026-11-18T12:00:00Z', created_by: null, created_at: '2026-11-18T12:00:00Z', updated_at: '2026-11-18T12:00:00Z', ...quote,
  })
}
function seedPayment(over: Record<string, unknown> = {}) {
  fakeDb.payments.push({
    id: 'pay-1', tenant_id: TENANT_ID, folio: 1, patient_id: 'p-1', quote_id: 'q-1', doctor_id: DOCTOR, amount: 5000, method: 'transferencia',
    paid_at: '2026-11-18T12:00:00Z', reference: 'SPEI 123', notes: null, registered_by: null, created_at: '2026-11-18T12:00:00Z', voided_at: null, voided_by: null, void_reason: null, ...over,
  })
}

describe('reglas de pagos', () => {
  it('sugiere el anticipo, luego la mensualidad, sin pasar del saldo', () => {
    expect(suggestedAmount({ total: 38000, down_payment: 5000, installments: 12, paid: 0, balance: 38000 })).toBe(5000)
    expect(suggestedAmount({ total: 38000, down_payment: 5000, installments: 12, paid: 5000, balance: 33000 })).toBe(2750)
    expect(suggestedAmount({ total: 38000, down_payment: 5000, installments: 12, paid: 36000, balance: 2000 })).toBe(2000)
    expect(suggestedAmount({ total: 850, down_payment: 0, installments: 0, paid: 0, balance: 850 })).toBe(850)
  })
})

describe('M5-A · registrar pago', () => {
  it('desde el presupuesto: sugiere el anticipo, lo registra, acepta el presupuesto y abre el comprobante', async () => {
    seed()
    const user = userEvent.setup()
    const { router } = await renderApp('/cobros/nuevo?paciente=p-1&presupuesto=q-1&volver=/presupuestos/q-1')
    await waitFor(() => expect(screen.getByLabelText('Monto')).toHaveValue(5000))
    expect(screen.getByText(/pasa a «Aceptado»/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Transferencia' }))
    await user.type(screen.getByLabelText('Referencia (opcional)'), 'SPEI 123')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('register_payment', expect.objectContaining({ p_patient: 'p-1', p_quote: 'q-1', p_amount: 5000, p_method: 'transferencia', p_reference: 'SPEI 123' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/cobros/pay-1/comprobante'))
    expect(await screen.findByText('Listo. Registramos el pago R-0001 por $5,000.')).toBeInTheDocument()
    expect(fakeDb.quotes[0]!.status).toBe('aceptado')
    // «Volver» lleva a donde ibas (el presupuesto).
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/presupuestos/q-1')
  })

  it('no deja pagar más que el saldo del presupuesto', async () => {
    seed({ status: 'aceptado' })
    const user = userEvent.setup()
    await renderApp('/cobros/nuevo?paciente=p-1&presupuesto=q-1')
    const amount = await screen.findByLabelText('Monto')
    await waitFor(() => expect(amount).toHaveValue(5000))
    await user.clear(amount)
    await user.type(amount, '40000')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(screen.getByText('El pago supera el saldo del presupuesto ($38,000).')).toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('register_payment', expect.anything())
  })

  it('un doctor no registra pagos', async () => {
    seed()
    await renderApp('/cobros/nuevo?paciente=p-1', { role: 'doctor' })
    expect(await screen.findByRole('heading', { name: 'No puedes registrar pagos' })).toBeInTheDocument()
  })
})

describe('M5-A · cobros y ficha', () => {
  it('Cobros muestra indicadores, pagos y saldos', async () => {
    seed({ status: 'aceptado' })
    seedPayment()
    const user = userEvent.setup()
    await renderApp('/cobros')
    expect(await screen.findByText('Cobrado este mes')).toBeInTheDocument()
    expect(screen.getByText('Por cobrar').nextElementSibling).toHaveTextContent('$33,000')
    const list = screen.getByRole('list', { name: 'Pagos de la clínica' })
    expect(within(list).getByText('Laura Méndez Prueba')).toBeInTheDocument()
    expect(within(list).getByText(/R-0001 .* Transferencia · SPEI 123/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Saldos/ }))
    expect(within(screen.getByRole('list', { name: 'Pacientes con saldo' })).getByText('$33,000')).toBeInTheDocument()
  })

  it('la gerencia anula con motivo; recepción no ve «Anular»', async () => {
    seed({ status: 'aceptado' })
    seedPayment()
    const user = userEvent.setup()
    const first = await renderApp('/cobros')
    await user.click(await screen.findByRole('button', { name: 'Anular pago R-0001' }))
    await user.click(screen.getByRole('button', { name: 'Sí, anular' }))
    expect(screen.getByText('Escribe por qué se anula.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('¿Por qué se anula?'), 'Se capturó dos veces')
    await user.click(screen.getByRole('button', { name: 'Sí, anular' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('void_payment', { p_payment: 'pay-1', p_reason: 'Se capturó dos veces' })
    expect(await screen.findByText('Anulado')).toBeInTheDocument()
    first.unmount()
    await renderApp('/cobros', { role: 'reception' })
    await screen.findByRole('list', { name: 'Pagos de la clínica' })
    expect(screen.queryByRole('button', { name: /Anular pago/ })).not.toBeInTheDocument()
  })

  it('la ficha muestra pagado, saldo por presupuesto y los pagos', async () => {
    seed({ status: 'aceptado' })
    seedPayment()
    const user = userEvent.setup()
    await renderApp('/pacientes/p-1')
    expect(await screen.findByText(/Saldo/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Pagos' }))
    expect((await screen.findByText('Pagado')).nextElementSibling).toHaveTextContent('$5,000')
    expect(screen.getByText('Saldo $33,000')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar pago' })).toHaveAttribute('href', '/cobros/nuevo?paciente=p-1&volver=/pacientes/p-1')
  })

  it('un doctor no ve Cobros', async () => {
    await renderApp('/cobros', { role: 'doctor' })
    expect(await screen.findByRole('heading', { name: 'Los cobros los lleva recepción' })).toBeInTheDocument()
  })
})
