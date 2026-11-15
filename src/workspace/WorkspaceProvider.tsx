import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/auth-context'
import { signedLogoUrl, LOGO_URL_SECONDS } from '@/data/branding'
import { acceptMyInvitations } from '@/data/team'
import { fetchBranches, fetchIsPlatformAdmin, fetchMyMemberships, fetchMyProfile, type Branch } from '@/data/workspace'
import { prefs } from './preferences'
import { WorkspaceContext, type WorkspaceState, type WorkspaceValue } from './workspace-context'

async function loadWorkspace(userId: string): Promise<WorkspaceState> {
  // Primero, las invitaciones vigentes de su correo se vuelven membresías (E1-B5c).
  // Si falla, se sigue: la persona entra con lo que ya tenía.
  await acceptMyInvitations().catch(() => 0)
  try {
    const [profile, memberships, isPlatformAdmin] = await Promise.all([
      fetchMyProfile(userId),
      fetchMyMemberships(userId),
      fetchIsPlatformAdmin(),
    ])
    return { status: 'ready', profile, memberships, isPlatformAdmin }
  } catch {
    return { status: 'error', message: 'No pudimos cargar tu información. Revisa tu conexión y vuelve a intentarlo.' }
  }
}

/** Membresías, clínica activa y sucursal activa del usuario. Origen: core-base (Realt-In). */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<WorkspaceState>({ status: 'loading' })
  const [activeId, setActiveId] = useState<string | null>(prefs.activeTenant)
  const [branchState, setBranchState] = useState<{ tenantId: string; branches: Branch[] } | null>(null)
  const [branchPick, setBranchPick] = useState<Record<string, string>>({})

  // Depende del id (no del objeto `user`): renovar el token no recarga la clínica.
  const userId = user?.id
  const apply = useCallback((next: WorkspaceState) => {
    // Una recarga en segundo plano que falla conserva lo ya cargado.
    setState((prev) => (next.status === 'error' && prev.status === 'ready' ? prev : next))
  }, [])

  const load = useCallback(async () => {
    if (userId) apply(await loadWorkspace(userId))
  }, [userId, apply])

  useEffect(() => {
    if (!userId) return
    let current = true
    void loadWorkspace(userId).then((next) => {
      if (current) apply(next)
    })
    return () => {
      current = false
    }
  }, [userId, apply])

  const memberships = state.status === 'ready' ? state.memberships : []
  const active = memberships.find((m) => m.tenant_id === activeId) ?? memberships[0] ?? null
  const activeTenantId = active?.tenant_id ?? null
  // Una clínica cancelada no deja leer sus sucursales: no se piden.
  const canReadBranches = active !== null && active.tenant.status !== 'cancelled'

  useEffect(() => {
    if (!activeTenantId || !canReadBranches) return
    let current = true
    fetchBranches(activeTenantId).then(
      (branches) => {
        if (current) setBranchState({ tenantId: activeTenantId, branches })
      },
      () => {
        if (current) setBranchState({ tenantId: activeTenantId, branches: [] })
      },
    )
    return () => {
      current = false
    }
  }, [activeTenantId, canReadBranches])

  // Logo: URL firmada que se renueva antes de vencer.
  const logoPathActive = canReadBranches ? (active?.tenant.logo_path ?? null) : null
  const [logo, setLogo] = useState<{ path: string; url: string } | null>(null)
  useEffect(() => {
    if (!logoPathActive) return
    let current = true
    const sign = () =>
      void signedLogoUrl(logoPathActive).then((url) => {
        if (current) setLogo(url ? { path: logoPathActive, url } : null)
      })
    sign()
    const timer = window.setInterval(sign, (LOGO_URL_SECONDS - 300) * 1000)
    return () => {
      current = false
      window.clearInterval(timer)
    }
  }, [logoPathActive])
  const logoUrl = logo && logo.path === logoPathActive ? logo.url : null

  const value = useMemo<WorkspaceValue>(() => {
    const branches = branchState && branchState.tenantId === activeTenantId ? branchState.branches : []
    const wanted = activeTenantId ? (branchPick[activeTenantId] ?? prefs.activeBranch(activeTenantId)) : null
    const activeBranchId = branches.find((b) => b.id === wanted)?.id ?? branches[0]?.id ?? null
    return {
      state,
      active,
      setActiveTenant: (tenantId) => {
        prefs.setActiveTenant(tenantId)
        setActiveId(tenantId)
      },
      branches,
      activeBranchId,
      setActiveBranch: (branchId) => {
        if (!activeTenantId) return
        prefs.setActiveBranch(activeTenantId, branchId)
        setBranchPick((p) => ({ ...p, [activeTenantId]: branchId }))
      },
      logoUrl,
      refresh: load,
    }
  }, [state, active, activeTenantId, branchState, branchPick, logoUrl, load])

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>
}
