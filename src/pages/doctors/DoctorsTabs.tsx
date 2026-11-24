import { NavLink } from 'react-router'
import { canSeeCommissions, isTreating } from '@/lib/access'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/workspace/workspace-context'

/** Pestañas de la sección Doctores. Comisiones: gerencia y doctores (recepción no). Un doctor solo ve sus comisiones: sin pestañas. */
export function DoctorsTabs() {
  const { active } = useWorkspace()
  const role = active?.role
  if (isTreating(role)) return null
  const seesCommissions = canSeeCommissions(role)
  const tabs = [{ to: '/doctores', label: 'Equipo', end: true }, ...(seesCommissions ? [{ to: '/doctores/comisiones', label: 'Comisiones', end: false }] : [])]
  return (
    <nav aria-label="Secciones de doctores" className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn('-mb-px flex min-h-11 items-center border-b-2 px-3 text-ui font-semibold', isActive ? 'border-violet text-violet' : 'border-transparent text-ink-muted hover:text-ink')
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
