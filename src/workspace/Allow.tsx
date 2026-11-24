import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import type { TenantRole } from '@/lib/db'
import { useWorkspace } from './workspace-context'

/** Muestra la pantalla solo si el rol activo la puede ver; si no, lleva a `to` (Inicio por omisión). */
export function Allow({ when, to = '/', children }: { when: (role: TenantRole | undefined) => boolean; to?: string; children: ReactNode }) {
  const { active } = useWorkspace()
  if (!active) return null
  return when(active.role) ? <>{children}</> : <Navigate to={to} replace />
}
