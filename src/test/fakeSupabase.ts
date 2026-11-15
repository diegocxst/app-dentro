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
  from: vi.fn((table: string) => query(table)),
  rpc: vi.fn((fn: string, args: Record<string, unknown> = {}) => rpcHandler(fn, args)),
}

// ── Base en memoria (solo lo que usa la app; la RLS real se prueba en npm run test:db) ──
type Row = Record<string, unknown>
type Db = { tenants: Row[]; memberships: Row[]; profiles: Row[]; branches: Row[] }
export const fakeDb: Db = { tenants: [], memberships: [], profiles: [], branches: [] }

export const TENANT_ID = '10000000-0000-4000-8000-000000000001'
export const BRANCH_ID = '20000000-0000-4000-8000-000000000001'

export function fakeTenant(overrides: Row = {}): Row {
  return {
    id: TENANT_ID,
    kind: 'clinic',
    display_name: 'Clínica Prueba',
    slug: 'clinica-prueba',
    status: 'active',
    owner_display_name: 'Dra. Prueba',
    owner_title: 'Propietaria',
    logo_path: null,
    brand_color: '#0E5E8A',
    onboarding_state: {},
    created_by: null,
    created_at: '2026-11-15T00:00:00Z',
    updated_at: '2026-11-15T00:00:00Z',
    ...overrides,
  }
}

/** Siembra una clínica con la persona de la sesión como dueña y una sucursal. */
export function seedClinic(tenant: Row = fakeTenant(), userId = fakeUser().id) {
  fakeDb.tenants.push(tenant)
  fakeDb.memberships.push({ id: `m-${String(tenant.id)}`, tenant_id: tenant.id, user_id: userId, role: 'owner', status: 'active', created_at: '2026-11-15T00:00:00Z' })
  fakeDb.branches.push({ id: tenant.id === TENANT_ID ? BRANCH_ID : `b-${String(tenant.id)}`, tenant_id: tenant.id, name: 'Sucursal principal', address: '', is_active: true })
}

function query(table: string) {
  const filters: [string, unknown][] = []
  let single = false
  const run = () => {
    let rows = ((fakeDb as Record<string, Row[] | undefined>)[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v))
    if (table === 'memberships') rows = rows.map((m) => ({ ...m, tenant: fakeDb.tenants.find((t) => t.id === m.tenant_id) ?? null }))
    return Promise.resolve(single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null })
  }
  const builder = {
    select: () => builder,
    eq: (k: string, v: unknown) => {
      filters.push([k, v])
      return builder
    },
    order: () => builder,
    maybeSingle: () => {
      single = true
      return run()
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => run().then(resolve, reject),
  }
  return builder
}

type RpcResult = Promise<{ data: unknown; error: { code: string; message: string } | null }>
export const rpcOverrides: Record<string, (args: Record<string, unknown>) => RpcResult> = {}

function rpcHandler(fn: string, args: Record<string, unknown>): RpcResult {
  const override = rpcOverrides[fn]
  if (override) return override(args)
  if (fn === 'am_i_platform_admin') return Promise.resolve({ data: false, error: null })
  if (fn === 'create_tenant') {
    const tenant = fakeTenant({
      id: '10000000-0000-4000-8000-0000000000ff',
      display_name: args.p_display_name,
      kind: args.p_kind,
      slug: args.p_slug,
      owner_display_name: args.p_owner_display_name,
      owner_title: args.p_owner_title,
      brand_color: args.p_brand_color,
    })
    seedClinic(tenant)
    return Promise.resolve({ data: tenant, error: null })
  }
  return Promise.resolve({ data: null, error: null })
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
  for (const k of Object.keys(fakeDb) as (keyof Db)[]) fakeDb[k] = []
  for (const k of Object.keys(rpcOverrides)) delete rpcOverrides[k]
}
