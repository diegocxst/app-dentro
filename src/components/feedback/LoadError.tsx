import { Alert } from '@/components/ui/Alert'

/** Error al cargar datos de una sección, con «Volver a intentar». */
export function LoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <Alert tone="error" title={title}>
      Revisa tu conexión.{' '}
      <button type="button" className="min-h-11 font-semibold underline underline-offset-2" onClick={onRetry}>
        Volver a intentar
      </button>
    </Alert>
  )
}
