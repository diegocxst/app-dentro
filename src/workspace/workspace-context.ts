import { createContext, useContext } from 'react'
import type { Branch, MyMembership, Profile } from '@/data/workspace'

export type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: Profile | null; memberships: MyMembership[]; isPlatformAdmin: boolean }

export type WorkspaceValue = {
  state: WorkspaceState
  /** Membresía (y clínica) activa; `null` si la persona aún no tiene clínica. */
  active: MyMembership | null
  setActiveTenant: (tenantId: string) => void
  /** Sucursales activas de la clínica activa. */
  branches: Branch[]
  activeBranchId: string | null
  setActiveBranch: (branchId: string) => void
  /** URL firmada del logo de la clínica activa (o `null`). */
  logoUrl: string | null
  refresh: () => Promise<void>
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace debe usarse dentro de <WorkspaceProvider>')
  return ctx
}
