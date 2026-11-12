import { Link } from 'react-router'
import { GUIDE_PATH, MOBILE_TAB_IDS, SECTIONS } from '@/app/navigation'
import { Icon } from '@/components/ui/Icon'
import { useClinic } from '@/lib/clinic-context'
import { cn } from '@/lib/cn'
import { PageHeader } from './PageHeader'

/** "Más" en móvil: las secciones que no caben en la barra inferior. */
export function MorePage() {
  const clinic = useClinic()
  const rest = SECTIONS.filter((s) => !MOBILE_TAB_IDS.includes(s.id))
  return (
    <>
      <PageHeader title="Más" />
      <nav aria-label="Más secciones">
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-border bg-surface-raised p-0">
          {rest.map((s, i) => (
            <li key={s.id} className={cn(i > 0 && 'border-t border-border')}>
              <Link to={s.path} className={cn('flex min-h-13 items-center gap-3 px-4 text-ui font-medium no-underline', s.id === 'crece' ? 'text-orange-text' : 'text-ink')}>
                <Icon name={s.icon} className={s.id === 'crece' ? 'text-orange-text' : 'text-violet'} />
                <span className="grow">{s.label}</span>
                <Icon name="chevronRight" size={18} className="text-ink-muted" />
              </Link>
            </li>
          ))}
          <li className="border-t border-border">
            <Link to={GUIDE_PATH} className="flex min-h-13 items-center gap-3 px-4 text-ui font-medium text-ink no-underline">
              <Icon name="ayuda" className="text-turquoise-text" />
              <span className="grow">Guía de inicio</span>
              <span className="text-label text-ink-muted tabular">
                {clinic.guide.done}/{clinic.guide.total}
              </span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="mt-8 flex items-center justify-center gap-2">
        <span className="text-micro text-ink-muted">Hecho con</span>
        <img src="/brand/dentro-horizontal-color.svg" alt="dentro" width={72} height={22} className="block h-auto w-18" />
      </div>
    </>
  )
}
