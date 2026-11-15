import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { clearPendingSignup } from '@/lib/pendingSignup'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'
import { stableUser } from './stableUser'

/** Sesión de Supabase Auth (PKCE). Origen: core-base (Realt-In). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setUser((prev) => stableUser(prev, data.session?.user ?? null))
      setLoading(false)
    })

    // No llamar a otros métodos de Supabase dentro de este callback (recomendación
    // de supabase-js para evitar bloqueos); solo se actualiza estado.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      setSession(next)
      setUser((prev) => stableUser(prev, next?.user ?? null))
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Con el correo confirmado ya no hace falta recordar el registro pendiente.
  const confirmed = Boolean(user?.email_confirmed_at)
  useEffect(() => {
    if (confirmed) clearPendingSignup()
  }, [confirmed])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      recovery,
      clearRecovery: () => setRecovery(false),
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, user, loading, recovery],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
