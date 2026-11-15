import { Link } from 'react-router'
import { sectionById } from '@/app/navigation'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/pages/PageHeader'

/** Configuración (M10). Por ahora solo «Tu equipo»; el resto llega en E3. */
export function ConfigurationPage() {
  const section = sectionById('configuracion')
  return (
    <>
      <PageHeader title={section.label} />
      <div className="flex flex-col gap-6">
        <Link
          to="/configuracion/equipo"
          className="flex min-h-16 items-center gap-4 rounded-lg border border-border bg-surface-raised p-4 text-ink no-underline hover:border-violet"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-lavender text-violet">
            <Icon name="doctores" />
          </span>
          <span className="flex grow flex-col gap-0.5">
            <span className="text-ui font-semibold">Tu equipo</span>
            <span className="text-caption text-ink-muted">Invita a doctores y recepción, y decide qué puede hacer cada quien.</span>
          </span>
          <Icon name="chevronRight" size={18} className="text-ink-muted" />
        </Link>
        <EmptyState icon={section.icon} title={section.empty.title} description="Identidad, sucursales, sillones, tratamientos y precios llegan muy pronto." />
      </div>
    </>
  )
}
