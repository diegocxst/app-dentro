import { NavLink } from 'react-router'
import { canSeeCommissions, canSeeReports, isTreating } from '@/lib/access'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/workspace/workspace-context'

/**
 * Submenú de «Tu equipo»: Tu equipo · Doctores · Comisiones · Reportes.
 * Los doctores no ven la lista de Doctores; recepción no ve Comisiones; Reportes, solo la dueña o el dueño.
 */
export function TeamTabs() {
  const { active } = useWorkspace()
  const role = active?.role
  const tabs = [
    { to: '/equipo', label: 'Tu equipo', end: true },
    ...(isTreating(role) ? [] : [{ to: '/doctores', label: 'Doctores', end: true }]),
    ...(canSeeCommissions(role) ? [{ to: '/doctores/comisiones', label: 'Comisiones', end: false }] : []),
    ...(canSeeReports(role) ? [{ to: '/doctores/reportes', label: 'Reportes', end: true }] : []),
  ]
  return (
    <nav aria-label="Secciones de tu equipo" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn('-mb-px flex min-h-11 shrink-0 items-center border-b-2 px-3 text-ui font-semibold', isActive ? 'border-violet text-violet' : 'border-transparent text-ink-muted hover:text-ink')
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
