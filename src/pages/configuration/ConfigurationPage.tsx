import { Link } from 'react-router'
import { sectionById } from '@/app/navigation'
import { Icon, type IconName } from '@/components/ui/Icon'
import { canSeeConfig, type ConfigArea } from '@/lib/access'
import { isManager } from '@/lib/roles'
import { useWorkspace } from '@/workspace/workspace-context'
import { PageHeader } from '@/pages/PageHeader'

const LINKS: { area: ConfigArea; to: string; title: string; text: string; icon: IconName }[] = [
  { area: 'identidad', to: '/configuracion/identidad', title: 'Identidad de tu clínica', text: 'Nombre, logo, color, responsable y WhatsApp.', icon: 'inicio' },
  { area: 'sucursales', to: '/configuracion/sucursales', title: 'Sucursales y unidades dentales', text: 'Dónde atiendes, en qué horario y con cuántas unidades dentales.', icon: 'sucursal' },
  { area: 'tratamientos', to: '/configuracion/tratamientos', title: 'Tratamientos y precios', text: 'Tu catálogo para armar presupuestos en segundos.', icon: 'presupuestos' },
  { area: 'perfil', to: '/configuracion/perfil', title: 'Mi perfil', text: 'Tu nombre y tu teléfono.', icon: 'pacientes' },
]

/** Configuración (M10 · P31–P33). Integraciones y perfil público (P34) llegan con E6. */
export function ConfigurationPage() {
  const section = sectionById('configuracion')
  const role = useWorkspace().active?.role
  const manager = isManager(role)
  const links = LINKS.filter((l) => canSeeConfig(role, l.area))
  return (
    <>
      <PageHeader title={section.label} />
      <div className="flex flex-col gap-6">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="flex min-h-16 items-center gap-4 rounded-lg border border-border bg-surface-raised p-4 text-ink no-underline hover:border-violet"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-lavender text-violet">
                  <Icon name={l.icon} />
                </span>
                <span className="flex grow flex-col gap-0.5">
                  <span className="text-ui font-semibold">{l.title}</span>
                  <span className="text-caption text-ink-muted">{l.text}</span>
                </span>
                <Icon name="chevronRight" size={18} className="text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
        {manager && <p className="m-0 text-caption text-ink-muted">Integraciones (Meta) y tu perfil público llegan muy pronto.</p>}
      </div>
    </>
  )
}
