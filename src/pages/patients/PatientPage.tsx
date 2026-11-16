import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { IconName } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import { addPatientNote, openPatient, setPatientArchived, type PatientRecord } from '@/data/patients'
import { useDoctors } from '@/hooks/useDoctors'
import { cn } from '@/lib/cn'
import { rpcErrorMessage } from '@/lib/errors'
import { ageFrom, sourceLabel } from '@/lib/patients'
import { formatPhone } from '@/lib/phone'
import { useWorkspace } from '@/workspace/workspace-context'
import { DocumentsTab } from './DocumentsTab'

type Tab = 'resumen' | 'citas' | 'presupuestos' | 'pagos' | 'documentos' | 'notas'

const SOON: Record<Exclude<Tab, 'resumen' | 'notas' | 'documentos'>, { icon: IconName; title: string; text: string }> = {
  citas: { icon: 'agenda', title: 'Citas', text: 'Las citas de este paciente aparecerán aquí cuando llegue la Agenda.' },
  presupuestos: { icon: 'presupuestos', title: 'Presupuestos', text: 'Aquí verás sus presupuestos y su estado cuando llegue el módulo de presupuestos.' },
  pagos: { icon: 'cobros', title: 'Pagos', text: 'Los pagos y el saldo del paciente aparecerán aquí cuando llegue Cobros.' },
}

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** P15 · Ficha 360 del paciente. Abrirla queda registrado en la bitácora de accesos. */
export function PatientPage() {
  const { id = '' } = useParams()
  const { active } = useWorkspace()
  const doctors = useDoctors(active?.tenant_id)
  const [record, setRecord] = useState<PatientRecord | null>(null)
  const [error, setError] = useState<'not_found' | 'load' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [tab, setTab] = useState<Tab>('resumen')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [docCount, setDocCount] = useState<number | undefined>(undefined)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let current = true
    openPatient(id).then(
      (r) => {
        if (!current) return
        setError(null)
        setRecord(r)
      },
      (e: { code?: string }) => current && setError(e?.code === 'P0002' ? 'not_found' : 'load'),
    )
    return () => {
      current = false
    }
  }, [id, attempt])

  if (error === 'not_found') {
    return (
      <EmptyState
        headingLevel="h1"
        icon="pacientes"
        title="No encontramos a este paciente"
        description="Puede que no exista o que no tengas acceso: los doctores solo ven a sus pacientes."
        action={
          <Link to="/pacientes" className={buttonClasses('primary')}>
            Ir a Pacientes
          </Link>
        }
      />
    )
  }
  if (error === 'load') return <LoadError title="No pudimos abrir la ficha" onRetry={reload} />
  if (!record || record.patient.id !== id) return <Skeleton className="h-48 w-full" label="Abriendo la ficha" />

  const p = record.patient
  const age = ageFrom(p.birth_date)
  const doctor = doctors.find((d) => d.id === p.primary_doctor_id)?.name
  const canArchive = ['owner', 'admin', 'reception'].includes(active?.role ?? '') && active?.tenant.status === 'active'
  const wa = p.phone_e164 ? `https://wa.me/${p.phone_e164.replace('+', '')}` : null

  const toggleArchive = async () => {
    setNotice(null)
    try {
      await setPatientArchived(p.id, !p.archived_at)
      setNotice({ tone: 'success', text: p.archived_at ? 'Reactivamos al paciente.' : 'Archivamos al paciente. Sus datos se conservan.' })
      reload()
    } catch (e) {
      setNotice({ tone: 'error', text: rpcErrorMessage(e as { code?: string }) })
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'citas', label: 'Citas' },
    { id: 'presupuestos', label: 'Presupuestos' },
    { id: 'pagos', label: 'Pagos' },
    { id: 'documentos', label: 'Documentos', ...(docCount ? { count: docCount } : {}) },
    { id: 'notas', label: 'Notas', count: record.notes.length },
  ]

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="text-ui text-ink-muted">
        <Link to="/pacientes" className="text-violet">
          Pacientes
        </Link>{' '}
        / {p.full_name}
      </nav>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <Card as="section" aria-label="Datos del paciente" className="flex flex-wrap items-start gap-4">
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-pill bg-lavender font-display text-subtitle text-violet">
          {p.full_name
            .trim()
            .split(/\s+/)
            .filter((_, i, a) => i === 0 || i === a.length - 1)
            .map((w) => w[0])
            .join('')
            .toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-[24px] leading-8 font-bold md:text-title">{p.full_name}</h1>
            {p.archived_at && <Badge tone="neutral">Archivado</Badge>}
            {p.tags.map((t) => (
              <Badge key={t} tone="violet">
                {t}
              </Badge>
            ))}
          </div>
          <span className="text-ui text-ink-muted">
            {[age !== null ? `${age} años` : null, p.phone_e164 ? formatPhone(p.phone_e164) : null, p.email, `Llegó por: ${sourceLabel(p.source)}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="text-ui text-ink-muted">
            Doctor tratante: {doctor ?? 'sin asignar'} · Paciente desde el {dateFmt.format(new Date(p.created_at))}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className={buttonClasses('secondary')}>
              WhatsApp
            </a>
          )}
          <Link to={`/pacientes/${p.id}/editar`} className={buttonClasses('secondary')}>
            Editar
          </Link>
          {canArchive && (
            <Button variant="ghost" onClick={() => void toggleArchive()}>
              {p.archived_at ? 'Reactivar' : 'Archivar'}
            </Button>
          )}
        </div>
      </Card>

      <div role="tablist" aria-label="Secciones de la ficha" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'min-h-11 shrink-0 px-3 text-ui whitespace-nowrap',
              tab === t.id ? 'font-semibold text-ink shadow-[inset_0_-2px_0_var(--violet)]' : 'font-medium text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count ? <span className="ml-1.5 text-label text-ink-muted">{t.count}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'resumen' && <Summary record={record} onNotes={() => setTab('notas')} />}
        {tab === 'notas' && <Notes record={record} onAdded={reload} />}
        {tab === 'documentos' && active && (
          <DocumentsTab
            tenantId={active.tenant_id}
            patientId={p.id}
            canWrite={active.tenant.status === 'active'}
            canArchive={canArchive}
            onCount={setDocCount}
          />
        )}
        {tab !== 'resumen' && tab !== 'notas' && tab !== 'documentos' && <EmptyState icon={SOON[tab].icon} title={SOON[tab].title} description={SOON[tab].text} />}
      </div>
    </div>
  )
}

function Summary({ record, onNotes }: { record: PatientRecord; onNotes: () => void }) {
  const last = record.notes[0]
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="flex flex-col gap-1">
        <span className="text-label tracking-[0.06em] text-ink-muted uppercase">Próxima cita</span>
        <span className="text-ui text-ink-muted">Las citas llegan con la Agenda.</span>
      </Card>
      <Card className="flex flex-col gap-1">
        <span className="text-label tracking-[0.06em] text-ink-muted uppercase">Cuenta</span>
        <span className="text-ui text-ink-muted">El saldo aparece cuando registres pagos.</span>
      </Card>
      <Card className="flex flex-col gap-1">
        <span className="text-label tracking-[0.06em] text-ink-muted uppercase">Consentimiento</span>
        {record.consent ? (
          <span className="text-ui">
            {record.consent.method === 'papel' ? 'Firmado en papel' : 'Aceptado en digital'} el {dateFmt.format(new Date(record.consent.recorded_at))}
            <span className="block text-caption text-ink-muted">Aviso {record.consent.notice_version}</span>
          </span>
        ) : (
          <span className="text-ui text-warning">Sin consentimiento registrado</span>
        )}
      </Card>
      <Card className="flex flex-col gap-2 lg:col-span-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-subtitle">Última nota</h2>
          <button type="button" onClick={onNotes} className="min-h-11 text-ui font-semibold text-violet">
            Ver notas
          </button>
        </div>
        {last ? <NoteItem note={last} /> : <p className="m-0 text-ui text-ink-muted">Aún no hay notas.</p>}
      </Card>
    </div>
  )
}

function NoteItem({ note }: { note: PatientRecord['notes'][number] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="m-0 text-ui whitespace-pre-line">{note.body}</p>
      <span className="text-caption text-ink-muted">
        {note.author_name || 'Equipo'} · {dateTimeFmt.format(new Date(note.created_at))}
      </span>
    </div>
  )
}

function Notes({ record, onAdded }: { record: PatientRecord; onAdded: () => void }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      await addPatientNote(record.patient.id, body.trim())
      setBody('')
      onAdded()
    } catch (err) {
      setError(rpcErrorMessage(err as { code?: string }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
        <label htmlFor="nueva-nota" className="text-ui font-medium">
          Nueva nota
        </label>
        <textarea
          id="nueva-nota"
          value={body}
          maxLength={2000}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ej. Prefiere que le escriban por WhatsApp después de las 6 pm."
          className="w-full rounded-sm border border-border bg-surface-raised p-3 text-ui text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-violet"
        />
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Button type="submit" loading={busy} disabled={!body.trim()}>
            Guardar nota
          </Button>
        </div>
      </form>
      {record.notes.length === 0 ? (
        <p className="m-0 text-ui text-ink-muted">Aún no hay notas.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {record.notes.map((n) => (
            <li key={n.id}>
              <Card padding="sm">
                <NoteItem note={n} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
