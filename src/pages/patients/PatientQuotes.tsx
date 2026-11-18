import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { listPatientQuotes, type Quote } from '@/data/quotes'
import { folioLabel, money, quoteColumn } from '@/lib/quotes'

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

/** Pestaña Presupuestos de la ficha 360. */
export function PatientQuotes({ patientId, canCreate }: { patientId: string; canCreate: boolean }) {
  const [rows, setRows] = useState<Quote[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    listPatientQuotes(patientId).then(
      (r) => {
        if (!current) return
        setFailed(false)
        setRows(r)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [patientId, attempt])

  if (failed) return <LoadError title="No pudimos cargar los presupuestos" onRetry={() => setAttempt((n) => n + 1)} />
  if (rows === null) return <Skeleton className="h-40 w-full" label="Cargando presupuestos" />
  const action = canCreate ? (
    <Link to={`/presupuestos/nuevo?paciente=${patientId}`} className={buttonClasses('primary')}>
      Nuevo presupuesto
    </Link>
  ) : undefined
  if (rows.length === 0) return <EmptyState icon="presupuestos" title="Sin presupuestos" description="Arma su plan de tratamiento con tu catálogo de precios." action={action} />
  return (
    <div className="flex flex-col gap-4">
      {action && <div>{action}</div>}
      <Card className="flex flex-col gap-2">
        <ul aria-label="Presupuestos del paciente" className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((q) => {
            const col = quoteColumn(q.status)
            return (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                <Link to={`/presupuestos/${q.id}`} className="flex flex-col">
                  <span className="text-ui font-semibold text-ink hover:text-violet">
                    {q.title || 'Presupuesto'} · {money(Number(q.total))}
                  </span>
                  <span className="text-caption text-ink-muted">
                    {folioLabel(q.folio)} · {dateFmt.format(new Date(q.created_at))}
                  </span>
                </Link>
                <Badge tone={col.tone}>{col.label}</Badge>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
