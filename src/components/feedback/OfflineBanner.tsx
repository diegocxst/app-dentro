import { Icon } from '@/components/ui/Icon'
import { useOnline } from '@/hooks/useOnline'

/** Aviso fijo mientras no hay conexión. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-md bg-warning-soft px-4 py-3 text-ui text-warning">
      <Icon name="sinConexion" size={18} />
      <span>Sin conexión. Lo que hagas no se guardará hasta que vuelvas a tener internet.</span>
    </div>
  )
}
