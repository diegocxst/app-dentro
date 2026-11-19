import { useState } from 'react'
import { useLocation } from 'react-router'

/** Aviso que deja la pantalla anterior al navegar (p. ej. «Registramos el pago R-0001…»). */
export function useFlashNotice(): string | null {
  const location = useLocation()
  const [notice] = useState(() => (location.state as { notice?: string } | null)?.notice ?? null)
  return notice
}
