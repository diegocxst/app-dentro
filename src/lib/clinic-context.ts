import { createContext, useContext } from 'react'
import type { ClinicIdentity } from './clinic-identity'

export const ClinicContext = createContext<ClinicIdentity | null>(null)

/** Identidad de la clínica activa. Solo dentro del panel (después de `RequireClinic`). */
export function useClinic(): ClinicIdentity {
  const ctx = useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic debe usarse dentro de <RequireClinic>')
  return ctx
}
