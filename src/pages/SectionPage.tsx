import { sectionById, type SectionId } from '@/app/navigation'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from './PageHeader'

/** Página vacía de una sección del menú. Sin datos de ejemplo: solo explica qué va aquí. */
export function SectionPage({ id }: { id: SectionId }) {
  const section = sectionById(id)
  return (
    <>
      <PageHeader title={section.label} />
      <EmptyState icon={section.icon} title={section.empty.title} description={section.empty.description} />
    </>
  )
}
