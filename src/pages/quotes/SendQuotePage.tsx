import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { getQuote, markQuoteFollowup, setQuoteStatus, type QuoteCard, type QuoteItem } from '@/data/quotes'
import { useQuotePdf } from '@/hooks/useQuotePdf'
import { useShareFile } from '@/hooks/useShareFile'
import { formatPhone } from '@/lib/phone'
import { downloadBlob, quoteMessage } from '@/lib/quoteShare'
import { folioLabel, money } from '@/lib/quotes'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

const textareaClasses = 'w-full rounded-sm border border-border bg-surface-raised p-3 text-ui text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-violet'

/** P20 · Enviar presupuesto por WhatsApp. El PDF se comparte como archivo (sin enlaces públicos). */
export function SendQuotePage() {
  const { id = '' } = useParams()
  const [data, setData] = useState<{ quote: QuoteCard; items: QuoteItem[] } | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    getQuote(id).then(
      (d) => current && setData(d),
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [id, attempt])

  if (failed) return <LoadError title="No pudimos abrir el presupuesto" onRetry={() => setAttempt((n) => n + 1)} />
  if (data === undefined) return <Skeleton className="h-96 w-full" label="Abriendo el presupuesto" />
  if (data === null) {
    return (
      <EmptyState
        headingLevel="h1"
        icon="presupuestos"
        title="No encontramos este presupuesto"
        description="Puede que no exista o que no tengas acceso."
        action={
          <Link to="/presupuestos" className={buttonClasses('primary')}>
            Ir a Presupuestos
          </Link>
        }
      />
    )
  }
  return <SendForm key={data.quote.id} quote={data.quote} items={data.items} onSent={() => setAttempt((n) => n + 1)} />
}

function SendForm({ quote, items, onSent }: { quote: QuoteCard; items: QuoteItem[]; onSent: () => void }) {
  const { active } = useWorkspace()
  const { build, doctorName } = useQuotePdf(quote, items)
  const [file, setFile] = useState<File | null>(null)
  const [pdfFailed, setPdfFailed] = useState(false)
  const [attach, setAttach] = useState(true)
  const [edited, setEdited] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const { mobile, share } = useShareFile()
  const canWrite = active?.tenant.status === 'active'
  const suggested = quoteMessage({
    patient: quote.patientName,
    title: quote.title,
    doctor: doctorName,
    total: Number(quote.total),
    downPayment: Number(quote.down_payment),
    installments: quote.installments,
    clinic: active?.tenant.display_name ?? '',
  })
  const message = edited ?? suggested

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

  /** Actualiza la etapa y devuelve qué decirle a quien envió. */
  const afterSend = async (): Promise<{ tone: 'success' | 'info'; text: string } | null> => {
    if (!canWrite) return null
    try {
      let text: string | null = null
      if (quote.status === 'borrador') {
        await setQuoteStatus(quote.id, 'presentado')
        text = 'Listo. Marcamos el presupuesto como presentado.'
      } else if (quote.status === 'presentado' || quote.status === 'en_duda') {
        await markQuoteFollowup(quote.id)
        text = 'Listo. Lo registramos como seguimiento.'
      }
      onSent()
      return text ? { tone: 'success', text } : null
    } catch {
      return { tone: 'info', text: 'Se envió, pero no pudimos actualizar la etapa. Cámbiala desde el presupuesto.' }
    }
  }

  const send = async () => {
    setNotice(null)
    setBusy(true)
    try {
      const sent = await share({ file: attach ? file : null, phone: quote.patientPhone, message })
      if (sent.cancelled) return
      const attachHint = sent.attachHint
      const stage = await afterSend()
      // La instrucción de adjuntar no se pierde: va junto con el aviso de la etapa.
      const text = [stage?.text, attachHint].filter(Boolean).join(' ')
      if (text) setNotice({ tone: attachHint ? 'info' : (stage?.tone ?? 'success'), text })
    } catch {
      setNotice({ tone: 'error', text: 'No pudimos abrir WhatsApp. Descarga el PDF y envíalo desde tu teléfono.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`Presupuestos · ${folioLabel(quote.folio)}`}
        title="Enviar presupuesto"
        actions={
          <Link to={`/presupuestos/${quote.id}`} className="text-ui font-semibold text-violet">
            Volver
          </Link>
        }
      />
      <div className="flex max-w-2xl flex-col gap-5">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        <Card className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-ui font-semibold">{quote.patientName}</span>
            <span className="text-caption text-ink-muted">{quote.patientPhone ? `${formatPhone(quote.patientPhone)} · WhatsApp` : 'Sin teléfono: elegirás el chat en WhatsApp'}</span>
          </span>
          <span className="font-display text-subtitle">{money(Number(quote.total))}</span>
        </Card>

        <Card as="section" aria-label="Mensaje" className="flex flex-col gap-3">
          <label htmlFor="mensaje" className="text-ui font-semibold">
            Así le llega
          </label>
          <textarea id="mensaje" rows={5} maxLength={1000} value={message} onChange={(e) => setEdited(e.target.value)} className={textareaClasses} />
          <span className="text-caption text-ink-muted">
            PDF: {file ? file.name : pdfFailed ? 'no pudimos prepararlo' : 'preparando…'}
          </span>
          <Checkbox label="Adjuntar PDF del presupuesto" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
        </Card>

        <div className="flex flex-col gap-2">
          <Button loading={busy} disabled={attach && !file && !pdfFailed} onClick={() => void send()}>
            Abrir en WhatsApp y enviar
          </Button>
          <p className="m-0 text-caption text-ink-muted">
            {mobile
              ? 'Se abre el menú para compartir con el PDF adjunto: elige WhatsApp. Tú lo envías.'
              : 'Se descarga el PDF y se abre WhatsApp con el mensaje listo; adjunta el archivo y envíalo.'}
            {quote.status === 'borrador' ? ' Al enviarlo se marca como presentado.' : ''}
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
