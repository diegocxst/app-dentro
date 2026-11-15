import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  /** true mientras se recupera la sesión guardada al cargar la app. */
  loading: boolean
  /** true cuando la sesión viene de un enlace de recuperación de contraseña. */
  recovery: boolean
  clearRecovery: () => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
