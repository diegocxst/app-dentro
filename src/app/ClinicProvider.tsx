import { useMemo, type ReactNode } from 'react'
import { resolveClinicIdentity, TEMP_CLINIC_CONFIG, type ClinicConfig } from '@/lib/clinic-config'
import { ClinicContext } from '@/lib/clinic-context'

export function ClinicProvider({ config = TEMP_CLINIC_CONFIG, children }: { config?: ClinicConfig; children: ReactNode }) {
  const identity = useMemo(() => resolveClinicIdentity(config), [config])
  return <ClinicContext value={identity}>{children}</ClinicContext>
}
