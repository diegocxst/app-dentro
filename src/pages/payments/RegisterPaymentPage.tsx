import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PatientPicker } from '@/components/patients/PatientPicker'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { getPatientName } from '@/data/agenda'
import { patientAccount, registerPayment } from '@/data/payments'
import { DEFAULT_TZ, todayIn } from '@/lib/agenda'
import { rpcErrorMessage } from '@/lib/errors'
import { PAYMENT_METHODS, receiptFolio, suggestedAmount, type AccountQuote, type PaymentMethod } from '@/lib/payments'
import { folioLabel, money } from '@/lib/quotes'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

/** P22 · Registrar pago o abono (manual; el link de pago llega con E6). */
export function RegisterPaymentPage() {
  const { active, branches, activeBranchId } = useWorkspace()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tz = branches.find((b) => b.id === activeBranchId)?.timezone ?? DEFAULT_TZ
  const today = todayIn(tz)
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null)
  const [quotes, setQuotes] = useState<AccountQuote[] | null>(null)
  const [quoteId, setQuoteId] = useState(params.get('presupuesto') ?? '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [date, setDate] = useState(today)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const presetPatient = params.get('paciente')
  useEffect(() => {
    if (!presetPatient) return
    let current = true
    getPatientName(presetPatient).then(
      (name) => current && name && setPatient({ id: presetPatient, name }),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [presetPatient])

  // Presupuestos del paciente con saldo; sugiere el monto (anticipo o mensualidad).
  const patientId = patient?.id
  useEffect(() => {
    if (!patientId) return
    let current = true
    patientAccount(patientId).then(
      (a) => {
        if (!current) return
        const open = a.quotes.filter((q) => q.balance > 0)
        setQuotes(open)
        const pick = open.find((q) => q.id === params.get('presupuesto')) ?? (open.length === 1 ? open[0] : undefined)
        if (pick) {
          setQuoteId(pick.id)
          setAmount(String(suggestedAmount(pick)))
        }
      },
      () => current && setQuotes([]),
    )
    return () => {
      current = false
    }
  }, [patientId, params])

  if (!active) return null
  if (!['owner', 'admin', 'reception'].includes(active.role) || active.tenant.status !== 'active') {
    return <EmptyState headingLevel="h1" icon="cobros" title="No puedes registrar pagos" description="Los registran la dueña, la administración o recepción de una clínica activa." />
  }

  const quote = quotes?.find((q) => q.id === quoteId) ?? null
  const pickQuote = (id: string) => {
    setQuoteId(id)
    const q = quotes?.find((x) => x.id === id)
    if (q) setAmount(String(suggestedAmount(q)))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const value = Math.round(Number(amount) * 100) / 100
    if (!patient) return setError('Elige al paciente.')
    if (!Number.isFinite(value) || value <= 0) return setError('Escribe el monto.')
    if (quote && value > quote.balance) return setError(`El pago supera el saldo del presupuesto (${money(quote.balance)}).`)
    if (date > today) return setError('La fecha no puede ser futura.')
    setBusy(true)
    try {
      // Hoy: la hora actual. Otro día: mediodía (la hora exacta no importa para el corte).
      const paidAt = date === today ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString()
      const saved = await registerPayment({ patientId: patient.id, quoteId: quote?.id ?? null, amount: value, method, paidAt, reference, notes })
      const back = params.get('volver')
      const to = back?.startsWith('/') ? back : quote ? `/presupuestos/${quote.id}` : `/pacientes/${patient.id}`
      // Al registrar se abre el comprobante para enviarlo; «Volver» lleva a donde ibas.
      navigate(`/cobros/${saved.id}/comprobante?${new URLSearchParams({ volver: to }).toString()}`, {
        state: { notice: `Listo. Registramos el pago ${receiptFolio(saved.folio)} por ${money(value)}.` },
      })
    } catch (err) {
      setError(rpcErrorMessage(err as { code?: string }, { invalid: 'Revisa el monto, la fecha y el presupuesto.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cobros"
        title="Registrar pago"
        description="El pago se hace en la clínica (efectivo, transferencia o terminal). dentro solo lo registra."
        actions={
          <Link to="/cobros" className="text-ui font-semibold text-violet">
            Volver
          </Link>
        }
      />
      <form onSubmit={(e) => void submit(e)} noValidate className="flex max-w-2xl flex-col gap-5">
        <Card as="section" aria-label="Paciente" className="flex flex-col gap-3">
          {patient ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-col">
                <span className="text-caption text-ink-muted">Paciente</span>
                <span className="text-ui font-semibold">{patient.name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setPatient(null)
                  setQuotes(null)
                  setQuoteId('')
                }}
                className="min-h-11 text-ui font-semibold text-violet"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <PatientPicker tenantId={active.tenant_id} onPick={setPatient} />
          )}
          {patient && quotes && (
            <Select
              label="¿A qué presupuesto?"
              options={[
                ...quotes.map((q) => ({ value: q.id, label: `${folioLabel(q.folio)} · ${q.title || 'Presupuesto'} · saldo ${money(q.balance)}` })),
                { value: '', label: 'Sin presupuesto (abono suelto)' },
              ]}
              value={quoteId}
              onChange={(e) => pickQuote(e.target.value)}
              hint={
                quote
                  ? `Total ${money(quote.total)} · pagado ${money(quote.paid)} · saldo ${money(quote.balance)}${quote.status === 'presentado' || quote.status === 'en_duda' ? '. Al registrar este pago el presupuesto pasa a «Aceptado».' : ''}`
                  : undefined
              }
            />
          )}
        </Card>

        <Card as="section" aria-label="Pago" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Monto" type="number" min={0} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Fecha" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          <div role="group" aria-label="Forma de pago" className="flex flex-wrap gap-2 sm:col-span-2">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.value} type="button" aria-pressed={method === m.value} onClick={() => setMethod(m.value)} className={method === m.value ? buttonClasses('primary', 'sm') : buttonClasses('secondary', 'sm')}>
                {m.label}
              </button>
            ))}
          </div>
          <Input label="Referencia (opcional)" value={reference} maxLength={80} placeholder="Ej. folio de la terminal o de la transferencia" onChange={(e) => setReference(e.target.value)} />
          <Input label="Nota (opcional)" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} />
        </Card>

        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            Registrar pago
          </Button>
          <Link to="/cobros" className={buttonClasses('ghost')}>
            Cancelar
          </Link>
        </div>
      </form>
    </>
  )
}
