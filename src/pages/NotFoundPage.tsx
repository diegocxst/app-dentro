import { Link } from 'react-router'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'

export function NotFoundPage() {
  return (
    <EmptyState
      headingLevel="h1"
      title="No encontramos esta página"
      description="Puede que el enlace esté mal escrito o que la sección ya no exista."
      action={
        <Link to="/" className={buttonClasses('primary')}>
          Volver al inicio
        </Link>
      }
    />
  )
}
