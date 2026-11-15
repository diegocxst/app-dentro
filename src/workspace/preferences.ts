// Preferencias de interfaz en este dispositivo: solo ids, nunca datos de la clínica.
// Son solo una preferencia: la RLS vuelve a filtrar cada consulta.

const TENANT_KEY = 'dentro.activeTenantId'
const branchKey = (tenantId: string) => `dentro.activeBranchId.${tenantId}`

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Sin almacenamiento (modo privado): solo se pierde la preferencia.
  }
}

export const prefs = {
  activeTenant: () => read(TENANT_KEY),
  setActiveTenant: (id: string) => write(TENANT_KEY, id),
  activeBranch: (tenantId: string) => read(branchKey(tenantId)),
  setActiveBranch: (tenantId: string, id: string) => write(branchKey(tenantId), id),
}
