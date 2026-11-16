import { Link } from 'react-router'
import { BrandLogo } from '@/brand/BrandLogo'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { isChunkLoadError } from './chunk-error'

/**
 * Pantalla amable cuando algo falla al mostrar una pantalla. Nunca muestra rutas,
 * trazas ni mensajes técnicos. «Volver a intentar» recarga: el navegador recuerda
 * el fallo de un módulo, así que reintentar sin recargar volvería a fallar.
 * Origen: core-base (Realt-In).
 */
export function LoadErrorScreen({
  error,
  compact = false,
  onRetry = () => window.location.reload(),
}: {
  error: unknown
  /** Dentro del panel (el menú sigue visible). */
  compact?: boolean
  onRetry?: () => void
}) {
  const chunk = isChunkLoadError(error)
  return (
    <div role="alert" className={cn('mx-auto flex max-w-md flex-col items-center gap-4 px-4 text-center', compact ? 'py-16' : 'min-h-dvh justify-center bg-surface')}>
      {!compact && <BrandLogo width={120} />}
      <span className="flex size-14 items-center justify-center rounded-lg bg-lavender text-violet">
        <Icon name={chunk ? 'sinConexion' : 'refresh'} size={26} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-subtitle text-ink">{chunk ? 'No pudimos cargar esta sección' : 'Algo salió mal al mostrar esta pantalla'}</h1>
        <p className="m-0 text-ui text-ink-muted">
          {chunk
            ? 'Revisa tu conexión y vuelve a intentarlo. Si dentro se acaba de actualizar, al reintentar se carga la versión nueva.'
            : 'Vuelve a intentarlo. Si sigue pasando, escríbenos y cuéntanos qué estabas haciendo.'}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button size="lg" leadingIcon={<Icon name="refresh" size={18} />} onClick={onRetry}>
          Volver a intentar
        </Button>
        <Link to="/" reloadDocument className={buttonClasses('secondary', 'lg')}>
          Ir a Inicio
        </Link>
      </div>
    </div>
  )
}
