import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { documentLink, listDocuments, setDocumentArchived, uploadDocument, type PatientDocument } from '@/data/documents'
import { cn } from '@/lib/cn'
import type { DocumentKind } from '@/lib/db'
import { DOCUMENT_KINDS, documentExt, documentProblem, formatSize, kindLabel, suggestedName } from '@/lib/documents'
import { rpcErrorMessage } from '@/lib/errors'

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

type Props = { tenantId: string; patientId: string; canWrite: boolean; canArchive: boolean; onCount?: (n: number) => void }

/** M7 · Documentos del paciente (P17). Solo tu equipo los ve; cada vista y descarga queda registrada. */
export function DocumentsTab({ tenantId, patientId, canWrite, canArchive, onCount }: Props) {
  const [docs, setDocs] = useState<PatientDocument[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [showArchived, setShowArchived] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  // Si el navegador bloquea la pestaña nueva, damos el enlace (vence en 60 s) sin salir de la app.
  const [blockedLink, setBlockedLink] = useState<{ name: string; url: string } | null>(null)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let current = true
    listDocuments(patientId).then(
      (d) => {
        if (!current) return
        setFailed(false)
        setDocs(d)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [patientId, attempt])

  const active = (docs ?? []).filter((d) => !d.archived_at)
  useEffect(() => {
    if (docs) onCount?.(active.length)
  }, [docs, active.length, onCount])

  const open = async (doc: PatientDocument, action: 'view' | 'download') => {
    setNotice(null)
    setBlockedLink(null)
    // La ventana se abre en el clic (los navegadores bloquean ventanas abiertas después).
    const win = action === 'view' ? window.open('', '_blank') : null
    try {
      const url = await documentLink(doc.id, action)
      if (win) {
        win.opener = null
        win.location.href = url
      } else if (action === 'view') {
        setBlockedLink({ name: doc.name, url })
      } else {
        window.location.assign(url)
      }
    } catch (e) {
      win?.close()
      setNotice({ tone: 'error', text: (e as Error).message })
    }
  }

  const archive = async (doc: PatientDocument) => {
    setNotice(null)
    try {
      await setDocumentArchived(doc.id, !doc.archived_at)
      setNotice({ tone: 'success', text: doc.archived_at ? 'Reactivamos el documento.' : 'Archivamos el documento. Se conserva por ley.' })
      reload()
    } catch (e) {
      setNotice({ tone: 'error', text: rpcErrorMessage(e as { code?: string }) })
    }
  }

  if (failed) return <LoadError title="No pudimos cargar los documentos" onRetry={reload} />
  if (!docs) return <Skeleton className="h-40 w-full" label="Cargando documentos" />

  const shown = showArchived ? docs : active
  const archivedCount = docs.length - active.length

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-caption text-ink-muted">Solo el equipo de la clínica ve estos archivos. Cada vista y descarga queda registrada.</p>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {blockedLink && (
        <Alert tone="info">
          Tu navegador bloqueó la pestaña nueva.{' '}
          <a href={blockedLink.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet underline" onClick={() => setBlockedLink(null)}>
            Abrir «{blockedLink.name}»
          </a>{' '}
          (el enlace vence en un minuto).
        </Alert>
      )}
      {canWrite && (
        <UploadForm
          tenantId={tenantId}
          patientId={patientId}
          onUploaded={(name) => {
            setNotice({ tone: 'success', text: `Listo. Guardamos «${name}».` })
            reload()
          }}
        />
      )}
      {shown.length === 0 ? (
        <p className="m-0 text-ui text-ink-muted">{showArchived ? 'No hay documentos.' : 'Aún no hay documentos de este paciente.'}</p>
      ) : (
        <ul aria-label="Documentos" className="m-0 grid list-none grid-cols-1 gap-3 p-0 xl:grid-cols-2">
          {shown.map((d) => (
            <li key={d.id}>
              <Card padding="sm" className={cn('flex items-center gap-3', d.archived_at && 'opacity-70')}>
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-lavender text-label font-bold text-violet uppercase">
                  {extOf(d)}
                </span>
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <button type="button" onClick={() => void open(d, 'view')} className="truncate text-left text-ui font-semibold text-ink hover:text-violet">
                    {d.name}
                  </button>
                  <span className="text-caption text-ink-muted">
                    {kindLabel(d.kind)} · {dateFmt.format(new Date(d.created_at))} · {formatSize(d.size_bytes)}
                  </span>
                  {d.archived_at && (
                    <span>
                      <Badge tone="neutral">Archivado</Badge>
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row">
                  <Button variant="ghost" size="sm" aria-label={`Descargar ${d.name}`} onClick={() => void open(d, 'download')}>
                    Descargar
                  </Button>
                  {canArchive && (
                    <Button variant="ghost" size="sm" aria-label={`${d.archived_at ? 'Reactivar' : 'Archivar'} ${d.name}`} onClick={() => void archive(d)}>
                      {d.archived_at ? 'Reactivar' : 'Archivar'}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {archivedCount > 0 && (
        <button type="button" onClick={() => setShowArchived((v) => !v)} className="min-h-11 self-start text-ui font-semibold text-violet">
          {showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedCount})`}
        </button>
      )}
    </div>
  )
}

function extOf(d: PatientDocument): string {
  return d.storage_path.split('.').pop() ?? 'doc'
}

function UploadForm({ tenantId, patientId, onUploaded }: { tenantId: string; patientId: string; onUploaded: (name: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<DocumentKind>('radiografia')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileId = useId()

  const pick = (f: File | undefined, fromCamera = false) => {
    if (!f) return
    const problem = documentProblem(f)
    setError(problem)
    if (problem) return
    setFile(f)
    setName(suggestedName(f))
    if (fromCamera) setKind('foto')
    else if (documentExt(f) === 'stl') setKind('modelo')
  }

  const submit = async () => {
    if (!file) return
    if (!name.trim()) {
      setError('Escribe un nombre para el documento.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await uploadDocument({ tenantId, patientId, file, kind, name: name.trim() })
      onUploaded(name.trim())
      setFile(null)
      setName('')
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'El archivo no corresponde a este paciente.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="section" aria-label="Subir documento" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          id={fileId}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,.stl"
          className="sr-only"
          aria-label="Elegir archivo"
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Tomar foto"
          onChange={(e) => {
            pick(e.target.files?.[0], true)
            e.target.value = ''
          }}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Subir documento
        </Button>
        <Button variant="ghost" className="md:hidden" onClick={() => cameraRef.current?.click()}>
          Tomar foto
        </Button>
        <span className="text-caption text-ink-muted">PDF, JPG, PNG, WebP o STL de hasta 25 MB.</span>
      </div>
      {file && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <span className="text-ui">
            {file.name} · {formatSize(file.size)}
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Nombre del documento" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
            <Select label="Tipo" options={DOCUMENT_KINDS} value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} />
          </div>
          <div className="flex gap-2">
            <Button loading={busy} onClick={() => void submit()}>
              Guardar documento
            </Button>
            <Button variant="ghost" onClick={() => setFile(null)}>
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
