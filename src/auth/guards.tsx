import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useAuth } from './auth-context'
import { safeNextPath } from './safeNextPath'

/** Solo usuarios con sesión. Redirige a /ingresar recordando a dónde quería ir. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/ingresar" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

/**
 * Solo visitantes sin sesión (ingresar, registro, recuperar). Al abrirse la sesión
 * (supabase-js avisa antes de que termine signInWithPassword) se respeta la sección
 * que la persona quería abrir.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading, recovery } = useAuth()
  const from = (useLocation().state as { from?: unknown } | null)?.from
  if (loading) return <FullPageSpinner />
  if (user && !recovery) return <Navigate to={safeNextPath(from)} replace />
  return <>{children}</>
}
