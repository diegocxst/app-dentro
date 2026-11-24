import { NavLink } from 'react-router'
import { sectionById } from '@/app/navigation'
import { Icon } from '@/components/ui/Icon'
import { mobileTabsFor } from '@/lib/access'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/workspace/workspace-context'

/** Barra inferior en móvil y tablet: Inicio · Agenda · Pacientes · Leads o Presupuestos (el resto, en el menú ☰). */
export function MobileTabBar() {
  const role = useWorkspace().active?.role
  const TABS = mobileTabsFor(role).map((id) => sectionById(id))
  return (
    <nav
      aria-label="Navegación"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface-raised px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul className="m-0 grid list-none grid-cols-4 p-0">
        {TABS.map((t) => (
          <li key={t.path}>
            <NavLink
              to={t.path}
              end={t.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-12 flex-col items-center justify-center gap-1 text-micro font-semibold no-underline',
                  isActive ? 'text-violet' : 'text-ink-muted',
                )
              }
            >
              <Icon name={t.icon} size={22} />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
