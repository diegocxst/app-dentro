import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { fetchTreatments, type Treatment } from '@/data/catalog'
import { fetchTreatmentRules, setTreatmentCommission } from '@/data/commissions'
import { ruleLabel, type TreatmentRule } from '@/lib/commissions'
import { rpcErrorMessage } from '@/lib/errors'

type RuleKind = 'percent' | 'amount'

/**
 * Comisión por tratamiento (M6-C1, obs. 14): excepciones al % general del doctor.
 * La gerencia las pone o quita; el doctor las ve.
 */
export function TreatmentRules({ membershipId, tenantId, generalPercent, canManage }: { membershipId: string; tenantId: string; generalPercent: number; canManage: boolean }) {
  const [rules, setRules] = useState<TreatmentRule[] | null>(null)
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let current = true
    Promise.all([fetchTreatmentRules(membershipId), fetchTreatments(tenantId)]).then(
      ([r, t]) => {
        if (!current) return
        setFailed(false)
        setRules(r)
        setTreatments(t)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [membershipId, tenantId, version])

  const name = (id: string) => treatments.find((t) => t.id === id)?.name ?? 'Tratamiento'
  const available = treatments.filter((t) => t.is_active && !rules?.some((r) => r.treatment_id === t.id))

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <h3 className="m-0 text-ui font-semibold">Comisión por tratamiento</h3>
      {failed ? (
        <p className="m-0 text-ui text-ink-muted">No pudimos cargar las comisiones por tratamiento.</p>
      ) : !rules ? (
        <Skeleton className="h-16 w-full" label="Cargando comisiones por tratamiento" />
      ) : (
        <>
          {rules.length === 0 ? (
            <p className="m-0 text-ui text-ink-muted">Todos los tratamientos usan el {generalPercent}% general.</p>
          ) : (
            <ul aria-label="Comisión por tratamiento" className="m-0 flex list-none flex-col p-0">
              {rules.map((r) => (
                <RuleRow key={r.id} label={name(r.treatment_id)} rule={r} canManage={canManage} onRemove={() => setTreatmentCommission(membershipId, r.treatment_id, null).then(reload)} />
              ))}
            </ul>
          )}
          {canManage && available.length > 0 && <RuleForm key={version} membershipId={membershipId} treatments={available} onSaved={reload} />}
          <p className="m-0 text-caption text-ink-muted">
            Si un abono es de un presupuesto, se reparte entre sus tratamientos. Un monto fijo se gana conforme se cobra. Lo ya calculado no cambia.
          </p>
        </>
      )}
    </div>
  )
}

function RuleRow({ label, rule, canManage, onRemove }: { label: string; rule: TreatmentRule; canManage: boolean; onRemove: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <li className="flex flex-col gap-1 border-t border-border py-2 first:border-t-0">
      <div className="flex items-center justify-between gap-3 text-ui">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{label}</span>
          <span className="text-caption text-ink-muted">{ruleLabel(rule)}</span>
        </span>
        {canManage && (
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            aria-label={`Quitar la comisión de ${label}`}
            onClick={() => {
              setBusy(true)
              setError(null)
              onRemove().catch((e) => {
                setBusy(false)
                setError(rpcErrorMessage(e as { code?: string }))
              })
            }}
          >
            Quitar
          </Button>
        )}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </li>
  )
}

function RuleForm({ membershipId, treatments, onSaved }: { membershipId: string; treatments: Treatment[]; onSaved: () => void }) {
  const [treatment, setTreatment] = useState('')
  const [kind, setKind] = useState<RuleKind>('percent')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    const n = Number(value)
    if (!treatment) return setError('Elige un tratamiento.')
    if (kind === 'percent' && (!value || !Number.isFinite(n) || n <= 0 || n > 100)) return setError('Escribe un porcentaje entre 1 y 100.')
    if (kind === 'amount' && (!value || !Number.isFinite(n) || n <= 0)) return setError('Escribe el monto por tratamiento.')
    setBusy(true)
    try {
      await setTreatmentCommission(membershipId, treatment, kind === 'percent' ? { percent: n } : { amount: n })
      onSaved()
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa la comisión del tratamiento.' }))
      setBusy(false)
    }
  }

  return (
    <form
      aria-label="Agregar comisión por tratamiento"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      noValidate
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Tratamiento"
          placeholder="Elige uno"
          options={treatments.map((t) => ({ value: t.id, label: t.name }))}
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
        />
        <Select
          label="Comisión"
          options={[
            { value: 'percent', label: '% de lo cobrado' },
            { value: 'amount', label: 'Monto fijo por unidad' },
          ]}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as RuleKind)
            setValue('')
          }}
        />
        <Input
          label={kind === 'percent' ? 'Porcentaje' : 'Monto por unidad'}
          type="number"
          min={1}
          max={kind === 'percent' ? 100 : undefined}
          step={kind === 'percent' ? '0.5' : '1'}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" variant="secondary" loading={busy} className="self-start">
        Agregar comisión
      </Button>
    </form>
  )
}
