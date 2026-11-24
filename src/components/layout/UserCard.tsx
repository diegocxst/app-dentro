import { useAuth } from '@/auth/auth-context'
import { memberName } from '@/lib/doctors'
import { ROLE_LABEL } from '@/lib/roles'
import { useWorkspace } from '@/workspace/workspace-context'

/**
 * Quién está usando la app (Ajustes-D): su nombre en la clínica, su rol y el correo
 * con el que entra. La dueña o el dueño ven su título (p. ej. «Propietario»).
 */
export function UserCard() {
  const { user } = useAuth()
  const { state, active } = useWorkspace()
  if (!active) return null
  const account = state.status === 'ready' ? (state.profile?.full_name ?? '') : ''
  const name = memberName(active.display_name ?? '', account) || user?.email || ''
  const role = active.role === 'owner' ? active.tenant.owner_title || ROLE_LABEL.owner : ROLE_LABEL[active.role]
  return (
    <section aria-label="Tu cuenta" className="flex min-w-0 flex-col gap-1 rounded-nav bg-night-raised px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-caption font-semibold text-on-night">{name}</span>
        <span className="shrink-0 rounded-pill bg-night-active px-2 py-0.5 text-micro font-semibold text-on-night">{role}</span>
      </span>
      {user?.email && <span className="truncate text-micro text-on-night-muted">{user.email}</span>}
    </section>
  )
}
