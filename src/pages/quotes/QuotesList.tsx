import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-styles'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { listQuotes, QUOTES_PAGE_SIZE, type QuoteCard } from '@/data/quotes'
import { folioLabel, money, QUOTE_COLUMNS, quoteColumn, type QuoteStatus } from '@/lib/quotes'

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Presupuestos en lista (Ajustes-D, obs. 12): todos, del más reciente al más viejo, con su
 * etapa, doctor y total. Filtro por etapa; paginado en el servidor.
 */
export function QuotesList({ tenantId, doctorId, doctorName }: { tenantId: string; doctorId: string; doctorName: (id: string | null) => string }) {
  const [status, setStatus] = useState<QuoteStatus | ''>('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ rows: QuoteCard[]; total: number; key: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  // Clave de la consulta: mientras llega otra, no se muestran filas viejas.
  const key = `${doctorId}|${status}|${page}`

  useEffect(() => {
    let current = true
    listQuotes({ tenantId, page, ...(doctorId ? { doctorId } : {}), ...(status ? { status } : {}) }).then(
      (r) => {
        if (!current) return
        setFailed(false)
        setData({ ...r, key: `${doctorId}|${status}|${page}` })
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, doctorId, status, page, attempt])

  const from = page * QUOTES_PAGE_SIZE
  return (
    <section aria-label="Lista de presupuestos" className="flex flex-col gap-3">
      <div className="w-full sm:w-56">
        <Select
          label="Etapa"
          options={[{ value: '', label: 'Todas' }, ...QUOTE_COLUMNS.map((c) => ({ value: c.value, label: c.label }))]}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as QuoteStatus | '')
            setPage(0)
          }}
        />
      </div>

      {failed ? (
        <LoadError title="No pudimos cargar los presupuestos" onRetry={reload} />
      ) : !data || data.key !== key ? (
        <Skeleton className="h-64 w-full" label="Cargando presupuestos" />
      ) : data.total === 0 ? (
        <p className="m-0 rounded-lg border border-border bg-surface-raised p-4 text-ui text-ink-muted">No hay presupuestos con estos filtros.</p>
      ) : (
        <>
          <div className="hidden grid-cols-[80px_1.4fr_1.2fr_1fr_120px_110px_100px] gap-3 px-[17px] text-caption text-ink-muted md:grid" aria-hidden="true">
            <span>Folio</span>
            <span>Paciente</span>
            <span>Tratamiento</span>
            <span>Doctor</span>
            <span>Etapa</span>
            <span className="text-right">Total</span>
            <span className="text-right">Fecha</span>
          </div>
          <ul aria-label="Presupuestos" className="m-0 flex list-none flex-col gap-2 p-0">
            {data.rows.map((q) => {
              const col = quoteColumn(q.status)
              const total = Number(q.total) > 0 ? money(Number(q.total)) : '—'
              const doctor = doctorName(q.doctor_id) || 'Sin asignar'
              const date = dateFmt.format(new Date(q.created_at))
              return (
                <li key={q.id}>
                  <Link to={`/presupuestos/${q.id}`} className="block rounded-md border border-border bg-surface-raised px-4 py-3 text-ink no-underline hover:border-violet">
                    {/* Móvil: tres renglones. */}
                    <span className="flex flex-col gap-1 md:hidden">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-ui font-semibold">{q.patientName}</span>
                        <span className="shrink-0 text-ui font-semibold">{total}</span>
                      </span>
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-caption text-ink-muted">{[folioLabel(q.folio), q.title].filter(Boolean).join(' · ')}</span>
                        <Badge tone={col.tone}>{col.label}</Badge>
                      </span>
                      <span className="truncate text-caption text-ink-muted">
                        {doctor} · {date}
                      </span>
                    </span>
                    {/* Escritorio: columnas. */}
                    <span className="hidden grid-cols-[80px_1.4fr_1.2fr_1fr_120px_110px_100px] items-center gap-3 md:grid">
                      <span className="text-ui text-ink-muted">{folioLabel(q.folio)}</span>
                      <span className="truncate text-ui font-semibold">{q.patientName}</span>
                      <span className="truncate text-ui">{q.title || '—'}</span>
                      <span className="truncate text-ui text-ink-muted">{doctor}</span>
                      <span>
                        <Badge tone={col.tone}>{col.label}</Badge>
                      </span>
                      <span className="text-right text-ui font-semibold">{total}</span>
                      <span className="text-right text-caption text-ink-muted">{date}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-ui text-ink-muted">
            <span>
              {from + 1}–{Math.min(from + QUOTES_PAGE_SIZE, data.total)} de {data.total}
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={buttonClasses('secondary', 'sm')}>
                Anterior
              </button>
              <button type="button" disabled={from + QUOTES_PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)} className={buttonClasses('secondary', 'sm')}>
                Siguiente
              </button>
            </span>
          </nav>
        </>
      )}
    </section>
  )
}
