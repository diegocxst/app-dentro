import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from './PageHeader'

export function GuidePage() {
  return (
    <>
      <PageHeader eyebrow="Tu primer día en dentro" title="Guía de inicio" />
      <EmptyState
        icon="ayuda"
        title="Siete pasos para dejar lista tu clínica"
        description="Identidad, sucursales, equipo, tratamientos, WhatsApp, tu primer paciente y tu primer presupuesto. Marca cada paso cuando lo termines."
      />
    </>
  )
}
