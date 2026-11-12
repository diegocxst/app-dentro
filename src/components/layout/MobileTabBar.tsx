import { NavLink } from 'react-router'
import { MOBILE_TAB_IDS, MORE_PATH, sectionById } from '@/app/navigation'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

const TABS: { label: string; path: string; icon: IconName }[] = [
  ...MOBILE_TAB_IDS.map((id) => {
    const s = sectionById(id)
    return { label: s.label, path: s.path, icon: s.icon }
  }),
  { label: 'Más', path: MORE_PATH, icon: 'mas' },
]

/** Barra inferior en móvil y tablet: Inicio · Agenda · Pacientes · Leads · Más. */
export function MobileTabBar() {
  return (
    <nav
      aria-label="Navegación"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface-raised px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul className="m-0 grid list-none grid-cols-5 p-0">
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
