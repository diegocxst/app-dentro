import { useEffect, useId, useState, type ReactNode } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { fetchTreatments, saveTreatments, type TreatmentInput } from '@/data/catalog'
import { cn } from '@/lib/cn'
import { rpcErrorMessage } from '@/lib/errors'
import { categoryLabel, DURATION_OPTIONS, parsePrice, SUGGESTED_TREATMENTS, TREATMENT_CATEGORIES } from '@/lib/treatments'

type Row = {
  key: string
  id?: string
  name: string
  category: string
  price: string
  duration: string
  active: boolean
  /** Fila nueva escrita por la clínica (nombre y categoría editables). */
  custom: boolean
}

type Props = {
  tenantId: string
  canEdit: boolean
  submitLabel: string
  /** Se llama después de guardar con el número de tratamientos activos. */
  onSaved: (activeCount: number) => void
  /** Pie propio (p. ej. el del onboarding con «Atrás» y «Hacerlo después»). */
  footer?: (args: { save: () => void; saving: boolean }) => ReactNode
}

const fieldCls =
  'h-10 w-full rounded-sm border border-border bg-surface-raised px-3 text-ui text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-violet disabled:opacity-60'

/** Catálogo de tratamientos (mockup Onboarding paso 4). Sugerencias sin precio: la clínica pone los suyos. */
export function TreatmentsEditor({ tenantId, canEdit, submitLabel, onSaved, footer }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [filter, setFilter] = useState<string>('todos')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const baseId = useId()

  useEffect(() => {
    let current = true
    fetchTreatments(tenantId).then(
      (list) => {
        if (!current) return
        const existing: Row[] = list.map((t) => ({
          key: t.id,
          id: t.id,
          name: t.name,
          category: t.category,
          price: String(t.price_mxn),
          duration: t.duration_minutes ? String(t.duration_minutes) : '',
          active: t.is_active,
          custom: false,
        }))
        const taken = new Set(list.map((t) => t.name.trim().toLowerCase()))
        const suggested: Row[] = SUGGESTED_TREATMENTS.filter((s) => !taken.has(s.name.toLowerCase())).map((s, i) => ({
          key: `sug-${i}`,
          name: s.name,
          category: s.category,
          price: '',
          duration: s.duration ? String(s.duration) : '',
          active: false,
          custom: false,
        }))
        setRows([...existing, ...suggested])
      },
      () => current && setFormError('No pudimos cargar tus tratamientos. Revisa tu conexión.'),
    )
    return () => {
      current = false
    }
  }, [tenantId])

  const patch = (key: string, change: Partial<Row>) => {
    setRows((rs) => (rs ?? []).map((r) => (r.key === key ? { ...r, ...change } : r)))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)))
  }

  const addRow = () => {
    const key = `new-${Date.now()}`
    setRows((rs) => [...(rs ?? []), { key, name: '', category: filter === 'todos' ? 'otros' : filter, price: '', duration: '', active: true, custom: true }])
  }

  const save = async () => {
    if (!rows) return
    setFormError(null)
    const nextErrors: Record<string, string> = {}
    const items: TreatmentInput[] = []
    for (const r of rows) {
      if (!r.active && !r.id) continue // Sugerencias sin marcar: no se guardan.
      const price = parsePrice(r.price)
      if (r.name.trim().length < 2) nextErrors[r.key] = 'Escribe el nombre del tratamiento.'
      else if (price === null) nextErrors[r.key] = `Escribe el precio de ${r.name.trim()}.`
      if (nextErrors[r.key]) continue
      items.push({
        ...(r.id ? { id: r.id } : {}),
        category: r.category,
        name: r.name.trim(),
        price_mxn: price!,
        duration_minutes: r.duration ? Number(r.duration) : null,
        is_active: r.active,
      })
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Revisa los tratamientos marcados: falta su nombre o su precio.')
      return
    }
    setSaving(true)
    try {
      await saveTreatments(tenantId, items)
      onSaved(items.filter((i) => i.is_active).length)
    } catch (e) {
      setFormError(rpcErrorMessage(e as { code?: string }, { duplicate: 'Hay dos tratamientos con el mismo nombre.', invalid: 'Revisa la categoría y el precio.' }))
    } finally {
      setSaving(false)
    }
  }

  if (rows === null) {
    return formError ? <Alert tone="error">{formError}</Alert> : <Skeleton className="h-64 w-full" label="Cargando tratamientos" />
  }

  const visible = rows.filter((r) => filter === 'todos' || r.category === filter)

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Categorías" className="flex flex-wrap gap-2">
        {[{ id: 'todos', label: 'Todos' }, ...TREATMENT_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              'min-h-10 rounded-pill border px-4 text-ui font-medium',
              filter === c.id ? 'border-night-active bg-night-active text-on-night' : 'border-border bg-surface-raised text-ink hover:bg-lavender',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
        <div className="hidden grid-cols-[64px_1fr_160px_140px] gap-3 border-b border-border px-4 py-2.5 text-label text-ink-muted uppercase md:grid">
          <span>Activo</span>
          <span>Tratamiento</span>
          <span>Precio (MXN)</span>
          <span>Duración</span>
        </div>
        <ul className="m-0 list-none p-0">
          {visible.map((r) => {
            const err = errors[r.key]
            return (
              <li key={r.key} className="grid grid-cols-[40px_1fr] gap-x-3 gap-y-2 border-t border-border px-4 py-3 first:border-t-0 md:grid-cols-[64px_1fr_160px_140px] md:items-center">
                <label className="flex items-center md:justify-start">
                  <input
                    type="checkbox"
                    checked={r.active}
                    disabled={!canEdit}
                    aria-label={r.name || 'Tratamiento nuevo'}
                    onChange={(e) => patch(r.key, { active: e.target.checked })}
                    className="size-5 accent-violet"
                  />
                </label>
                <div className="flex min-w-0 flex-col gap-1">
                  {r.custom ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        aria-label="Nombre del tratamiento"
                        placeholder="Nombre del tratamiento"
                        value={r.name}
                        disabled={!canEdit}
                        onChange={(e) => patch(r.key, { name: e.target.value })}
                        className={cn(fieldCls, 'min-w-40 flex-1')}
                      />
                      <select
                        aria-label={`Categoría de ${r.name || 'tratamiento nuevo'}`}
                        value={r.category}
                        disabled={!canEdit}
                        onChange={(e) => patch(r.key, { category: e.target.value })}
                        className={cn(fieldCls, 'w-40')}
                      >
                        {TREATMENT_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <span className="text-ui font-semibold">{r.name}</span>
                      <span className="text-caption text-ink-muted">{categoryLabel(r.category)}</span>
                    </>
                  )}
                  {err && (
                    <span role="alert" className="text-caption text-error">
                      {err}
                    </span>
                  )}
                </div>
                <div className="col-start-2 md:col-start-auto">
                  <label className="sr-only" htmlFor={`${baseId}-p-${r.key}`}>
                    Precio de {r.name || 'tratamiento nuevo'}
                  </label>
                  <input
                    id={`${baseId}-p-${r.key}`}
                    inputMode="decimal"
                    placeholder="$0"
                    value={r.price}
                    disabled={!canEdit}
                    aria-invalid={err ? true : undefined}
                    onChange={(e) => patch(r.key, { price: e.target.value, active: e.target.value ? true : r.active })}
                    className={cn(fieldCls, 'tabular', err && 'border-error')}
                  />
                </div>
                <div className="col-start-2 md:col-start-auto">
                  <label className="sr-only" htmlFor={`${baseId}-d-${r.key}`}>
                    Duración de {r.name || 'tratamiento nuevo'}
                  </label>
                  <select
                    id={`${baseId}-d-${r.key}`}
                    value={r.duration}
                    disabled={!canEdit}
                    onChange={(e) => patch(r.key, { duration: e.target.value })}
                    className={fieldCls}
                  >
                    {DURATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            )
          })}
        </ul>
        {canEdit && (
          <button
            type="button"
            onClick={addRow}
            className="flex min-h-12 w-full items-center gap-2 border-t border-border px-4 text-ui font-semibold text-violet hover:bg-lavender"
          >
            + Agregar otro tratamiento
          </button>
        )}
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}
      {canEdit &&
        (footer ? (
          footer({ save: () => void save(), saving })
        ) : (
          <div className="flex justify-end">
            <Button size="lg" loading={saving} onClick={() => void save()}>
              {submitLabel}
            </Button>
          </div>
        ))}
    </div>
  )
}
