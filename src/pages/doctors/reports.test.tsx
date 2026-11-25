import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { canSeeReports } from '@/lib/access'
import { addDays, DEFAULT_TZ, todayIn } from '@/lib/agenda'
import type { CommissionRow } from '@/lib/commissions'
import { acceptance, clinicBreakdown, reportPeriods, sumGroups, EMPTY_GROUPS } from '@/lib/reports'
import { fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const today = todayIn(DEFAULT_TZ)
// Mediodía en México: el mismo día local que la fecha UTC.
const at = (date: string) => `${date}T18:00:00Z`

function seedDoctor() {
  fakeDb.memberships.push({ id: 'm-d1', tenant_id: TENANT_ID, user_id: 'u-d1', role: 'doctor', status: 'active', display_name: '', created_at: '2026-11-15T00:00:00Z' })
  fakeDb.profiles.push({ id: 'u-d1', full_name: 'Dra. Karla Vega Prueba', phone_e164: null, avatar_path: null, title: '' })
  fakeDb.patients.push({ id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', primary_doctor_id: 'm-d1', phone_e164: null, email: null, archived_at: null, tags: [], source: 'manual', created_at: '2026-11-01T00:00:00Z' })
}

function quote(id: string, folio: number, status: string, total: number, doctor: string | null) {
  fakeDb.quotes.push({ id, tenant_id: TENANT_ID, folio, patient_id: 'p-1', doctor_id: doctor, title: '', status, total, sent_at: status === 'borrador' ? null : at(today), created_at: at(today) })
}

describe('M6-B2b · reglas de reportes', () => {
  it('arma los periodos del historial', () => {
    const [mes, pasado, tres, anio] = reportPeriods('2026-11-24')
    expect(mes).toMatchObject({ label: 'Este mes', from: '2026-11-01', to: '2026-11-30' })
    expect(pasado).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
    expect(tres).toMatchObject({ from: '2026-09-01', to: '2026-11-30' })
    expect(anio).toMatchObject({ from: '2026-01-01', to: '2026-12-31' })
    expect(reportPeriods('2027-01-10')[1]).toMatchObject({ from: '2026-12-01', to: '2026-12-31' })
    expect(reportPeriods('2027-02-10')[2]).toMatchObject({ from: '2026-12-01', to: '2027-02-28' })
  })

  it('suma los grupos y calcula la aceptación', () => {
    const a = { ...EMPTY_GROUPS, presented: 4, presented_amount: 1000, accepted: 1, accepted_amount: 250 }
    const b = { ...EMPTY_GROUPS, presented: 0 }
    expect(sumGroups([a, b])).toMatchObject({ presented: 4, accepted: 1, accepted_amount: 250 })
    expect(acceptance(a)).toBe(25)
    expect(acceptance(b)).toBeNull()
  })

  it('desglosa lo que le queda a la clínica con la producción de la dueña', () => {
    const r = (over: Partial<CommissionRow>) => ({ scheme_kind: null, rent_amount: null, collected: 0, commission: 0, role: 'doctor', ...over }) as CommissionRow
    expect(clinicBreakdown([
      r({ role: 'owner', collected: 5000 }),
      r({ scheme_kind: 'percent_collected', collected: 1000, commission: 400 }),
      r({ scheme_kind: 'chair_rent', rent_amount: 3000, collected: 2000 }),
    ])).toEqual({ collected: 8000, commissions: 400, rent: 3000, clinic: 10600, owner: 5000 })
  })

  it('solo la dueña o el dueño ve los reportes', () => {
    expect(canSeeReports('owner')).toBe(true)
    for (const r of ['admin', 'reception', 'doctor', 'doctor_collab', 'doctor_intern'] as const) expect(canSeeReports(r)).toBe(false)
  })
})

describe('M6-B2b · pestaña Reportes', () => {
  it('la dueña ve los presupuestos de cada doctor del periodo', async () => {
    seedDoctor()
    quote('q-1', 1, 'presentado', 1000, 'm-d1')
    quote('q-2', 2, 'en_duda', 2000, 'm-d1')
    quote('q-3', 3, 'aceptado', 3000, 'm-d1')
    quote('q-4', 4, 'en_tratamiento', 4000, 'm-d1')
    quote('q-5', 5, 'perdido', 500, 'm-d1')
    quote('q-6', 6, 'borrador', 9999, 'm-d1')
    quote('q-7', 7, 'aceptado', 800, null)
    const user = userEvent.setup()
    await renderApp('/equipo')
    await user.click(within(await screen.findByRole('navigation', { name: 'Secciones de tu equipo' })).getByRole('link', { name: 'Reportes' }))
    const table = await screen.findByRole('table', { name: 'Presupuestos por doctor' })
    const row = within(table).getByRole('row', { name: /Dra\. Karla Vega Prueba/ })
    const cells = within(row).getAllByRole('cell').map((c) => c.textContent)
    // Presentados 5 · Aceptados 2 · En espera 2 · Sin completar 2 · Perdidos 1 · Aceptación 40%
    expect(cells.slice(1)).toEqual(['5$10,500', '2$7,000', '2$3,000', '2$7,000', '1$500', '40%'])
    expect(within(table).getByRole('row', { name: /Sin doctor/ })).toBeInTheDocument()
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('doctor_quote_report', expect.objectContaining({ p_tenant: TENANT_ID, p_from: reportPeriods(today)[0]!.from }))
  })

  it.each(['admin', 'reception', 'doctor'] as const)('%s no ve la pestaña y si abre la dirección vuelve a Tu equipo', async (role) => {
    const { router } = await renderApp('/doctores/reportes', { role })
    await waitFor(() => expect(router.state.location.pathname).toBe('/equipo'))
    const tabs = await screen.findByRole('navigation', { name: 'Secciones de tu equipo' })
    expect(within(tabs).queryByRole('link', { name: 'Reportes' })).not.toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('doctor_quote_report', expect.anything())
  })
})

describe('M6-B2b · historial del doctor', () => {
  it('la dueña ve el historial y cambia el periodo', async () => {
    seedDoctor()
    const tomorrow = addDays(today, 1)
    fakeDb.appointments.push(
      { id: 'a-1', tenant_id: TENANT_ID, doctor_id: 'm-d1', patient_id: 'p-1', status: 'llego', kind: 'tratamiento', starts_at: `${today}T00:30:00Z`, ends_at: `${today}T01:00:00Z` },
      { id: 'a-2', tenant_id: TENANT_ID, doctor_id: 'm-d1', patient_id: 'p-1', status: 'programada', kind: 'valoracion', starts_at: at(addDays(tomorrow, 2)), ends_at: at(addDays(tomorrow, 2)) },
    )
    fakeDb.payments.push({ id: 'x-1', tenant_id: TENANT_ID, folio: 1, patient_id: 'p-1', quote_id: null, doctor_id: 'm-d1', amount: 1500, method: 'efectivo', paid_at: at(today), voided_at: null })
    const user = userEvent.setup()
    await renderApp('/doctores/m-d1')
    const card = await screen.findByRole('region', { name: 'Historial' })
    await waitFor(() => expect(within(card).getByText('Cobrado').nextElementSibling).toHaveTextContent('$1,500'))
    expect(within(card).getByText('Comisiones')).toBeInTheDocument()
    expect(within(within(card).getByRole('list', { name: 'Próximas citas' })).getByText('Laura Méndez Prueba')).toBeInTheDocument()
    await user.selectOptions(within(card).getByLabelText('Periodo del historial'), 'anio')
    await waitFor(() =>
      expect(fakeSupabase.rpc).toHaveBeenCalledWith('doctor_history', { p_doctor: 'm-d1', p_from: reportPeriods(today)[3]!.from, p_to: reportPeriods(today)[3]!.to }),
    )
  })

  it('la administración no ve el historial', async () => {
    seedDoctor()
    await renderApp('/doctores/m-d1', { role: 'admin' })
    await screen.findByRole('region', { name: 'Horario' })
    expect(screen.queryByRole('region', { name: 'Historial' })).not.toBeInTheDocument()
    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith('doctor_history', expect.anything())
  })
})

describe('M6-B2b · comisiones', () => {
  it('la gerencia ve el desglose y con qué esquema se calculó cada movimiento', async () => {
    seedDoctor()
    // Como Luis: cobró con 40% y después pasó a renta; lo anterior se queda con su %.
    fakeDb.commission_schemes.push(
      { id: 'cs-0', tenant_id: TENANT_ID, membership_id: 'm-d1', kind: 'percent_collected', percent: 40, rent_amount: null, started_at: '2026-11-01T00:00:00Z', ended_at: '2026-11-02T00:00:00Z' },
      { id: 'cs-1', tenant_id: TENANT_ID, membership_id: 'm-d1', kind: 'chair_rent', percent: null, rent_amount: 3000, started_at: '2026-11-02T00:00:00Z', ended_at: null },
    )
    fakeDb.payments.push(
      { id: 'x-1', tenant_id: TENANT_ID, folio: 1, patient_id: 'p-1', quote_id: null, doctor_id: 'm-d1', amount: 1000, method: 'efectivo', paid_at: at(today), voided_at: null },
      { id: 'x-2', tenant_id: TENANT_ID, folio: 2, patient_id: 'p-1', quote_id: null, doctor_id: 'm-d1', amount: 900, method: 'efectivo', paid_at: at(today), voided_at: null },
    )
    fakeDb.commission_entries.push(
      { id: 'ce-1', tenant_id: TENANT_ID, doctor_id: 'm-d1', payment_id: 'x-1', scheme_id: 'cs-0', kind: 'comision', base: 1000, rate: 40, amount: 400, period_date: today, payout_id: null, voided_at: null },
      { id: 'ce-2', tenant_id: TENANT_ID, doctor_id: 'm-d1', payment_id: 'x-2', scheme_id: 'cs-1', kind: 'comision', base: 900, rate: 100, amount: 900, period_date: today, payout_id: null, voided_at: null },
    )
    await renderApp('/doctores/comisiones?doctor=m-d1')
    const card = await screen.findByRole('region', { name: 'Lo que queda para la clínica' })
    // 1,900 cobrado − 1,300 de comisiones + 3,000 de renta.
    expect(within(card).getByText('Le queda a la clínica').nextElementSibling).toHaveTextContent('$3,600')
    expect(card).toHaveTextContent('Producción de Propietaria')
    const lines = await screen.findByRole('table', { name: 'Movimientos del periodo' })
    const rows = within(lines).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent).slice(3))
    expect(rows).toEqual([
      ['$900', 'Renta', '$900'],
      ['$1,000', '40%', '$400'],
    ])
  })

})
