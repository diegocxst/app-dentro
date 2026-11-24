import { NavLink } from 'react-router'
import { GUIDE_PATH } from '@/app/navigation'
import { useAuth } from '@/auth/auth-context'
import { canSeeGuide, menuFor } from '@/lib/access'
import { memberName } from '@/lib/doctors'
import { roleTag, withTitle } from '@/lib/identity'
import { Icon } from '@/components/ui/Icon'
import { useClinic } from '@/lib/clinic-context'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/workspace/workspace-context'
import { ClinicAvatar } from './ClinicAvatar'
import { SignOutButton } from './SignOutButton'

/** Menú lateral (fondo `night`). Réplica de `Menu.dc.html`. En móvil se abre como panel desde ☰. */
export function Sidebar({ label = 'Menú principal' }: { label?: string }) {
  const clinic = useClinic()
  const { user } = useAuth()
  const { state, active } = useWorkspace()
  const role = active?.role
  // Quién entra: «Dra. Ana Ruiz · Doctor/a» bajo el logo; su correo, bajo «Cerrar sesión» (Ajustes-D).
  const me = active
    ? {
        line: [
          withTitle(state.status === 'ready' ? (state.profile?.title ?? '') : '', memberName(active.display_name ?? '', state.status === 'ready' ? (state.profile?.full_name ?? '') : '')),
          roleTag(active.role, active.tenant.owner_title),
        ]
          .filter(Boolean)
          .join(' · '),
        email: user?.email ?? '',
      }
    : null
  return (
    <nav
      aria-label={label}
      data-tour="menu"
      className="sticky top-0 flex h-dvh w-62 shrink-0 flex-col gap-6 overflow-y-auto bg-night px-4 py-6 text-on-night"
    >
      <div className="flex flex-col gap-3 border-b border-night-border px-2 pt-1 pb-4">
        <ClinicAvatar />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-[17px] leading-[22px] font-bold break-words">{clinic.displayName}</span>
          <span className="text-caption text-on-night-muted">{me ? me.line : clinic.ownerLine}</span>
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {menuFor(role).map((s) => (
          <li key={s.id}>
            <NavLink
              to={s.path}
              end={s.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-nav px-3 text-ui font-medium no-underline transition-colors',
                  isActive
                    ? 'bg-night-active text-on-night'
                    : cn(s.id === 'crece' ? 'text-on-night-growth' : 'text-on-night-muted', 'hover:bg-night-raised hover:text-on-night'),
                )
              }
            >
              <Icon name={s.icon} />
              <span className="grow">{s.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="grow" />

      {canSeeGuide(role) && (
      <NavLink
        to={GUIDE_PATH}
        data-tour="guia"
        className={({ isActive }) =>
          cn(
            'flex min-h-11 items-center gap-2.5 rounded-nav px-3 text-caption font-semibold text-on-night no-underline',
            isActive ? 'bg-night-active' : 'bg-night-raised hover:bg-night-active',
          )
        }
      >
        <Icon name="ayuda" size={18} className="text-turquoise" />
        <span className="grow">Guía de inicio</span>
        <span className="text-label font-normal text-on-night-muted tabular" aria-label={`${clinic.guide.done} de ${clinic.guide.total} listos`}>
          {clinic.guide.done}/{clinic.guide.total}
        </span>
      </NavLink>
      )}

      <div className="-my-3 flex flex-col">
        <SignOutButton tone="night" />
        {me?.email && <span className="truncate px-3 pb-1 text-micro text-on-night-muted">{me.email}</span>}
      </div>

      <div className="flex items-center gap-2 border-t border-night-border px-2 pt-3">
        <span className="text-micro text-on-night-muted">Hecho con</span>
        <img src="/brand/dentro-horizontal-negativo.svg" alt="dentro" width={72} height={22} className="block h-auto w-18" />
      </div>
    </nav>
  )
}
