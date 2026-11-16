import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createArcoRequest, exportPatientData, listArcoRequests, updateArcoRequest, type ArcoRequest } from '@/data/arco'
import { ARCO_CHANNELS, ARCO_RIGHTS, ARCO_STATUS, channelLabel, daysLeft, exportFileName, isResolved, localToday, rightLabel, type ArcoRight } from '@/lib/arco'
import type { TenantRole } from '@/lib/db'
import { rpcErrorMessage } from '@/lib/errors'

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
const day = (v: string) => dateFmt.format(new Date(`${v}T12:00:00`))
const textareaClasses = 'w-full rounded-sm border border-border bg-surface-raised p-3 text-ui text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-violet'

type Props = { patientId: string; patientName: string; role: TenantRole | undefined; tenantActive: boolean }
type Notice = { tone: 'success' | 'error'; text: string } | null

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Privacidad del paciente (LFPDPPP): solicitudes ARCO y exportación de sus datos. */
export function PrivacyCard({ patientId, patientName, role, tenantActive }: Props) {
  const manager = role === 'owner' || role === 'admin'
  const canRegister = (manager || role === 'reception') && tenantActive
  const [requests, setRequests] = useState<ArcoRequest[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [exporting, setExporting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!manager) return
    let current = true
    listArcoRequests(patientId).then(
      (r) => {
        if (!current) return
        setFailed(false)
        setRequests(r)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [manager, patientId, attempt])

  if (!manager && role !== 'reception') return null

  const exportData = async () => {
    setNotice(null)
    setExporting(true)
    try {
      const data = await exportPatientData(patientId)
      download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), exportFileName(patientName, 'json'))
      const { renderExportPdf } = await import('./exportPdf')
      download(await renderExportPdf(data), exportFileName(patientName, 'pdf'))
      setNotice({ tone: 'success', text: 'Descargamos el PDF y el JSON. La exportación quedó en la bitácora.' })
    } catch (e) {
      setNotice({ tone: 'error', text: rpcErrorMessage(e as { code?: string }) })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card as="section" aria-labelledby="privacidad-titulo" className="flex flex-col gap-4 lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="privacidad-titulo" className="m-0 text-subtitle">
            Privacidad y derechos ARCO
          </h2>
          <p className="m-0 text-caption text-ink-muted">
            {manager
              ? 'Registra lo que pida el paciente y respóndele en 20 días hábiles. Exportar sus datos queda registrado.'
              : 'Si el paciente pide ver, corregir o borrar sus datos, regístralo aquí. La dueña o la administración le dan seguimiento.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {manager && (
            <Button variant="secondary" loading={exporting} onClick={() => void exportData()}>
              Exportar datos
            </Button>
          )}
          {canRegister && !formOpen && (
            <Button variant="ghost" onClick={() => setFormOpen(true)}>
              Registrar solicitud
            </Button>
          )}
        </div>
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {formOpen && (
        <RequestForm
          patientId={patientId}
          onCancel={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            setNotice({
              tone: 'success',
              text: manager ? 'Registramos la solicitud.' : 'Registramos la solicitud. La dueña o la administración le darán seguimiento.',
            })
            reload()
          }}
        />
      )}

      {manager &&
        (failed ? (
          <Alert tone="error">
            No pudimos cargar las solicitudes.{' '}
            <button type="button" onClick={reload} className="font-semibold underline">
              Reintentar
            </button>
          </Alert>
        ) : requests === null ? null : requests.length === 0 ? (
          <p className="m-0 text-ui text-ink-muted">Este paciente no ha hecho solicitudes.</p>
        ) : (
          <ul aria-label="Solicitudes ARCO" className="m-0 flex list-none flex-col gap-3 p-0">
            {requests.map((r) => (
              <RequestItem key={r.id} request={r} canEdit={tenantActive} onChanged={reload} onError={(text) => setNotice({ tone: 'error', text })} />
            ))}
          </ul>
        ))}
    </Card>
  )
}

function RequestForm({ patientId, onCancel, onSaved }: { patientId: string; onCancel: () => void; onSaved: () => void }) {
  const today = localToday()
  const [right, setRight] = useState<ArcoRight>('acceso')
  const [channel, setChannel] = useState<string>('presencial')
  const [receivedOn, setReceivedOn] = useState(today)
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!receivedOn || receivedOn > today) {
      setError('Revisa la fecha en que llegó la solicitud.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createArcoRequest({ patientId, right, channel, receivedOn, details })
      onSaved()
    } catch (err) {
      setError(rpcErrorMessage(err as { code?: string }, { invalid: 'Revisa la fecha en que llegó la solicitud.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form aria-label="Nueva solicitud ARCO" onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Qué pide"
          options={ARCO_RIGHTS.map(({ value, label }) => ({ value, label }))}
          value={right}
          onChange={(e) => setRight(e.target.value as ArcoRight)}
          hint={ARCO_RIGHTS.find((x) => x.value === right)?.hint}
        />
        <Select label="Cómo llegó" options={ARCO_CHANNELS} value={channel} onChange={(e) => setChannel(e.target.value)} />
        <Input label="Fecha en que llegó" type="date" max={today} value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="arco-detalles" className="text-ui font-medium">
          Detalles (opcional)
        </label>
        <textarea
          id="arco-detalles"
          rows={2}
          maxLength={1000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Ej. Pide copia de su expediente por correo."
          className={textareaClasses}
        />
      </div>
      {error && (
        <p role="alert" className="m-0 text-caption text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          Guardar solicitud
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function DueBadge({ request }: { request: ArcoRequest }) {
  if (isResolved(request.status)) return <Badge tone={request.status === 'atendida' ? 'success' : 'neutral'}>{ARCO_STATUS[request.status]}</Badge>
  const left = daysLeft(request.due_on)
  if (left < 0) return <Badge tone="error">Vencida hace {-left} {-left === 1 ? 'día' : 'días'}</Badge>
  if (left <= 5) return <Badge tone="warning">Vence en {left} {left === 1 ? 'día' : 'días'}</Badge>
  return <Badge tone="neutral">Vence el {day(request.due_on)}</Badge>
}

function RequestItem({ request: r, canEdit, onChanged, onError }: { request: ArcoRequest; canEdit: boolean; onChanged: () => void; onError: (t: string) => void }) {
  const [resolving, setResolving] = useState(false)
  const [outcome, setOutcome] = useState<'atendida' | 'improcedente'>('atendida')
  const [response, setResponse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const resolved = isResolved(r.status)
  const label = `${rightLabel(r.right)} del ${day(r.received_on)}`

  const save = async (status: 'en_proceso' | 'atendida' | 'improcedente') => {
    if (status !== 'en_proceso' && !response.trim()) {
      setError('Escribe la respuesta que diste al paciente.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updateArcoRequest(r.id, status, status === 'en_proceso' ? '' : response)
      setResolving(false)
      onChanged()
    } catch (e) {
      onError(rpcErrorMessage(e as { code?: string }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-ui font-semibold">{label}</span>
          <span className="text-caption text-ink-muted">
            {channelLabel(r.channel)} · {resolved ? ARCO_STATUS[r.status] : `${ARCO_STATUS[r.status]} · responde antes del ${day(r.due_on)}`}
          </span>
        </div>
        <DueBadge request={r} />
      </div>
      {r.details && <p className="m-0 text-ui whitespace-pre-line text-ink-muted">{r.details}</p>}
      {r.response && (
        <p className="m-0 text-ui whitespace-pre-line">
          <span className="font-semibold">Respuesta: </span>
          {r.response}
        </p>
      )}
      {canEdit && !resolved && !resolving && (
        <div className="flex flex-wrap gap-2">
          {r.status === 'recibida' && (
            <Button variant="ghost" size="sm" loading={busy} aria-label={`Marcar en proceso: ${label}`} onClick={() => void save('en_proceso')}>
              Marcar en proceso
            </Button>
          )}
          <Button variant="secondary" size="sm" aria-label={`Responder: ${label}`} onClick={() => setResolving(true)}>
            Responder
          </Button>
        </div>
      )}
      {resolving && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <fieldset className="m-0 flex flex-wrap gap-4 border-0 p-0">
            <legend className="mb-1 text-ui font-medium">Resultado</legend>
            {(['atendida', 'improcedente'] as const).map((o) => (
              <label key={o} className="flex min-h-11 items-center gap-2 text-ui">
                <input type="radio" name={`resultado-${r.id}`} value={o} checked={outcome === o} onChange={() => setOutcome(o)} className="size-4 accent-violet" />
                {ARCO_STATUS[o]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`respuesta-${r.id}`} className="text-ui font-medium">
              Respuesta al paciente
            </label>
            <textarea
              id={`respuesta-${r.id}`}
              rows={2}
              maxLength={2000}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Ej. Le entregamos copia de sus datos en PDF el 16 de noviembre."
              className={textareaClasses}
            />
          </div>
          {error && (
            <p role="alert" className="m-0 text-caption text-error">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={() => void save(outcome)}>
              Guardar respuesta
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setResolving(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
