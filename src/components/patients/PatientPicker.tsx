import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Input } from '@/components/ui/Input'
import { listPatients, type PatientListItem } from '@/data/patients'
import { useDebounced } from '@/hooks/useDebounced'
import { formatPhone } from '@/lib/phone'

/** Búsqueda de paciente por nombre o teléfono (Agenda y Presupuestos). */
export function PatientPicker({ tenantId, onPick }: { tenantId: string; onPick: (p: { id: string; name: string }) => void }) {
  const [q, setQ] = useState('')
  const search = useDebounced(q.trim(), 250)
  const [results, setResults] = useState<PatientListItem[] | null>(null)

  useEffect(() => {
    if (!tenantId || search.length < 2) return
    let current = true
    listPatients({ tenantId, search, page: 0 }).then(
      (r) => current && setResults(r.rows.slice(0, 8)),
      () => current && setResults([]),
    )
    return () => {
      current = false
    }
  }, [tenantId, search])

  const shown = search.length >= 2 ? results : null
  return (
    <div className="flex flex-col gap-2">
      <Input label="Busca al paciente" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o teléfono" autoComplete="off" />
      {shown && shown.length === 0 && (
        <p className="m-0 text-caption text-ink-muted">
          No encontramos a nadie.{' '}
          <Link to="/pacientes/nuevo" className="font-semibold text-violet">
            Registrar paciente
          </Link>
        </p>
      )}
      {shown && shown.length > 0 && (
        <ul aria-label="Pacientes encontrados" className="m-0 flex list-none flex-col gap-1 p-0">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick({ id: p.id, name: p.full_name })}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-3 text-left text-ui hover:bg-lavender"
              >
                <span className="font-semibold">{p.full_name}</span>
                {p.phone_e164 && <span className="text-caption text-ink-muted">{formatPhone(p.phone_e164)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
