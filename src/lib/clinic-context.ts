import { createContext, useContext } from 'react'
import { resolveClinicIdentity, TEMP_CLINIC_CONFIG, type ClinicIdentity } from './clinic-config'

export const ClinicContext = createContext<ClinicIdentity>(resolveClinicIdentity(TEMP_CLINIC_CONFIG))

export function useClinic(): ClinicIdentity {
  return useContext(ClinicContext)
}
