import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { balanceAfter, receiptMessage } from '@/lib/payments'
import { receiptFileName } from '@/lib/quoteShare'
import { fakeDb, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const render = vi.hoisted(() => vi.fn<(d: unknown) => Promise<Blob>>(() => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' }))))
vi.mock('./receiptPdf', () => ({ renderReceiptPdf: render }))

const DOCTOR = `m-${TENANT_ID}`

function seed() {
  fakeDb.patients.push({ id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', phone_e164: '+525512345678', email: null, archived_at: null, tags: [], source: 'manual', primary_doctor_id: null, created_at: '2026-11-01T00:00:00Z', consent: null })
  fakeDb.quotes.push({
    id: 'q-1', tenant_id: TENANT_ID, folio: 142, patient_id: 'p-1', doctor_id: DOCTOR, title: 'Ortodoncia invisible', status: 'aceptado', total: 38000,
    down_payment: 5000, installments: 12, valid_until: '2026-12-18', notes: null, lost_reason: null, sent_at: '2026-11-18T12:00:00Z', last_followup_at: null,
    status_changed_at: '2026-11-18T12:00:00Z', created_by: null, created_at: '2026-11-18T12:00:00Z', updated_at: '2026-11-18T12:00:00Z',
  })
  const pay = (id: string, folio: number, amount: number, over: Record<string, unknown> = {}) =>
    fakeDb.payments.push({
      id, tenant_id: TENANT_ID, folio, patient_id: 'p-1', quote_id: 'q-1', doctor_id: DOCTOR, amount, method: 'transferencia', paid_at: '2026-11-18T12:00:00Z',
      reference: 'SPEI 123', notes: null, registered_by: null, created_at: '2026-11-18T12:00:00Z', voided_at: null, voided_by: null, void_reason: null, ...over,
    })
  pay('pay-1', 1, 5000)
  pay('pay-2', 2, 2750)
  pay('pay-3', 3, 1000, { voided_at: '2026-11-19T12:00:00Z', void_reason: 'Duplicado' })
  pay('pay-4', 4, 2750)
}

describe('reglas del comprobante', () => {
  it('el saldo es el que quedó después de ese pago (sin contar anulados)', () => {
    const ps = [
      { id: 'a', folio: 1, amount: 5000, voided_at: null },
      { id: 'b', folio: 2, amount: '2750', voided_at: null },
      { id: 'c', folio: 3, amount: 1000, voided_at: '2026-11-19' },
      { id: 'd', folio: 4, amount: 2750, voided_at: null },
    ]
    expect(balanceAfter(38000, ps, 'a')).toBe(33000)
    expect(balanceAfter(38000, ps, 'b')).toBe(30250)
    expect(balanceAfter(38000, ps, 'd')).toBe(27500)
    expect(balanceAfter(1000, [{ id: 'x', folio: 1, amount: 1000, voided_at: null }], 'x')).toBe(0)
  })

  it('arma el mensaje y el nombre del archivo', () => {
    expect(receiptMessage({ patient: 'Laura Méndez', amount: 5000, folio: 'R-0001', clinic: 'Dientitos', balance: 33000 })).toBe(
      'Hola, Laura. Te compartimos el comprobante R-0001 de tu pago de $5,000 en Dientitos. ¡Gracias! Tu saldo pendiente es de $33,000.',
    )
    expect(receiptMessage({ patient: 'Ana', amount: 850, folio: 'R-0002', clinic: 'Dientitos', balance: 0 })).toContain('queda liquidado')
    expect(receiptMessage({ patient: 'Ana', amount: 850, folio: 'R-0002', clinic: 'Dientitos', balance: null })).not.toContain('saldo')
    expect(receiptFileName('R-0001', 'Laura Méndez')).toBe('Comprobante R-0001 Laura Mendez.pdf')
  })
})

describe('M5-B · enviar comprobante', () => {
  const nav = navigator as unknown as Record<string, unknown>
  beforeEach(() => {
    render.mockClear()
    URL.createObjectURL = vi.fn(() => 'blob:pdf') as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    delete nav.canShare
    delete nav.share
  })

  it('arma el PDF con el saldo después de ese pago y lo comparte por WhatsApp', async () => {
    seed()
    nav.canShare = vi.fn(() => true)
    nav.share = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    await renderApp('/cobros/pay-2/comprobante')
    expect(await screen.findByRole('heading', { level: 1, name: 'Enviar comprobante' })).toBeInTheDocument()
    expect((screen.getByLabelText('Así le llega') as HTMLTextAreaElement).value).toContain('Tu saldo pendiente es de $30,250.')
    await screen.findByText('PDF: Comprobante R-0002 Laura Mendez Prueba.pdf')
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({ folio: 'R-0002', amount: 2750, method: 'Transferencia', reference: 'SPEI 123', balance: 30250, quote: { folio: 'P-0142', title: 'Ortodoncia invisible', total: 38000 } }),
    )
    await user.click(screen.getByRole('button', { name: 'Abrir en WhatsApp y enviar' }))
    await waitFor(() =>
      expect(nav.share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: 'Comprobante R-0002 Laura Mendez Prueba.pdf' })], text: expect.stringContaining('R-0002') }),
    )
  })

  it('un pago anulado no tiene comprobante', async () => {
    seed()
    await renderApp('/cobros/pay-3/comprobante')
    expect(await screen.findByRole('heading', { name: 'Este pago está anulado' })).toBeInTheDocument()
    expect(render).not.toHaveBeenCalled()
  })

  it('el doctor también lo abre desde la ficha; los anulados no muestran el botón', async () => {
    seed()
    const user = userEvent.setup()
    await renderApp('/pacientes/p-1', { role: 'doctor' })
    await user.click(await screen.findByRole('tab', { name: 'Pagos' }))
    const list = await screen.findByRole('list', { name: 'Lista de pagos' })
    expect(within(list).queryByRole('link', { name: 'Comprobante del pago R-0003' })).not.toBeInTheDocument()
    await user.click(within(list).getByRole('link', { name: 'Comprobante del pago R-0001' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Enviar comprobante' })).toBeInTheDocument()
    expect((screen.getByLabelText('Así le llega') as HTMLTextAreaElement).value).toContain('$33,000')
  })
})
