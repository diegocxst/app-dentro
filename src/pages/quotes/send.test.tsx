import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { quoteFileName, quoteMessage } from '@/lib/quoteShare'
import { fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const render = vi.hoisted(() => vi.fn(() => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' }))))
vi.mock('./quotePdf', () => ({ renderQuotePdf: render }))

const DOCTOR = `m-${TENANT_ID}`

function seed(over: Record<string, unknown> = {}) {
  fakeDb.patients.push({ id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', phone_e164: '+525512345678', email: null, archived_at: null, tags: [], source: 'manual', primary_doctor_id: null, created_at: '2026-11-01T00:00:00Z' })
  fakeDb.quotes.push({
    id: 'q-1', tenant_id: TENANT_ID, folio: 142, patient_id: 'p-1', doctor_id: DOCTOR, title: 'Ortodoncia invisible', status: 'borrador', total: 38000,
    down_payment: 5000, installments: 12, valid_until: '2026-12-18', notes: null, lost_reason: null, sent_at: null, last_followup_at: null,
    status_changed_at: '2026-11-18T12:00:00Z', created_by: null, created_at: '2026-11-18T12:00:00Z', updated_at: '2026-11-18T12:00:00Z', ...over,
  })
  fakeDb.quote_items.push({ id: 'qi-1', tenant_id: TENANT_ID, quote_id: 'q-1', position: 0, treatment_id: null, concept: 'Alineadores transparentes', note: '', quantity: 1, unit_price: 38000 })
}

describe('mensaje y archivo', () => {
  it('arma el mensaje de la maqueta y un nombre de archivo limpio', () => {
    expect(quoteMessage({ patient: 'Laura Méndez', title: 'Ortodoncia invisible', doctor: 'Dr. Pablo Soto', total: 38000, downPayment: 5000, installments: 12, clinic: 'Dientitos' })).toBe(
      'Hola, Laura. Te comparto tu presupuesto de ortodoncia invisible con Dr. Pablo Soto en Dientitos. Puedes apartar tu lugar con un anticipo de $5,000 y pagar el resto en 12 mensualidades de $2,750.',
    )
    expect(quoteMessage({ patient: 'Paola', title: '', doctor: '', total: 4650, downPayment: 0, installments: 0, clinic: 'Dientitos' })).toBe(
      'Hola, Paola. Te comparto tu presupuesto en Dientitos. El total es de $4,650.',
    )
    expect(quoteMessage({ patient: 'Ana', title: 'Presupuesto de ortodoncia', doctor: '', total: 100, downPayment: 0, installments: 0, clinic: 'Dientitos' })).toBe(
      'Hola, Ana. Te comparto tu presupuesto de ortodoncia en Dientitos. El total es de $100.',
    )
    expect(quoteFileName('P-0142', 'Laura Méndez / Prueba')).toBe('Presupuesto P-0142 Laura Mendez Prueba.pdf')
  })
})

describe('M4-B · enviar presupuesto', () => {
  const nav = navigator as unknown as Record<string, unknown>
  beforeEach(() => {
    render.mockClear()
    URL.createObjectURL = vi.fn(() => 'blob:pdf') as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    delete nav.canShare
    delete nav.share
    vi.restoreAllMocks()
  })

  it('en el celular comparte el PDF adjunto y lo marca presentado', async () => {
    nav.canShare = vi.fn(() => true)
    nav.share = vi.fn(() => Promise.resolve())
    seed()
    const user = userEvent.setup()
    await renderApp('/presupuestos/q-1/enviar')
    expect(await screen.findByText('PDF: Presupuesto P-0142 Laura Mendez Prueba.pdf')).toBeInTheDocument()
    expect((screen.getByLabelText('Así le llega') as HTMLTextAreaElement).value).toMatch(/^Hola, Laura\. Te comparto tu presupuesto de ortodoncia invisible con Dueña Prueba en Clínica Prueba\./)
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ folio: 'P-0142', patient: 'Laura Méndez Prueba', total: 38000, clinic: expect.objectContaining({ name: 'Clínica Prueba', logoPng: null }) }))
    await user.click(screen.getByRole('button', { name: 'Abrir en WhatsApp y enviar' }))
    expect(nav.share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: 'Presupuesto P-0142 Laura Mendez Prueba.pdf', type: 'application/pdf' })], text: expect.stringContaining('12 mensualidades de $2,750') })
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_quote_status', { p_quote: 'q-1', p_status: 'presentado' })
    expect(await screen.findByText('Listo. Marcamos el presupuesto como presentado.')).toBeInTheDocument()
  })

  it('si cancela el menú de compartir no cambia la etapa', async () => {
    nav.canShare = vi.fn(() => true)
    nav.share = vi.fn(() => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' })))
    seed()
    const user = userEvent.setup()
    await renderApp('/presupuestos/q-1/enviar')
    await screen.findByText(/^PDF: Presupuesto/)
    await user.click(screen.getByRole('button', { name: 'Abrir en WhatsApp y enviar' }))
    await waitFor(() => expect(nav.share).toHaveBeenCalled())
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('set_quote_status', expect.anything())
  })

  it('en la computadora descarga el PDF, abre WhatsApp y registra el seguimiento', async () => {
    seed({ status: 'presentado', sent_at: '2026-11-10T12:00:00Z' })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    await renderApp('/presupuestos/q-1/enviar')
    await screen.findByText(/^PDF: Presupuesto/)
    expect(screen.getByText(/Se descarga el PDF y se abre WhatsApp/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir en WhatsApp y enviar' }))
    expect(click).toHaveBeenCalled()
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/525512345678\?text=Hola%2C%20Laura/), '_blank', 'noopener')
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('mark_quote_followup', { p_quote: 'q-1' })
    expect(await screen.findByText(/Adjúntalo en el chat de WhatsApp/)).toBeInTheDocument()
  })

  it('el detalle ofrece descargar el PDF y enviarlo', async () => {
    seed()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    await renderApp('/presupuestos/q-1')
    expect(await screen.findByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute('href', '/presupuestos/q-1/enviar')
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(render).toHaveBeenCalledTimes(1)
  })
})
