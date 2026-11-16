import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import { listPatients, type PatientListItem } from '@/data/patients'
import { useDebounced } from '@/hooks/useDebounced'
import { useDoctors } from '@/hooks/useDoctors'
import { cn } from '@/lib/cn'
import { ageFrom, PATIENTS_PAGE_SIZE, sourceLabel } from '@/lib/patients'
import { formatPhone } from '@/lib/phone'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

/** P14 · Pacientes: búsqueda y paginación en el servidor. Cada quien ve solo a quien puede ver. */
export function PatientsPage() {
  const { active } = useWorkspace()
  const tenantId = active?.tenant_id ?? ''
  const doctors = useDoctors(tenantId)
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; rows: PatientListItem[]; total: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const query = useDebounced(search.trim(), 300)
  const key = `${tenantId}|${query}|${archived}|${page}|${attempt}`

  useEffect(() => {
    if (!tenantId) return
    let current = true
    listPatients({ tenantId, search: query, page, archived }).then(
      (r) => {
        if (!current) return
        setFailed(false)
        setResult({ key, ...r })
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, query, page, archived, key])

  const loading = !result || result.key !== key
  const doctorName = (id: string | null) => (id ? doctors.find((d) => d.id === id)?.name : undefined)
  const total = result?.total ?? 0
  const from = page * PATIENTS_PAGE_SIZE

  return (
    <>
      <PageHeader
        title="Pacientes"
        actions={
          <Link to="/pacientes/nuevo" className={buttonClasses('primary')}>
            <Icon name="mas_nuevo" size={18} strokeWidth={2} /> Nuevo paciente
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-0 flex-[1_1_280px] items-center gap-2 rounded-sm border border-border bg-surface-raised px-3 text-ink-muted focus-within:outline-2 focus-within:outline-violet">
          <Icon name="buscar" size={18} />
          <span className="sr-only">Buscar pacientes</span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Busca por nombre o teléfono"
            className="min-w-0 grow border-0 bg-transparent text-ui text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
        <div role="group" aria-label="Estado" className="flex gap-1 rounded-md border border-border bg-surface-raised p-1">
          {[
            { v: false, label: 'Activos' },
            { v: true, label: 'Archivados' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={archived === o.v}
              onClick={() => {
                setArchived(o.v)
                setPage(0)
              }}
              className={cn('min-h-9 rounded-sm px-3 text-ui font-medium', archived === o.v ? 'bg-lavender text-violet' : 'text-ink-muted hover:text-ink')}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <LoadError title="No pudimos cargar tus pacientes" onRetry={() => setAttempt((n) => n + 1)} />
      ) : loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : total === 0 ? (
        query || archived ? (
          <EmptyState icon="buscar" title={archived ? 'No hay pacientes archivados' : 'No encontramos pacientes'} description={query ? `Nada coincide con «${query}». Revisa el nombre o el teléfono.` : 'Cuando archives a un paciente aparecerá aquí.'} />
        ) : (
          <EmptyState
            icon="pacientes"
            title="Aún no tienes pacientes"
            description="Registra a tu primer paciente. Aquí tendrás su ficha, citas, presupuestos y documentos."
            action={
              <Link to="/pacientes/nuevo" className={buttonClasses('primary')}>
                Registrar paciente
              </Link>
            }
          />
        )
      ) : (
        <>
          <ul aria-label="Lista de pacientes" className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-border bg-surface-raised p-0">
            {result!.rows.map((p) => {
              const age = ageFrom(p.birth_date)
              const doc = doctorName(p.primary_doctor_id)
              return (
                <li key={p.id} className="border-t border-border first:border-t-0">
                  <Link to={`/pacientes/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 text-ink no-underline hover:bg-lavender">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-lavender font-display text-ui font-bold text-violet">
                      {initials(p.full_name)}
                    </span>
                    <span className="flex min-w-0 grow flex-col gap-0.5">
                      <span className="truncate text-ui font-semibold">{p.full_name}</span>
                      <span className="truncate text-caption text-ink-muted">
                        {[age !== null ? `${age} años` : null, p.phone_e164 ? formatPhone(p.phone_e164) : null, doc ? `Tratante: ${doc}` : null].filter(Boolean).join(' · ') ||
                          sourceLabel(p.source)}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={18} className="shrink-0 text-ink-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
          <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-ui text-ink-muted">
            <span>
              {from + 1}–{Math.min(from + PATIENTS_PAGE_SIZE, total)} de {total}
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={buttonClasses('secondary', 'sm')}>
                Anterior
              </button>
              <button type="button" disabled={from + PATIENTS_PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)} className={buttonClasses('secondary', 'sm')}>
                Siguiente
              </button>
            </span>
          </nav>
        </>
      )}
    </>
  )
}

function initials(name: string): string {
  const w = name.trim().split(/\s+/)
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? (w[w.length - 1]?.[0] ?? '') : '')).toUpperCase()
}
