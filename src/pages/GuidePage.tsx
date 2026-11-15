import { GuideCard } from '@/components/onboarding/GuideCard'
import { PageHeader } from './PageHeader'

export function GuidePage() {
  return (
    <>
      <PageHeader eyebrow="Tu primer día en dentro" title="Guía de inicio" />
      <GuideCard />
    </>
  )
}
