import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { PaymentList } from '@/components/payments/PaymentList'
import { PatientPicker } from '@/components/patients/PatientPicker'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { getPatientName } from '@/data/agenda'
import { fetchTreatments, type Treatment } from '@/data/catalog'
import { setGuideTask } from '@/data/onboarding'
import { listQuotePayments, type Payment } from '@/data/payments'
import { getQuote, markQuoteFollowup, saveQuote, setQuoteStatus, type QuoteCard, type QuoteItem } from '@/data/quotes'
import { useDoctors } from '@/hooks/useDoctors'
import { useFlashNotice } from '@/hooks/useFlashNotice'
import { useQuotePdf } from '@/hooks/useQuotePdf'
import { downloadBlob } from '@/lib/quoteShare'
import { rpcErrorMessage } from '@/lib/errors'
import { isManager } from '@/lib/roles'
import {
  canLose,
  discountAmount,
  discountError,
  EDITABLE,
  folioLabel,
  lineTotal,
  money,
  NEXT_STAGES,
  PLAN_OPTIONS,
  planText,
  quoteColumn,
  quoteTotal,
  splitDiscount,
  withDiscount,
  type Discount,
  type ItemDraft,
  type QuoteStatus,
} from '@/lib/quotes'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
const day = (d: string) => dateFmt.format(new Date(`${d.slice(0, 10)}T12:00:00`))
const plusDays = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const textareaClasses = 'w-full rounded-sm border border-border bg-surface-raised p-3 text-ui text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-violet'
const toDraft = (i: QuoteItem): ItemDraft => ({ treatmentId: i.treatment_id, concept: i.concept, note: i.note, quantity: i.quantity, unitPrice: Number(i.unit_price) })

/** P19 · Crear y editar presupuesto (/presupuestos/nuevo y /presupuestos/:id). */
export function QuotePage() {
  const { id } = useParams()
  const [data, setData] = useState<{ quote: QuoteCard; items: QuoteItem[] } | null | undefined>(id ? undefined : null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!id) return
    let current = true
    getQuote(id).then(
      (d) => current && setData(d),
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [id, attempt])

  if (failed) return <LoadError title="No pudimos abrir el presupuesto" onRetry={reload} />
  if (data === undefined) return <Skeleton className="h-96 w-full" label="Abriendo el presupuesto" />
  if (id && data === null) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="presupuestos"
        title="No encontramos este presupuesto"
        description="Puede que no exista o que no tengas acceso: los doctores solo ven los de sus pacientes."
        action={
          <Link to="/presupuestos" className={buttonClasses('primary')}>
            Ir a Presupuestos
          </Link>
        }
      />
    )
  }
  return <QuoteEditor key={data ? `${data.quote.id}-${data.quote.updated_at}` : 'nuevo'} existing={data} onChanged={reload} />
}

function QuoteEditor({ existing, onChanged }: { existing: { quote: QuoteCard; items: QuoteItem[] } | null; onChanged: () => void }) {
  const { active, refresh } = useWorkspace()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tenantId = active?.tenant_id ?? ''
  const isDoctor = active?.role === 'doctor' || active?.role === 'doctor_collab'
  const doctors = useDoctors(tenantId)
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const q = existing?.quote ?? null
  const canWrite = active?.tenant.status === 'active'
  const editable = canWrite && (!q || EDITABLE.includes(q.status))

  const [patient, setPatient] = useState<{ id: string; name: string } | null>(q ? { id: q.patient_id, name: q.patientName } : null)
  const [doctorId, setDoctorId] = useState(q?.doctor_id ?? (isDoctor ? (active?.id ?? '') : ''))
  const [title, setTitle] = useState(q?.title ?? '')
  const [initial] = useState(() => splitDiscount(existing ? existing.items.map(toDraft) : []))
  const [items, setItems] = useState<ItemDraft[]>(initial.items)
  const [discount, setDiscount] = useState<Discount | null>(initial.discount)
  const [installments, setInstallments] = useState(q?.installments ?? 0)
  const [downPayment, setDownPayment] = useState(q ? Number(q.down_payment) : 0)
  const [validUntil, setValidUntil] = useState(q?.valid_until ?? plusDays(30))
  const [notes, setNotes] = useState(q?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const flash = useFlashNotice()
  const [notice, setNotice] = useState<string | null>(flash)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    let current = true
    fetchTreatments(tenantId).then(
      (t) => current && setTreatments(t.filter((x) => x.is_active)),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [tenantId])

  const presetPatient = q ? null : params.get('paciente')
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

  if (!active) return null
  const subtotal = quoteTotal(items)
  const off = discountAmount(subtotal, discount)
  const total = Math.round((subtotal - off) * 100) / 100
  const doctorName = doctors.find((d) => d.id === doctorId)?.name ?? ''
  const setItem = (i: number, patch: Partial<ItemDraft>) => setItems((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const addTreatment = (tid: string) => {
    const t = treatments.find((x) => x.id === tid)
    if (t) setItems((l) => [...l, { treatmentId: t.id, concept: t.name, note: '', quantity: 1, unitPrice: Number(t.price_mxn) }])
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!patient) return setError('Elige al paciente.')
    if (items.length === 0) return setError('Agrega al menos un tratamiento.')
    if (items.some((x) => !x.concept.trim())) return setError('Cada partida necesita un concepto.')
    if (items.some((x) => !Number.isFinite(x.unitPrice) || x.unitPrice < 0 || !Number.isInteger(x.quantity) || x.quantity < 1)) return setError('Revisa cantidades y precios.')
    const discountProblem = discountError(subtotal, discount)
    if (discountProblem) return setError(discountProblem)
    if (installments > 0 && (downPayment < 0 || downPayment > total)) return setError('El anticipo no puede ser mayor al total.')
    setBusy(true)
    try {
      const saved = await saveQuote(q?.id ?? null, { patientId: patient.id, doctorId: doctorId || null, title, items: withDiscount(items, discount), downPayment, installments, validUntil, notes })
      if (!q) {
        // Paso de la guía de inicio (solo la gerencia lo marca; si falla, no importa).
        if (isManager(active.role)) {
          await setGuideTask(tenantId, 'first_quote', true)
            .then(() => refresh())
            .catch(() => undefined)
        }
        navigate(`/presupuestos/${saved.id}`)
      } else {
        setNotice('Guardamos los cambios.')
        onChanged()
      }
    } catch (err) {
      setError(rpcErrorMessage(err as { code?: string }, { invalid: 'Revisa los tratamientos, el total y el anticipo.' }))
    } finally {
      setBusy(false)
    }
  }

  const col = q ? quoteColumn(q.status) : null
  return (
    <>
      <PageHeader
        eyebrow={q ? `Presupuestos · ${folioLabel(q.folio)}` : 'Presupuestos'}
        title={q ? q.patientName : 'Nuevo presupuesto'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {q && <PdfActions quote={q} items={existing?.items ?? []} />}
            <Link to="/presupuestos" className="text-ui font-semibold text-violet">
              Volver
            </Link>
          </div>
        }
      />
      {notice && (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <form onSubmit={(e) => void submit(e)} noValidate className="flex min-w-0 flex-col gap-6">
          {q && col && <StageCard quote={q} canWrite={canWrite} onChanged={onChanged} badge={<Badge tone={col.tone}>{col.label}</Badge>} />}
          {q && !['borrador', 'perdido'].includes(q.status) && <QuotePayments quote={q} />}

          <Card as="section" aria-label="Paciente y doctor" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {patient ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-col">
                    <span className="text-caption text-ink-muted">Paciente</span>
                    <Link to={`/pacientes/${patient.id}`} className="text-ui font-semibold text-ink hover:text-violet">
                      {patient.name || 'Cargando…'}
                    </Link>
                  </span>
                  {!q && (
                    <button type="button" onClick={() => setPatient(null)} className="min-h-11 text-ui font-semibold text-violet">
                      Cambiar
                    </button>
                  )}
                </div>
              ) : (
                <PatientPicker tenantId={tenantId} onPick={setPatient} />
              )}
            </div>
            <Select
              label="Doctor"
              options={doctors.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Sin asignar"
              value={doctorId}
              disabled={isDoctor || !editable}
              onChange={(e) => setDoctorId(e.target.value)}
            />
            <Input label="Tratamiento principal" value={title} maxLength={120} placeholder="Ej. Ortodoncia invisible" disabled={!editable} onChange={(e) => setTitle(e.target.value)} />
          </Card>

          <Card as="section" aria-labelledby="partidas" className="flex flex-col gap-3">
            <h2 id="partidas" className="m-0 text-subtitle">
              Tratamientos
            </h2>
            {items.length === 0 && <p className="m-0 text-ui text-ink-muted">Agrega tratamientos de tu catálogo o un concepto libre.</p>}
            <ul aria-label="Partidas" className="m-0 flex list-none flex-col gap-3 p-0">
              {items.map((it, i) => (
                <li key={i} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border pb-3 sm:grid-cols-[1fr_72px_120px_100px_auto] sm:items-end">
                  <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                    <Input label={`Concepto ${i + 1}`} value={it.concept} maxLength={160} disabled={!editable} onChange={(e) => setItem(i, { concept: e.target.value })} />
                    <input
                      aria-label={`Nota del concepto ${i + 1}`}
                      value={it.note}
                      maxLength={160}
                      disabled={!editable}
                      placeholder="Nota (opcional), p. ej. «Tratamiento completo, 18 meses»"
                      onChange={(e) => setItem(i, { note: e.target.value })}
                      className="h-9 w-full rounded-sm border border-border bg-surface-raised px-3 text-caption text-ink placeholder:text-ink-muted"
                    />
                  </div>
                  <Input label="Cant." type="number" min={1} max={99} value={String(it.quantity)} disabled={!editable} onChange={(e) => setItem(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                  <Input
                    label="Precio"
                    type="number"
                    step="0.01"
                    min={0}
                    value={String(it.unitPrice)}
                    disabled={!editable}
                    onChange={(e) => setItem(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <span className="pb-2 text-ui font-semibold">{money(lineTotal(it))}</span>
                  {editable && (
                    <button type="button" aria-label={`Quitar ${it.concept || `concepto ${i + 1}`}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="min-h-11 text-ui font-semibold text-error">
                      Quitar
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {editable && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-full sm:w-72">
                  <Select
                    label="Agregar del catálogo"
                    options={treatments.map((t) => ({ value: t.id, label: `${t.name} · ${money(Number(t.price_mxn))}` }))}
                    placeholder={treatments.length ? 'Elige un tratamiento' : 'Tu catálogo está vacío'}
                    value=""
                    onChange={(e) => addTreatment(e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setItems((l) => [...l, { treatmentId: null, concept: '', note: '', quantity: 1, unitPrice: 0 }])}>
                  Concepto libre
                </Button>
              </div>
            )}
            <DiscountField subtotal={subtotal} discount={discount} amount={off} editable={editable} onChange={setDiscount} />
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-ui font-semibold">Total</span>
              <span className="font-display text-title">{money(total)}</span>
            </div>
          </Card>

          <Card as="section" aria-labelledby="plan" className="flex flex-col gap-3">
            <h2 id="plan" className="m-0 text-subtitle">
              Plan de pagos
            </h2>
            <p className="m-0 text-caption text-ink-muted">Un plan claro ayuda a que el paciente diga que sí.</p>
            <div role="group" aria-label="Mensualidades" className="flex flex-wrap gap-2">
              {PLAN_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={installments === n}
                  disabled={!editable}
                  onClick={() => setInstallments(n)}
                  className={installments === n ? buttonClasses('primary', 'sm') : buttonClasses('secondary', 'sm')}
                >
                  {n === 0 ? 'Contado' : `${n} meses`}
                </button>
              ))}
            </div>
            {installments > 0 && (
              <div className="w-full sm:w-56">
                <Input label="Anticipo para apartar" type="number" min={0} step="100" value={String(downPayment)} disabled={!editable} onChange={(e) => setDownPayment(Math.max(0, Number(e.target.value) || 0))} />
              </div>
            )}
            <p className="m-0 text-ui">
              El paciente paga: <span className="font-semibold">{planText(total, installments > 0 ? downPayment : 0, installments)}</span>
            </p>
          </Card>

          <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Vigencia" type="date" value={validUntil} disabled={!editable} onChange={(e) => setValidUntil(e.target.value)} />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="notas-presupuesto" className="text-ui font-medium">
                Notas para el paciente (opcional)
              </label>
              <textarea id="notas-presupuesto" rows={2} maxLength={1000} value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} className={textareaClasses} />
            </div>
          </Card>

          {error && <Alert tone="error">{error}</Alert>}
          {editable && (
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>
                {q ? 'Guardar cambios' : 'Guardar presupuesto'}
              </Button>
              <Link to="/presupuestos" className={buttonClasses('ghost')}>
                Cancelar
              </Link>
            </div>
          )}
          {q && !editable && canWrite && <p className="m-0 text-caption text-ink-muted">Un presupuesto aceptado ya no se edita. Si cambia el plan, crea uno nuevo.</p>}
        </form>

        <Preview
          clinic={active.tenant.display_name}
          folio={q ? folioLabel(q.folio) : 'Nuevo'}
          date={q?.created_at ?? new Date().toISOString()}
          patient={patient?.name ?? ''}
          doctor={doctorName}
          title={title}
          items={withDiscount(items, discount)}
          total={total}
          downPayment={installments > 0 ? downPayment : 0}
          installments={installments}
          validUntil={validUntil}
        />
      </div>
    </>
  )
}

/** Descargar el PDF con la marca de la clínica y abrir el envío por WhatsApp (P20). */
function PdfActions({ quote, items }: { quote: QuoteCard; items: QuoteItem[] }) {
  const { build } = useQuotePdf(quote, items)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const download = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const f = await build()
      downloadBlob(f, f.name)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void download()}>
        {failed ? 'Reintentar PDF' : 'Descargar PDF'}
      </Button>
      <Link to={`/presupuestos/${quote.id}/enviar`} className={buttonClasses('primary', 'sm')}>
        Enviar por WhatsApp
      </Link>
    </>
  )
}

/** Pagos del presupuesto: pagado, saldo y «Registrar pago» (gerencia y recepción). */
function QuotePayments({ quote }: { quote: QuoteCard }) {
  const { active } = useWorkspace()
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    listQuotePayments(quote.id).then(
      (p) => current && setPayments(p),
      () => current && setPayments([]),
    )
    return () => {
      current = false
    }
  }, [quote.id, attempt])
  if (!payments) return null
  const paid = payments.filter((p) => !p.voided_at).reduce((t, p) => t + Number(p.amount), 0)
  const balance = Math.max(0, Number(quote.total) - paid)
  const canRegister = ['owner', 'admin', 'reception'].includes(active?.role ?? '') && active?.tenant.status === 'active'
  const canVoid = ['owner', 'admin'].includes(active?.role ?? '') && active?.tenant.status === 'active'
  return (
    <Card as="section" aria-labelledby="cobros-presupuesto" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cobros-presupuesto" className="m-0 text-subtitle">
          Pagos
        </h2>
        <span className="text-ui">
          Pagado <span className="font-semibold">{money(paid)}</span> · Saldo <span className={balance > 0 ? 'font-semibold text-warning' : 'font-semibold'}>{money(balance)}</span>
        </span>
      </div>
      {canRegister && balance > 0 && (
        <Link to={`/cobros/nuevo?paciente=${quote.patient_id}&presupuesto=${quote.id}&volver=/presupuestos/${quote.id}`} className={buttonClasses('primary', 'sm', 'self-start')}>
          Registrar pago
        </Link>
      )}
      <PaymentList payments={payments} canVoid={canVoid} onChanged={() => setAttempt((n) => n + 1)} label="Pagos del presupuesto" />
    </Card>
  )
}

function StageCard({ quote, canWrite, onChanged, badge }: { quote: QuoteCard; canWrite: boolean; onChanged: () => void; badge: ReactNode }) {
  const [losing, setLosing] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'Ese cambio no es posible ahora.' }))
    } finally {
      setBusy(null)
    }
  }
  const next = NEXT_STAGES[quote.status]
  return (
    <Card as="section" aria-labelledby="etapa" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="etapa" className="m-0 text-subtitle">
          Etapa
        </h2>
        {badge}
        {quote.sent_at && <span className="text-caption text-ink-muted">Presentado el {day(quote.sent_at)}</span>}
        {quote.last_followup_at && <span className="text-caption text-ink-muted">· Último seguimiento: {day(quote.last_followup_at)}</span>}
      </div>
      {quote.status === 'perdido' && quote.lost_reason && <p className="m-0 text-ui text-ink-muted">Motivo: {quote.lost_reason}</p>}
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {next.map((n, i) => (
            <Button key={n.to} size="sm" variant={i === 0 ? 'primary' : 'secondary'} loading={busy === n.to} onClick={() => void run(n.to, () => setQuoteStatus(quote.id, n.to as QuoteStatus))}>
              {n.label}
            </Button>
          ))}
          {(quote.status === 'presentado' || quote.status === 'en_duda') && (
            <Button size="sm" variant="ghost" loading={busy === 'followup'} onClick={() => void run('followup', () => markQuoteFollowup(quote.id))}>
              Registrar seguimiento
            </Button>
          )}
          {canLose(quote.status) && !losing && (
            <Button size="sm" variant="ghost" onClick={() => setLosing(true)}>
              Marcar perdido
            </Button>
          )}
        </div>
      )}
      {losing && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Input label="¿Por qué se perdió?" value={reason} maxLength={300} placeholder="Ej. Le pareció caro; eligió otra clínica" onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={busy === 'perdido'}
              onClick={() => {
                if (!reason.trim()) return setError('Escribe el motivo.')
                void run('perdido', () => setQuoteStatus(quote.id, 'perdido', reason))
              }}
            >
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLosing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 text-caption text-error">
          {error}
        </p>
      )}
    </Card>
  )
}

type PreviewProps = {
  clinic: string
  folio: string
  date: string
  patient: string
  doctor: string
  title: string
  items: ItemDraft[]
  total: number
  downPayment: number
  installments: number
  validUntil: string
}

/** «Así lo verá el paciente» (el PDF con la marca de la clínica llega con M4-B). */
function Preview(p: PreviewProps) {
  return (
    <aside aria-label="Así lo verá el paciente" className="flex flex-col gap-2 self-start xl:sticky xl:top-6">
      <span className="text-label tracking-[0.06em] text-ink-muted uppercase">Así lo verá el paciente</span>
      <Card className="flex flex-col gap-3 bg-surface-raised">
        <div className="flex items-start justify-between gap-2">
          <span className="text-ui font-semibold">{p.clinic}</span>
          <span className="text-right text-caption text-ink-muted">
            Folio {p.folio}
            <br />
            {day(p.date)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-caption text-ink-muted">Presupuesto para</span>
          <span className="text-ui font-semibold">{p.patient || '—'}</span>
          <span className="text-caption text-ink-muted">{[p.doctor, p.title].filter(Boolean).join(' · ')}</span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-1 border-y border-border p-0 py-2">
          {p.items.length === 0 && <li className="text-caption text-ink-muted">Sin tratamientos todavía.</li>}
          {p.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-2 text-caption">
              <span>
                {it.concept || 'Concepto'}
                {it.quantity > 1 ? ` (${it.quantity})` : ''}
              </span>
              <span className={it.unitPrice < 0 ? 'text-success' : ''}>{money(lineTotal(it))}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between">
          <span className="text-ui font-semibold">Total</span>
          <span className="text-subtitle font-semibold">{money(p.total)}</span>
        </div>
        <p className="m-0 text-caption">
          <span className="font-semibold">Plan:</span> {planText(p.total, p.downPayment, p.installments)}.
        </p>
        <p className="m-0 text-caption text-ink-muted">Vigencia: hasta el {day(p.validUntil)}. Precios en MXN.</p>
      </Card>
    </aside>
  )
}

/** Descuento único del presupuesto: sin descuento, % o monto en pesos (se resta del total). */
function DiscountField({
  subtotal,
  discount,
  amount,
  editable,
  onChange,
}: {
  subtotal: number
  discount: Discount | null
  amount: number
  editable: boolean
  onChange: (d: Discount | null) => void
}) {
  const kind = discount?.kind ?? ''
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-ui text-ink-muted">Subtotal</span>
        <span className="text-ui font-semibold">{money(subtotal)}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <Select
            label="Descuento"
            options={[
              { value: '', label: 'Sin descuento' },
              { value: 'percent', label: 'Porcentaje (%)' },
              { value: 'amount', label: 'Monto ($)' },
            ]}
            value={kind}
            disabled={!editable}
            onChange={(e) => {
              const k = e.target.value
              onChange(k === 'percent' || k === 'amount' ? { kind: k, value: discount?.value ?? 0 } : null)
            }}
          />
        </div>
        {discount && (
          <div className="w-32">
            <Input
              label={discount.kind === 'percent' ? 'Porcentaje' : 'Monto'}
              type="number"
              step={discount.kind === 'percent' ? '1' : '0.01'}
              min={0}
              max={discount.kind === 'percent' ? 100 : undefined}
              value={discount.value ? String(discount.value) : ''}
              disabled={!editable}
              onChange={(e) => onChange({ kind: discount.kind, value: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
        )}
        {discount && amount > 0 && <span className="ml-auto pb-2 text-ui font-semibold text-success">{money(-amount)}</span>}
      </div>
    </div>
  )
}
