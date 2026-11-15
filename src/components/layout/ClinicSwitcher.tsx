import { useId } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useWorkspace } from '@/workspace/workspace-context'

/** Selector de clínica: solo aparece si la persona trabaja en más de una (p. ej. doctor colaborador). */
export function ClinicSwitcher() {
  const { state, active, setActiveTenant } = useWorkspace()
  const id = useId()
  const memberships = state.status === 'ready' ? state.memberships : []
  if (memberships.length < 2 || !active) return null
  return (
    <div className="relative flex h-10 shrink-0 items-center rounded-md border border-border bg-surface-raised text-ui font-medium text-ink">
      <label htmlFor={id} className="sr-only">
        Clínica
      </label>
      <select
        id={id}
        value={active.tenant_id}
        onChange={(e) => setActiveTenant(e.target.value)}
        className="h-full max-w-56 cursor-pointer appearance-none truncate rounded-md border-0 bg-transparent pr-9 pl-3 outline-none"
      >
        {memberships.map((m) => (
          <option key={m.tenant_id} value={m.tenant_id}>
            {m.tenant.display_name}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={16} strokeWidth={2} className="pointer-events-none absolute right-3 text-ink-muted" />
    </div>
  )
}
