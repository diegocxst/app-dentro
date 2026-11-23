import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { voidPayment } from '@/data/payments'
import { DEFAULT_TZ, todayIn } from '@/lib/agenda'
import { commissionsCsv, commissionStatus, periodFor, periodTotals, recentPeriods, schemeLabel, toPay, type CommissionRow } from '@/lib/commissions'
import { fakeDb, fakeUser, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const OWNER = `m-${TENANT_ID}`
const period = periodFor(todayIn(DEFAULT_TZ), 'quincenal')
// Mediodía en México: el mismo día local que la fecha UTC.
const paidAt = `${period.from}T18:00:00Z`

function row(over: Partial<CommissionRow> = {}): CommissionRow {
  return {
    doctor_id: 'm-d1', full_name: 'Dr. Pablo Soto', role: 'doctor_collab', scheme_kind: 'percent_collected', percent: 40, rent_amount: null as unknown as number,
    patients: 2, collected: 6600, commission: 2640, pending: 2640, paid: 0, rent_due: 0, last_paid_at: null as unknown as string, ...over,
  }
}

function seedTeam() {
  fakeDb.memberships.push(
    { id: 'm-d1', tenant_id: TENANT_ID, user_id: 'u-d1', role: 'doctor_collab', status: 'active', created_at: '2026-11-15T00:00:00Z' },
    { id: 'm-d2', tenant_id: TENANT_ID, user_id: 'u-d2', role: 'doctor', status: 'active', created_at: '2026-11-15T00:00:00Z' },
    { id: 'm-r1', tenant_id: TENANT_ID, user_id: 'u-r1', role: 'reception', status: 'active', created_at: '2026-11-15T00:00:00Z' },
  )
  fakeDb.profiles.push(
    { id: 'u-d1', full_name: 'Dr. Pablo Soto Prueba', phone_e164: null, avatar_path: null },
    { id: 'u-d2', full_name: 'Dra. Karla Vega Prueba', phone_e164: null, avatar_path: null },
  )
  fakeDb.patients.push(
    { id: 'p-1', tenant_id: TENANT_ID, full_name: 'Mariana Gil Prueba', phone_e164: null, archived_at: null, tags: [], primary_doctor_id: 'm-d1', created_at: '2026-11-01T00:00:00Z' },
    { id: 'p-2', tenant_id: TENANT_ID, full_name: 'Daniela Ortiz Prueba', phone_e164: null, archived_at: null, tags: [], primary_doctor_id: 'm-d2', created_at: '2026-11-01T00:00:00Z' },
  )
  fakeDb.commission_schemes.push(
    { id: 'cs-1', tenant_id: TENANT_ID, membership_id: 'm-d1', kind: 'percent_collected', percent: 40, rent_amount: null, started_at: '2026-11-01T00:00:00Z', ended_at: null },
    { id: 'cs-2', tenant_id: TENANT_ID, membership_id: 'm-d2', kind: 'chair_rent', percent: null, rent_amount: 3000, started_at: '2026-11-01T00:00:00Z', ended_at: null },
  )
}

/** Registra un pago con su comisión, como lo haría la base (trigger). */
function pay(id: string, folio: number, patient: string, doctor: string, amount: number) {
  fakeDb.payments.push({ id, tenant_id: TENANT_ID, folio, patient_id: patient, quote_id: null, doctor_id: doctor, amount, method: 'efectivo', paid_at: paidAt, voided_at: null })
  const s = fakeDb.commission_schemes.find((x) => x.membership_id === doctor && !x.ended_at)
  if (!s) return
  const rate = s.kind === 'percent_collected' ? Number(s.percent) : 100
  fakeDb.commission_entries.push({ id: `ce-${id}`, tenant_id: TENANT_ID, doctor_id: doctor, payment_id: id, scheme_id: s.id, kind: 'comision', base: amount, rate, amount: (amount * rate) / 100, period_date: period.from, payout_id: null, voided_at: null })
}

describe('reglas de comisiones', () => {
  it('arma los periodos quincenales y mensuales', () => {
    expect(periodFor('2026-11-10', 'quincenal')).toEqual({ from: '2026-11-01', to: '2026-11-15', label: '1–15 nov 2026' })
    expect(periodFor('2026-02-20', 'quincenal')).toEqual({ from: '2026-02-16', to: '2026-02-28', label: '16–28 feb 2026' })
    expect(periodFor('2028-02-20', 'mensual').to).toBe('2028-02-29')
    expect(recentPeriods('2027-01-05', 'quincenal', 3).map((p) => p.from)).toEqual(['2027-01-01', '2026-12-16', '2026-12-01'])
    expect(recentPeriods('2027-01-05', 'mensual', 2).map((p) => p.label)).toEqual(['ene 2027', 'dic 2026'])
  })

  it('calcula lo que falta pagar, el estado y los totales', () => {
    expect(schemeLabel(row())).toBe('40% de lo cobrado')
    expect(schemeLabel(row({ scheme_kind: 'chair_rent', percent: null as unknown as number, rent_amount: 3000 }))).toBe('Renta de $3,000 por periodo')
    expect(schemeLabel(row({ scheme_kind: null as unknown as CommissionRow['scheme_kind'] }))).toBe('Sin comisión')
    expect(toPay(row({ pending: 1000, rent_due: 3000 }))).toBe(-2000)
    expect(commissionStatus(row()).label).toBe('Por pagar')
    expect(commissionStatus(row({ pending: 0, last_paid_at: '2026-11-15T00:00:00Z' })).label).toBe('Pagada')
    expect(commissionStatus(row({ scheme_kind: null as unknown as CommissionRow['scheme_kind'], commission: 0, pending: 0 })).label).toBe('No aplica')
    const t = periodTotals([row(), row({ doctor_id: 'x', scheme_kind: 'chair_rent', rent_amount: 3000, collected: 1000, commission: 1000, pending: 1000, rent_due: 3000 })])
    expect(t).toEqual({ collected: 7600, commission: 3640, pending: 2640, clinic: 6960 })
    expect(commissionsCsv([row()], period).split('\n')[1]).toBe(`${period.label},Dr. Pablo Soto,40% de lo cobrado,2,6600,2640,2640,Por pagar`)
  })
})

describe('M6-A · Comisiones', () => {
  it('la gerencia ve a cada doctor, su detalle y marca la comisión como pagada', async () => {
    seedTeam()
    pay('x1', 1, 'p-1', 'm-d1', 5000)
    pay('x2', 2, 'p-1', 'm-d1', 1600)
    pay('x3', 3, 'p-2', 'm-d2', 1000)
    const user = userEvent.setup()
    await renderApp('/doctores')
    expect(await screen.findByRole('heading', { level: 1, name: 'Comisiones' })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Comisiones por doctor' })
    expect(within(table).getByText('Dueña Prueba')).toBeInTheDocument()
    expect(within(table).getByText('Renta de $3,000 por periodo')).toBeInTheDocument()
    expect(screen.getByText('Cobrado en el periodo').nextSibling).toHaveTextContent('$7,600')
    expect(screen.getByText('Comisiones por pagar').nextSibling).toHaveTextContent('$2,640')

    // Por omisión se abre el primer doctor con esquema.
    expect(await screen.findByRole('heading', { name: 'Detalle de Dr. Pablo Soto Prueba' })).toBeInTheDocument()
    const lines = await screen.findByRole('table', { name: 'Movimientos del periodo' })
    expect(within(lines).getAllByText('Mariana Gil Prueba')).toHaveLength(2)
    expect(within(lines).getByText('$2,000')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Marcar como pagada' }))
    expect(screen.getByText(/Vas a registrar que le pagaste \$2,640 a Dr\. Pablo Soto Prueba/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nota (opcional)'), 'Transferencia')
    await user.click(screen.getByRole('button', { name: 'Sí, marcar como pagada' }))
    await waitFor(() => expect(fakeDb.commission_payouts).toHaveLength(1))
    expect(fakeDb.commission_payouts[0]).toMatchObject({ doctor_id: 'm-d1', commissions: 2640, rent: 0, notes: 'Transferencia', period_from: period.from })
    expect(await within(table).findByText('Pagada')).toBeInTheDocument()
  })

  it('renta de unidad dental: lo cobrado menos la renta, a favor de la clínica', async () => {
    seedTeam()
    pay('x3', 3, 'p-2', 'm-d2', 1000)
    const user = userEvent.setup()
    await renderApp('/doctores')
    await user.click(await screen.findByRole('button', { name: /Dra\. Karla Vega Prueba/ }))
    expect(await screen.findByRole('heading', { name: 'Detalle de Dra. Karla Vega Prueba' })).toBeInTheDocument()
    expect(screen.getByText('A favor de la clínica').nextSibling).toHaveTextContent('$2,000')
    await user.click(screen.getByRole('button', { name: 'Marcar como pagada' }))
    expect(screen.getByText(/le debe \$2,000 a la clínica por la renta/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sí, marcar como pagada' }))
    await waitFor(() => expect(fakeDb.commission_payouts[0]).toMatchObject({ commissions: 1000, rent: 3000, total: -2000 }))
  })

  it('la gerencia asigna el esquema y cambia el corte', async () => {
    seedTeam()
    fakeDb.commission_schemes.splice(0, 2)
    const user = userEvent.setup()
    await renderApp('/doctores')
    await user.click(await screen.findByRole('button', { name: /Dr\. Pablo Soto Prueba/ }))
    const form = await screen.findByRole('form', { name: 'Esquema de comisión' })
    await user.selectOptions(within(form).getByLabelText('Esquema'), 'percent_collected')
    await user.click(within(form).getByRole('button', { name: 'Guardar esquema' }))
    expect(await within(form).findByText('Escribe un porcentaje entre 1 y 100.')).toBeInTheDocument()
    await user.type(within(form).getByLabelText('Porcentaje'), '35')
    await user.click(within(form).getByRole('button', { name: 'Guardar esquema' }))
    expect(await within(form).findByText('Listo. Guardamos el esquema.')).toBeInTheDocument()
    expect(fakeDb.commission_schemes).toEqual([expect.objectContaining({ membership_id: 'm-d1', kind: 'percent_collected', percent: 35, ended_at: null })])
    expect(await within(screen.getByRole('table', { name: 'Comisiones por doctor' })).findByText('35% de lo cobrado')).toBeInTheDocument()

    // La dueña no lleva esquema.
    await user.click(screen.getByRole('button', { name: /Dueña Prueba/ }))
    await screen.findByRole('heading', { name: 'Detalle de Dueña Prueba' })
    expect(screen.queryByRole('form', { name: 'Esquema de comisión' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Corte de la clínica'), 'mensual')
    await waitFor(() => expect(fakeDb.tenants[0]?.commission_period).toBe('mensual'))
    expect((screen.getByLabelText('Periodo') as HTMLSelectElement).selectedOptions[0]?.textContent).not.toContain('–')
  })

  it('un doctor ve solo lo suyo y no puede pagar ni cambiar el esquema', async () => {
    fakeDb.profiles.push({ id: fakeUser().id, full_name: 'Dr. Colaborador Prueba', phone_e164: null, avatar_path: null })
    fakeDb.patients.push({ id: 'p-1', tenant_id: TENANT_ID, full_name: 'Mariana Gil Prueba', phone_e164: null, archived_at: null, tags: [], primary_doctor_id: OWNER, created_at: '2026-11-01T00:00:00Z' })
    fakeDb.commission_schemes.push({ id: 'cs-1', tenant_id: TENANT_ID, membership_id: OWNER, kind: 'percent_collected', percent: 40, rent_amount: null, started_at: '2026-11-01T00:00:00Z', ended_at: null })
    pay('x1', 1, 'p-1', OWNER, 5000)
    fakeDb.memberships.push({ id: 'm-d2', tenant_id: TENANT_ID, user_id: 'u-d2', role: 'doctor', status: 'active' })
    await renderApp('/doctores', { role: 'doctor_collab' })
    expect(await screen.findByRole('heading', { name: 'Detalle de Dr. Colaborador Prueba' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Comisiones por doctor' })).not.toBeInTheDocument()
    expect(screen.getByText('Tu comisión del periodo').nextSibling).toHaveTextContent('$2,000')
    expect(screen.queryByRole('button', { name: 'Marcar como pagada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Esquema de comisión' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Corte de la clínica')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
  })

  it('recepción no ve comisiones', async () => {
    await renderApp('/doctores', { role: 'reception' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Las comisiones las ve la gerencia' })).toBeInTheDocument()
  })

  it('si se anula un pago ya pagado al doctor, queda un ajuste negativo por descontar', async () => {
    seedTeam()
    pay('x1', 1, 'p-1', 'm-d1', 5000)
    fakeDb.commission_payouts.push({ id: 'po-1', tenant_id: TENANT_ID, doctor_id: 'm-d1', period_from: period.from, period_to: period.to, commissions: 2000, rent: 0, total: 2000, paid_at: '2026-11-15T00:00:00Z' })
    fakeDb.commission_entries[0]!.payout_id = 'po-1'
    await voidPayment('x1', 'Devolución')
    await renderApp('/doctores')
    const lines = await screen.findByRole('table', { name: 'Movimientos del periodo' })
    expect(await within(lines).findByText('Ajuste: pago R-0001 anulado')).toBeInTheDocument()
    expect(within(lines).getByText('−$2,000')).toBeInTheDocument()
    expect(screen.getByText('Ya pagado').nextSibling).toHaveTextContent('$2,000')
    expect(screen.getByText('A favor de la clínica').nextSibling).toHaveTextContent('$2,000')
  })
  it('si solo está la dueña, invita a sumar un doctor para asignar comisiones', async () => {
    await renderApp('/doctores')
    expect(await screen.findByRole('link', { name: 'invita a un doctor a tu equipo' })).toHaveAttribute('href', '/configuracion/equipo')
    expect(screen.queryByRole('form', { name: 'Esquema de comisión' })).not.toBeInTheDocument()
  })
})
