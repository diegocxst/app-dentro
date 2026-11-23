import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { getReceipt, type Receipt } from '@/data/payments'
import { useClinicPdf } from '@/hooks/useClinicPdf'
import { useDoctors } from '@/hooks/useDoctors'
import { useFlashNotice } from '@/hooks/useFlashNotice'
import { useShareFile } from '@/hooks/useShareFile'
import { methodLabel, receiptFolio, receiptMessage } from '@/lib/payments'
import { formatPhone } from '@/lib/phone'
import { downloadBlob, receiptFileName } from '@/lib/quoteShare'
import { folioLabel, money } from '@/lib/quotes'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

const textareaClasses = 'w-full rounded-sm border border-border bg-surface-raised p-3 text-ui text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-violet'

/** M5-B · Comprobante de pago: PDF con la marca de la clínica y envío por WhatsApp. */
export function SendReceiptPage() {
  const { id = '' } = useParams()
  const [data, setData] = useState<Receipt | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    getReceipt(id).then(
      (d) => {
        if (!current) return
        setFailed(false)
        setData(d)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [id, attempt])

  if (failed) return <LoadError title="No pudimos abrir el pago" onRetry={() => setAttempt((n) => n + 1)} />
  if (data === undefined) return <Skeleton className="h-96 w-full" label="Abriendo el pago" />
  if (data === null) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="cobros"
        title="No encontramos este pago"
        description="Puede que no exista o que no tengas acceso."
        action={
          <Link to="/cobros" className={buttonClasses('primary')}>
            Ir a Cobros
          </Link>
        }
      />
    )
  }
  if (data.payment.voided_at) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="cobros"
        title="Este pago está anulado"
        description="Los pagos anulados no tienen comprobante."
        action={
          <Link to={`/pacientes/${data.payment.patient_id}`} className={buttonClasses('secondary')}>
            Ir a la ficha
          </Link>
        }
      />
    )
  }
  return <ReceiptForm key={data.payment.id} r={data} />
}

function ReceiptForm({ r }: { r: Receipt }) {
  const { active } = useWorkspace()
  const [params] = useSearchParams()
  const flash = useFlashNotice()
  const clinicPdf = useClinicPdf()
  const doctors = useDoctors(active?.tenant_id)
  const { mobile, share } = useShareFile()
  const doctorName = doctors.find((d) => d.id === r.payment.doctor_id)?.name ?? ''
  const folio = receiptFolio(r.payment.folio)
  const amount = Number(r.payment.amount)
  const [file, setFile] = useState<File | null>(null)
  const [pdfFailed, setPdfFailed] = useState(false)
  const [attach, setAttach] = useState(true)
  const [edited, setEdited] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(flash ? { tone: 'success', text: flash } : null)
  const [busy, setBusy] = useState(false)
  const back = params.get('volver')
  const backTo = back?.startsWith('/') ? back : `/pacientes/${r.payment.patient_id}`
  const message = edited ?? receiptMessage({ patient: r.patientName, amount, folio, clinic: active?.tenant.display_name ?? '', balance: r.balance })

  const build = useCallback(async (): Promise<File> => {
    const [{ renderReceiptPdf }, clinic] = await Promise.all([import('./receiptPdf'), clinicPdf()])
    const blob = await renderReceiptPdf({
      clinic,
      folio,
      paidAt: r.payment.paid_at,
      patient: r.patientName,
      doctor: doctorName,
      amount,
      method: methodLabel(r.payment.method),
      reference: r.payment.reference ?? '',
      quote: r.quote ? { folio: folioLabel(r.quote.folio), title: r.quote.title, total: r.quote.total } : null,
      balance: r.balance,
    })
    return new File([blob], receiptFileName(folio, r.patientName), { type: 'application/pdf' })
  }, [clinicPdf, folio, r, doctorName, amount])

  // Se prepara al abrir: así «Compartir» ocurre dentro del clic (lo exigen los navegadores).
  useEffect(() => {
    let current = true
    build().then(
      (f) => current && setFile(f),
      () => current && setPdfFailed(true),
    )
    return () => {
      current = false
    }
  }, [build])

  const send = async () => {
    setNotice(null)
    setBusy(true)
    try {
      const sent = await share({ file: attach ? file : null, phone: r.patientPhone, message })
      if (!sent.cancelled && sent.attachHint) setNotice({ tone: 'info', text: sent.attachHint })
    } catch {
      setNotice({ tone: 'error', text: 'No pudimos abrir WhatsApp. Descarga el PDF y envíalo desde tu teléfono.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`Cobros · ${folio}`}
        title="Enviar comprobante"
        actions={
          <Link to={backTo} className="text-ui font-semibold text-violet">
            Volver
          </Link>
        }
      />
      <div className="flex max-w-2xl flex-col gap-5">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="text-ui font-semibold">{r.patientName}</span>
              <span className="text-caption text-ink-muted">{r.patientPhone ? `${formatPhone(r.patientPhone)} · WhatsApp` : 'Sin teléfono: elegirás el chat en WhatsApp'}</span>
            </span>
            <span className="font-display text-subtitle">{money(amount)}</span>
          </div>
          <span className="text-caption text-ink-muted">
            {[methodLabel(r.payment.method), r.quote ? `${folioLabel(r.quote.folio)}${r.quote.title ? ` · ${r.quote.title}` : ''}` : 'Abono a cuenta'].join(' · ')}
            {r.balance !== null ? ` · ${r.balance > 0 ? `queda un saldo de ${money(r.balance)}` : 'presupuesto liquidado'}` : ''}
          </span>
        </Card>

        <Card as="section" aria-label="Mensaje" className="flex flex-col gap-3">
          <label htmlFor="mensaje" className="text-ui font-semibold">
            Así le llega
          </label>
          <textarea id="mensaje" rows={4} maxLength={1000} value={message} onChange={(e) => setEdited(e.target.value)} className={textareaClasses} />
          <span className="text-caption text-ink-muted">PDF: {file ? file.name : pdfFailed ? 'no pudimos prepararlo' : 'preparando…'}</span>
          <Checkbox label="Adjuntar PDF del comprobante" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
        </Card>

        <div className="flex flex-col gap-2">
          <Button loading={busy} disabled={attach && !file && !pdfFailed} onClick={() => void send()}>
            Abrir en WhatsApp y enviar
          </Button>
          <p className="m-0 text-caption text-ink-muted">
            {mobile
              ? 'Se abre el menú para compartir con el PDF adjunto: elige WhatsApp. Tú lo envías.'
              : 'Se descarga el PDF y se abre WhatsApp con el mensaje listo; adjunta el archivo y envíalo.'}{' '}
            El comprobante no es una factura.
          </p>
          {file && (
            <button type="button" onClick={() => downloadBlob(file, file.name)} className="min-h-11 self-start text-ui font-semibold text-violet">
              Solo descargar el PDF
            </button>
          )}
        </div>
      </div>
    </>
  )
}
