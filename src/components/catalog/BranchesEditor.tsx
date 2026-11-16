import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { setBranchTimezone } from '@/data/agenda'
import { TIMEZONES } from '@/lib/agenda'
import { createBranch, createChair, fetchAllBranches, fetchChairs, setBranchHours, setChairActive, updateBranch, type Branch, type Chair } from '@/data/catalog'
import { parseHours } from '@/lib/hours'
import { HoursEditor } from './HoursEditor'
import { rpcErrorMessage } from '@/lib/errors'
import { useWorkspace } from '@/workspace/workspace-context'

type Props = {
  tenantId: string
  canEdit: boolean
  /** Avisa cuántos sillones activos hay (el paso 2 exige al menos uno). */
  onChairsCount?: (n: number) => void
}

/** Sucursales y sillones (onboarding paso 2 y Configuración). Cada cambio se guarda al momento. */
export function BranchesEditor({ tenantId, canEdit, onChairsCount }: Props) {
  const { refresh } = useWorkspace()
  const [branches, setBranches] = useState<Branch[] | null>(null)
  const [chairs, setChairs] = useState<Chair[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let current = true
    Promise.all([fetchAllBranches(tenantId), fetchChairs(tenantId)]).then(
      ([b, c]) => {
        if (!current) return
        setLoadFailed(false)
        setBranches(b.filter((x) => x.is_active))
        setChairs(c.filter((x) => x.is_active))
      },
      () => current && setLoadFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, version])

  useEffect(() => {
    onChairsCount?.(chairs.length)
  }, [chairs.length, onChairsCount])

  const act = async (fn: () => Promise<void>, messages: { duplicate?: string } = {}) => {
    setError(null)
    try {
      await fn()
      reload()
      await refresh() // El selector de sucursal de la barra también cambia.
    } catch (e) {
      setError(rpcErrorMessage(e as { code?: string }, messages))
    }
  }

  if (branches === null && loadFailed) return <LoadError title="No pudimos cargar tus sucursales" onRetry={reload} />
  if (branches === null) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="error">{error}</Alert>}
      {(branches ?? []).map((b) => (
        <BranchCard
          key={b.id}
          branch={b}
          chairs={chairs.filter((c) => c.branch_id === b.id)}
          canEdit={canEdit}
          onSave={(name, address) => act(() => updateBranch(b.id, { name, address }), { duplicate: 'Ya tienes una sucursal con ese nombre.' })}
          onAddChair={(name) => act(() => createChair(b.id, name), { duplicate: 'Ya hay un sillón con ese nombre en esta sucursal.' })}
          onRemoveChair={(id) => act(() => setChairActive(id, false))}
          onSaveHours={(hours) => act(() => setBranchHours(b.id, hours as Record<string, [string, string][]>))}
          onSaveTimezone={(tz) => act(() => setBranchTimezone(b.id, tz))}
        />
      ))}
      {canEdit && <NewBranchForm onAdd={(name) => act(() => createBranch(tenantId, name, ''), { duplicate: 'Ya tienes una sucursal con ese nombre.' })} />}
    </div>
  )
}

function BranchCard({
  branch,
  chairs,
  canEdit,
  onSave,
  onAddChair,
  onRemoveChair,
  onSaveHours,
  onSaveTimezone,
}: {
  branch: Branch
  chairs: Chair[]
  canEdit: boolean
  onSave: (name: string, address: string) => Promise<void>
  onAddChair: (name: string) => Promise<void>
  onRemoveChair: (id: string) => Promise<void>
  onSaveHours: (hours: ReturnType<typeof parseHours>) => Promise<void>
  onSaveTimezone: (tz: string) => Promise<void>
}) {
  const [name, setName] = useState(branch.name)
  const [address, setAddress] = useState(branch.address)
  const [chairName, setChairName] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = name.trim() !== branch.name || address.trim() !== branch.address

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    await fn()
    setBusy(false)
  }

  const addChair = (e: FormEvent) => {
    e.preventDefault()
    if (!chairName.trim()) return
    void run(async () => {
      await onAddChair(chairName.trim())
      setChairName('')
    })
  }

  return (
    <Card as="section" aria-label={`Sucursal ${branch.name}`} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Nombre de la sucursal" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
        <Input label="Dirección" value={address} disabled={!canEdit} placeholder="Calle, número, colonia" onChange={(e) => setAddress(e.target.value)} />
      </div>
      {canEdit && dirty && (
        <div>
          <Button variant="secondary" size="sm" loading={busy} onClick={() => void run(() => onSave(name.trim(), address.trim()))}>
            Guardar sucursal
          </Button>
        </div>
      )}
      <Select
        label="Zona horaria"
        options={TIMEZONES}
        value={branch.timezone}
        disabled={!canEdit || busy}
        hint="El horario y la agenda de esta sucursal usan esta hora."
        onChange={(e) => void run(() => onSaveTimezone(e.target.value))}
      />
      <HoursEditor branchName={branch.name} initial={parseHours(branch.opening_hours)} canEdit={canEdit} onSave={onSaveHours} />
      <div className="flex flex-col gap-2">
        <span className="text-ui font-medium">Sillones</span>
        {chairs.length === 0 ? (
          <p className="m-0 text-caption text-ink-muted">Aún no hay sillones. La agenda los usa para que no se encimen las citas.</p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {chairs.map((c) => (
              <li key={c.id} className="flex items-center gap-1 rounded-pill border border-border bg-surface py-1 pr-1 pl-3 text-ui">
                {c.name}
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Quitar ${c.name}`}
                    onClick={() => void run(() => onRemoveChair(c.id))}
                    className="flex size-7 items-center justify-center rounded-pill text-ink-muted hover:bg-lavender hover:text-ink"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form onSubmit={addChair} className="flex items-end gap-2">
            <div className="max-w-60 grow">
              <Input label={`Nuevo sillón en ${branch.name}`} placeholder={`Sillón ${chairs.length + 1}`} value={chairName} onChange={(e) => setChairName(e.target.value)} />
            </div>
            <Button type="submit" variant="secondary" loading={busy} disabled={!chairName.trim()}>
              Agregar sillón
            </Button>
          </form>
        )}
      </div>
    </Card>
  )
}

function NewBranchForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  if (!open) {
    return (
      <div>
        <Button variant="ghost" onClick={() => setOpen(true)}>
          + Agregar otra sucursal
        </Button>
      </div>
    )
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        void onAdd(name.trim()).then(() => {
          setName('')
          setOpen(false)
        })
      }}
    >
      <div className="max-w-80 grow">
        <Input label="Nombre de la nueva sucursal" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <Button type="submit" disabled={name.trim().length < 2}>
        Agregar sucursal
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  )
}
