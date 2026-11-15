import { useMemo, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { BrandLogo } from '@/brand/BrandLogo'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { ClinicContext } from '@/lib/clinic-context'
import { identityFromTenant } from '@/lib/clinic-identity'
import { useWorkspace } from './workspace-context'

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 text-ink">
      <div className="flex w-full max-w-md flex-col gap-6">
        <BrandLogo width={128} />
        {children}
      </div>
    </div>
  )
}

/**
 * Panel de la clínica: exige una clínica activa. Sin clínica → alta (/bienvenida).
 * Clínica cancelada → aviso, sin acceso a los datos (la RLS tampoco los entrega).
 */
export function RequireClinic({ children }: { children: ReactNode }) {
  const { state, active, refresh } = useWorkspace()
  const tenant = active?.tenant ?? null
  const identity = useMemo(() => (tenant ? identityFromTenant(tenant) : null), [tenant])

  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'error') {
    return (
      <CenteredMessage>
        <Alert tone="error" title="No pudimos cargar tu clínica">
          {state.message}
        </Alert>
        <Button block size="lg" onClick={() => void refresh()}>
          Volver a intentar
        </Button>
      </CenteredMessage>
    )
  }
  if (!tenant || !identity) return <Navigate to="/bienvenida" replace />

  if (tenant.status === 'cancelled') {
    return (
      <CenteredMessage>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-title">{tenant.display_name}</h1>
          <p className="m-0 text-body text-ink-muted">
            Esta cuenta está cancelada. Tus datos se conservan, pero por ahora no puedes consultarlos. Escríbenos a soporte para
            reactivarla.
          </p>
        </div>
        <SignOutButton className="justify-center border border-border bg-surface-raised" />
      </CenteredMessage>
    )
  }

  return <ClinicContext value={identity}>{children}</ClinicContext>
}
