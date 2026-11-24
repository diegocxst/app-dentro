import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { setCommissionScheme } from '@/data/commissions'
import type { CommissionKind, CommissionRow } from '@/lib/commissions'
import { rpcErrorMessage } from '@/lib/errors'

type SchemeRow = Pick<CommissionRow, 'doctor_id' | 'scheme_kind' | 'percent' | 'rent_amount'>

/** Esquema de comisión de un doctor (P27 y detalle de P28). Solo la gerencia. */
export function SchemeForm({ row, onSaved }: { row: SchemeRow; onSaved: () => void }) {
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
