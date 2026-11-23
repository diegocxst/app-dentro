import { Link } from 'react-router'
import { sectionById } from '@/app/navigation'
import { Icon, type IconName } from '@/components/ui/Icon'
import { PageHeader } from '@/pages/PageHeader'

const LINKS: { to: string; title: string; text: string; icon: IconName }[] = [
  { to: '/configuracion/identidad', title: 'Identidad de tu clínica', text: 'Nombre, logo, color, responsable y WhatsApp.', icon: 'inicio' },
  { to: '/configuracion/equipo', title: 'Tu equipo', text: 'Invita a doctores y recepción, y decide qué puede hacer cada quien.', icon: 'doctores' },
  { to: '/configuracion/sucursales', title: 'Sucursales y unidades dentales', text: 'Dónde atiendes, en qué horario y con cuántas unidades dentales.', icon: 'sucursal' },
  { to: '/configuracion/tratamientos', title: 'Tratamientos y precios', text: 'Tu catálogo para armar presupuestos en segundos.', icon: 'presupuestos' },
  { to: '/configuracion/perfil', title: 'Mi perfil', text: 'Tu nombre y tu teléfono.', icon: 'pacientes' },
]

/** Configuración (M10 · P31–P33). Integraciones y perfil público (P34) llegan con E6. */
export function ConfigurationPage() {
  const section = sectionById('configuracion')
  return (
    <>
      <PageHeader title={section.label} />
      <div className="flex flex-col gap-6">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {LINKS.map((l) => (
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
        <p className="m-0 text-caption text-ink-muted">Integraciones (Meta) y tu perfil público llegan muy pronto.</p>
      </div>
    </>
  )
}
