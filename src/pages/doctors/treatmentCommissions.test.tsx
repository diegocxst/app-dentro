import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { registerPayment, voidPayment } from '@/data/payments'
import { DEFAULT_TZ, todayIn } from '@/lib/agenda'
import { ruleLabel } from '@/lib/commissions'
import { fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const today = todayIn(DEFAULT_TZ)

function seed(scheme: 'percent_collected' | 'chair_rent' = 'percent_collected') {
  fakeDb.memberships.push({ id: 'm-d1', tenant_id: TENANT_ID, user_id: 'u-d1', role: 'doctor', status: 'active', display_name: '', created_at: '2026-11-15T00:00:00Z' })
  fakeDb.profiles.push({ id: 'u-d1', full_name: 'Dra. Karla Vega Prueba', phone_e164: null, avatar_path: null, title: '' })
  fakeDb.patients.push({ id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', primary_doctor_id: 'm-d1', phone_e164: null, email: null, archived_at: null, tags: [], source: 'manual', created_at: '2026-11-01T00:00:00Z' })
  fakeDb.treatments.push(
    { id: 't-imp', tenant_id: TENANT_ID, category: 'implantes', name: 'Implante', price_mxn: 8000, is_active: true },
    { id: 't-lim', tenant_id: TENANT_ID, category: 'preventiva', name: 'Limpieza', price_mxn: 2000, is_active: true },
    { id: 't-cor', tenant_id: TENANT_ID, category: 'restauracion', name: 'Corona', price_mxn: 3000, is_active: true },
  )
  fakeDb.commission_schemes.push({
    id: 'cs-1', tenant_id: TENANT_ID, membership_id: 'm-d1', kind: scheme, percent: scheme === 'percent_collected' ? 40 : null,
    rent_amount: scheme === 'chair_rent' ? 3000 : null, started_at: '2026-11-01T00:00:00Z', ended_at: null,
  })
}

/** Presupuesto aceptado: implante 8,000 + limpieza 2,000 (o dos coronas + limpieza − 1,000). */
function quote(id: string, items: [string | null, string, number, number][], total: number) {
  fakeDb.quotes.push({ id, tenant_id: TENANT_ID, folio: fakeDb.quotes.length + 1, patient_id: 'p-1', doctor_id: 'm-d1', title: '', status: 'aceptado', total, created_at: '2026-11-20T00:00:00Z' })
  items.forEach(([treatment, concept, quantity, price], position) =>
    fakeDb.quote_items.push({ id: `${id}-${position}`, tenant_id: TENANT_ID, quote_id: id, position, treatment_id: treatment, concept, note: '', quantity, unit_price: price }),
  )
}

const parts = (paymentId: string) =>
  fakeDb.commission_entries
    .filter((e) => e.payment_id === paymentId && !e.voided_at)
    .map((e) => [fakeDb.treatments.find((t) => t.id === e.treatment_id)?.name ?? 'general', e.base, e.rate, e.amount, e.fixed_amount ?? null])

describe('M6-C1 · cálculo por tratamiento (como la base)', () => {
  it('reparte el abono en proporción y aplica % o monto fijo', async () => {
    seed()
    fakeDb.commission_treatment_rules.push(
      { id: 'r-1', tenant_id: TENANT_ID, membership_id: 'm-d1', treatment_id: 't-imp', percent: 30, amount: null },
      { id: 'r-2', tenant_id: TENANT_ID, membership_id: 'm-d1', treatment_id: 't-cor', percent: null, amount: 1500 },
    )
    quote('q-1', [['t-imp', 'Implante', 1, 8000], ['t-lim', 'Limpieza', 1, 2000]], 10000)
    quote('q-2', [['t-cor', 'Corona', 2, 3000], ['t-lim', 'Limpieza', 1, 1000], [null, 'Descuento', 1, -1000]], 6000)
    const p1 = await registerPayment({ patientId: 'p-1', quoteId: 'q-1', amount: 1000, method: 'efectivo', paidAt: `${today}T18:00:00Z`, reference: '', notes: '' })
    expect(parts(p1.id)).toEqual([['Implante', 800, 30, 240, null], ['general', 200, 40, 80, null]])
    const p2 = await registerPayment({ patientId: 'p-1', quoteId: 'q-2', amount: 3000, method: 'efectivo', paidAt: `${today}T18:00:00Z`, reference: '', notes: '' })
    expect(parts(p2.id)).toEqual([['Corona', 2571.43, 0, 1500, 1500], ['general', 428.57, 40, 171.43, null]])
    await voidPayment(p1.id, 'Prueba')
    expect(parts(p1.id)).toEqual([])
  })

  it('etiqueta cada excepción', () => {
    expect(ruleLabel({ percent: 30, amount: null })).toBe('30% de lo cobrado')
    expect(ruleLabel({ percent: null, amount: 1500 })).toBe('$1,500 por unidad')
  })
})

describe('M6-C1 · excepciones en el perfil del doctor', () => {
  it('la gerencia agrega un % y un monto fijo, y los quita', async () => {
    seed()
    const user = userEvent.setup()
    await renderApp('/doctores/m-d1')
    const card = await screen.findByRole('region', { name: 'Comisión' })
    expect(await within(card).findByText('Todos los tratamientos usan el 40% general.')).toBeInTheDocument()
    const form = within(card).getByRole('form', { name: 'Agregar comisión por tratamiento' })
    await user.click(within(form).getByRole('button', { name: 'Agregar comisión' }))
    expect(within(card).getByText('Elige un tratamiento.')).toBeInTheDocument()
    await user.selectOptions(within(form).getByLabelText('Tratamiento'), 't-imp')
    await user.type(within(form).getByLabelText('Porcentaje'), '30')
    await user.click(within(form).getByRole('button', { name: 'Agregar comisión' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_treatment_commission', { p_membership: 'm-d1', p_treatment: 't-imp', p_percent: 30 })
    const list = await within(card).findByRole('list', { name: 'Comisión por tratamiento' })
    expect(within(list).getByText('Implante')).toBeInTheDocument()
    expect(within(list).getByText('30% de lo cobrado')).toBeInTheDocument()

    const form2 = within(card).getByRole('form', { name: 'Agregar comisión por tratamiento' })
    expect(within(within(form2).getByLabelText('Tratamiento')).queryByRole('option', { name: 'Implante' })).not.toBeInTheDocument()
    await user.selectOptions(within(form2).getByLabelText('Tratamiento'), 't-cor')
    await user.selectOptions(within(form2).getByLabelText('Comisión'), 'amount')
    await user.type(within(form2).getByLabelText('Monto por unidad'), '1500')
    await user.click(within(form2).getByRole('button', { name: 'Agregar comisión' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_treatment_commission', { p_membership: 'm-d1', p_treatment: 't-cor', p_amount: 1500 })
    expect(await within(card).findByText('$1,500 por unidad')).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Quitar la comisión de Implante' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_treatment_commission', { p_membership: 'm-d1', p_treatment: 't-imp' })
    await waitFor(() => expect(within(card).queryByText('30% de lo cobrado')).not.toBeInTheDocument())
  })

  it('en su propio perfil el doctor solo lee las excepciones', async () => {
    const ME = `m-${TENANT_ID}`
    fakeDb.treatments.push({ id: 't-imp', tenant_id: TENANT_ID, category: 'implantes', name: 'Implante', price_mxn: 8000, is_active: true })
    fakeDb.commission_schemes.push({ id: 'cs-1', tenant_id: TENANT_ID, membership_id: ME, kind: 'percent_collected', percent: 40, rent_amount: null, started_at: '2026-11-01T00:00:00Z', ended_at: null })
    fakeDb.commission_treatment_rules.push({ id: 'r-1', tenant_id: TENANT_ID, membership_id: ME, treatment_id: 't-imp', percent: 30, amount: null })
    await renderApp(`/doctores/${ME}`, { role: 'doctor' })
    const card = await screen.findByRole('region', { name: 'Comisión' })
    expect(await within(card).findByText('30% de lo cobrado')).toBeInTheDocument()
    expect(within(card).queryByRole('form', { name: 'Agregar comisión por tratamiento' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument()
  })

  it('con renta no hay comisión por tratamiento', async () => {
    seed('chair_rent')
    await renderApp('/doctores/m-d1')
    const card = await screen.findByRole('region', { name: 'Comisión' })
    await within(card).findByText('Renta de $3,000 por periodo')
    expect(within(card).queryByText('Comisión por tratamiento')).not.toBeInTheDocument()
  })
})

describe('M6-C1 · movimientos', () => {
  it('cada movimiento dice con qué regla se calculó', async () => {
    seed()
    fakeDb.payments.push(
      { id: 'x-1', tenant_id: TENANT_ID, folio: 1, patient_id: 'p-1', quote_id: null, doctor_id: 'm-d1', amount: 1000, method: 'efectivo', paid_at: `${today}T18:00:00Z`, voided_at: null },
    )
    fakeDb.commission_entries.push(
      { id: 'ce-1', tenant_id: TENANT_ID, doctor_id: 'm-d1', payment_id: 'x-1', scheme_id: 'cs-1', kind: 'comision', base: 500, rate: 30, amount: 150, period_date: today, payout_id: null, voided_at: null, treatment_id: 't-imp', fixed_amount: null },
      { id: 'ce-2', tenant_id: TENANT_ID, doctor_id: 'm-d1', payment_id: 'x-1', scheme_id: 'cs-1', kind: 'comision', base: 300, rate: 0, amount: 750, period_date: today, payout_id: null, voided_at: null, treatment_id: 't-cor', fixed_amount: 1500 },
      { id: 'ce-3', tenant_id: TENANT_ID, doctor_id: 'm-d1', payment_id: 'x-1', scheme_id: 'cs-1', kind: 'comision', base: 200, rate: 40, amount: 80, period_date: today, payout_id: null, voided_at: null, treatment_id: null, fixed_amount: null },
    )
    await renderApp('/doctores/comisiones?doctor=m-d1')
    const lines = await screen.findByRole('table', { name: 'Movimientos del periodo' })
    const esquema = within(lines).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[4]!.textContent)
    expect(esquema.sort()).toEqual(['$1,500 fijo · Corona', '30% · Implante', '40%'])
  })
})
