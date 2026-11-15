import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { vi } from 'vitest'

// Supabase simulado para las pruebas (sin red). Se instala en src/test/setup.ts.

type Listener = (event: AuthChangeEvent, session: Session | null) => void
const listeners = new Set<Listener>()
let current: Session | null = null

export function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    email: 'duena@example.test',
    email_confirmed_at: '2026-11-15T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-11-15T00:00:00Z',
    updated_at: '2026-11-15T00:00:00Z',
    ...overrides,
  } as User
}

export function fakeSession(user: User = fakeUser()): Session {
  return { access_token: 'x', refresh_token: 'y', expires_in: 3600, token_type: 'bearer', user } as Session
}

const ok = <T>(data: T) => Promise.resolve({ data, error: null })

export const fakeSupabase = {
  auth: {
    getSession: vi.fn(() => ok({ session: current })),
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb)
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    }),
    initialize: vi.fn(() => Promise.resolve({ error: null })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(() => ok({})),
    updateUser: vi.fn(),
    verifyOtp: vi.fn(),
    resend: vi.fn(() => ok({ user: null, session: null })),
    signOut: vi.fn(() => {
      emitAuth('SIGNED_OUT', null)
      return Promise.resolve({ error: null })
    }),
  },
  rpc: vi.fn(() => ok(null)),
}

/** Cambia la sesión y avisa a los suscriptores, como haría supabase-js. */
export function emitAuth(event: AuthChangeEvent, session: Session | null) {
  current = session
  for (const l of listeners) l(event, session)
}

/** Sesión inicial (la que devuelve getSession al montar la app). */
export function setInitialSession(session: Session | null) {
  current = session
}

export function resetFakeSupabase() {
  current = null
  listeners.clear()
  for (const group of [fakeSupabase.auth, fakeSupabase]) {
    for (const fn of Object.values(group)) if (vi.isMockFunction(fn)) fn.mockClear()
  }
  fakeSupabase.auth.signInWithPassword.mockReset()
  fakeSupabase.auth.signUp.mockReset()
  fakeSupabase.auth.updateUser.mockReset()
  fakeSupabase.auth.verifyOtp.mockReset()
}
