import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { commissionLines, LINES_PAGE_SIZE, payCommissions, setCommissionScheme } from '@/data/commissions'
import { commissionStatus, schemeLabel, toPay, type CommissionKind, type CommissionLine, type CommissionRow, type Period } from '@/lib/commissions'
import { rpcErrorMessage } from '@/lib/errors'
import { receiptFolio } from '@/lib/payments'
import { folioLabel, money } from '@/lib/quotes'
import { ROLE_LABEL } from '@/lib/roles'

const dayFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const day = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`))

type Props = {
  row: CommissionRow
  period: Period
  /** Gerencia de una clínica activa: paga y cambia el esquema. */
  canManage: boolean
  onChanged: () => void
}

/** Detalle de P28: movimientos del doctor en el periodo, pago y esquema. */
export function CommissionDetail({ row, period, canManage, onChanged }: Props) {
  const [page, setPage] = useState(0)
  const [lines, setLines] = useState<{ rows: CommissionLine[]; total: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [paying, setPaying] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const due = toPay(row)
  const status = commissionStatus(row)

  useEffect(() => {
    let current = true
    commissionLines(row.doctor_id, period.from, period.to, page).then(
      (l) => {
        if (!current) return
        setFailed(false)
        setLines(l)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [row.doctor_id, period.from, period.to, page])

  const pay = async () => {
    setBusy(true)
    setError(null)
    try {
      await payCommissions(row.doctor_id, period.from, period.to, notes)
      setPaying(false)
      onChanged()
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'No hay nada por pagar en este periodo.' }))
    } finally {
      setBusy(false)
    }
  }

  const pages = lines ? Math.max(1, Math.ceil(lines.total / LINES_PAGE_SIZE)) : 1
  const canPay = canManage && status.label === 'Por pagar'

  return (
    <Card as="section" aria-labelledby="comision-titulo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="comision-titulo" className="m-0 text-subtitle">
            Detalle de {row.full_name}
          </h2>
          <span className="text-caption text-ink-muted">
            {ROLE_LABEL[row.role]} · {schemeLabel(row)}
          </span>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {failed ? (
        <Alert tone="error">No pudimos cargar los movimientos. Intenta de nuevo.</Alert>
      ) : !lines ? (
        <Skeleton className="h-40 w-full" label="Cargando movimientos" />
      ) : lines.rows.length === 0 ? (
        <p className="m-0 text-ui text-ink-muted">
          {row.scheme_kind ? 'Sin comisiones en este periodo.' : 'No lleva comisión: su producción cuenta para la clínica.'}
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[520px] border-collapse text-ui">
            <caption className="sr-only">Movimientos del periodo</caption>
            <thead>
              <tr className="text-left text-caption text-ink-muted">
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Paciente</th>
                <th className="py-2 pr-3 font-medium">Concepto</th>
                <th className="py-2 pr-3 text-right font-medium">Cobrado</th>
                <th className="py-2 text-right font-medium">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {lines.rows.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-2 pr-3 whitespace-nowrap">{day(l.period_date)}</td>
                  <td className="py-2 pr-3">{l.patient}</td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {l.kind === 'ajuste' ? `Ajuste: pago ${receiptFolio(l.folio)} anulado` : l.quote_folio ? `${l.quote_title || folioLabel(l.quote_folio)} · ${receiptFolio(l.folio)}` : `Abono · ${receiptFolio(l.folio)}`}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{money(l.base)}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {money(l.amount)}
                    {l.paid && <span className="sr-only"> (pagada)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lines && pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anteriores
          </Button>
          <span className="text-caption text-ink-muted">
            {lines.total} movimientos · página {page + 1} de {pages}
          </span>
          <Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Siguientes
          </Button>
        </div>
      )}

      {row.scheme_kind && (
        <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-border pt-3 text-ui">
          <dt className="text-ink-muted">Comisiones del periodo</dt>
          <dd className="m-0 text-right">{money(row.commission)}</dd>
          {Number(row.paid) !== 0 && (
            <>
              <dt className="text-ink-muted">Ya pagado</dt>
              <dd className="m-0 text-right">{money(row.paid)}</dd>
            </>
          )}
          {Number(row.rent_due) > 0 && (
            <>
              <dt className="text-ink-muted">Renta de unidad dental</dt>
              <dd className="m-0 text-right">{money(-row.rent_due)}</dd>
            </>
          )}
          <dt className="font-semibold">{due < 0 ? 'A favor de la clínica' : 'Por pagar'}</dt>
          <dd className="m-0 text-right font-semibold">{money(Math.abs(due))}</dd>
        </dl>
      )}

      {error && <Alert tone="error">{error}</Alert>}
      {canPay &&
        (!paying ? (
          <Button className="self-start" onClick={() => setPaying(true)}>
            Marcar como pagada
          </Button>
        ) : (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <p className="m-0 text-ui">
              {due >= 0
                ? `Vas a registrar que le pagaste ${money(due)} a ${row.full_name} por el periodo ${period.label}.`
                : `${row.full_name} le debe ${money(-due)} a la clínica por la renta del periodo ${period.label}. Vas a registrar que ya se saldó.`}
            </p>
            <Input label="Nota (opcional)" value={notes} maxLength={300} placeholder="Ej. transferencia del viernes" onChange={(e) => setNotes(e.target.value)} />
            <div className="flex gap-2">
              <Button loading={busy} onClick={() => void pay()}>
                Sí, marcar como pagada
              </Button>
              <Button variant="ghost" onClick={() => setPaying(false)}>
                No
              </Button>
            </div>
          </div>
        ))}

      {canManage && row.role !== 'owner' && <SchemeForm row={row} onSaved={onChanged} />}
    </Card>
  )
}

function SchemeForm({ row, onSaved }: { row: CommissionRow; onSaved: () => void }) {
  const [kind, setKind] = useState<CommissionKind | ''>(row.scheme_kind ?? '')
  const [value, setValue] = useState(row.scheme_kind === 'percent_collected' ? String(row.percent) : row.scheme_kind === 'chair_rent' ? String(row.rent_amount) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setError(null)
    setSaved(false)
    const n = Number(value)
    if (kind === 'percent_collected' && (!Number.isFinite(n) || n <= 0 || n > 100)) return setError('Escribe un porcentaje entre 1 y 100.')
    if (kind === 'chair_rent' && (!Number.isFinite(n) || n <= 0)) return setError('Escribe la renta por periodo.')
    setBusy(true)
    try {
      await setCommissionScheme(row.doctor_id, kind || null, kind ? n : null)
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa el esquema.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      aria-label="Esquema de comisión"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      noValidate
      className="flex flex-col gap-3 border-t border-border pt-3"
    >
      <h3 className="m-0 text-ui font-semibold">Esquema de comisión</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Esquema"
          options={[
            { value: '', label: 'Sin comisión' },
            { value: 'percent_collected', label: '% de lo cobrado' },
            { value: 'chair_rent', label: 'Renta de unidad dental' },
          ]}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as CommissionKind | '')
            setValue('')
          }}
        />
        {kind === 'percent_collected' && <Input label="Porcentaje" type="number" min={1} max={100} step="0.5" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />}
        {kind === 'chair_rent' && <Input label="Renta por periodo" type="number" min={1} step="1" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />}
      </div>
      <p className="m-0 text-caption text-ink-muted">
        {kind === 'chair_rent'
          ? 'El doctor recibe lo que cobres de sus pacientes, menos la renta de cada periodo.'
          : 'Aplica a los pagos que se registren desde hoy. Lo ya calculado no cambia.'}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Listo. Guardamos el esquema.</Alert>}
      <Button type="submit" variant="secondary" loading={busy} className="self-start">
        Guardar esquema
      </Button>
    </form>
  )
}
