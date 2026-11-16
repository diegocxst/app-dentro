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
    updateUser: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    verifyOtp: vi.fn(),
    resend: vi.fn(() => ok({ user: null, session: null })),
    signOut: vi.fn(() => {
      emitAuth('SIGNED_OUT', null)
      return Promise.resolve({ error: null })
    }),
  },
  from: vi.fn((table: string) => query(table)),
  functions: {
    invoke: vi.fn((name: string, { body }: { body: Record<string, unknown> }) => functionHandler(name, body)),
  },
  storage: {
    from: vi.fn((bucket: string) => ({
      upload: vi.fn((path: string, file: File) => {
        fakeStorage.push({ bucket, path, type: file.type })
        return Promise.resolve({ data: { path }, error: null })
      }),
      remove: vi.fn((paths: string[]) => {
        fakeStorage.splice(0, fakeStorage.length, ...fakeStorage.filter((o) => !paths.includes(o.path)))
        return Promise.resolve({ data: [], error: null })
      }),
      createSignedUrl: vi.fn((path: string) => Promise.resolve({ data: { signedUrl: `https://storage.test/${bucket}/${path}?token=firmado` }, error: null })),
    })),
  },
  rpc: vi.fn((fn: string, args: Record<string, unknown> = {}) => rpcHandler(fn, args)),
}

// ── Base en memoria (solo lo que usa la app; la RLS real se prueba en npm run test:db) ──
type Row = Record<string, unknown>
type Db = { tenants: Row[]; memberships: Row[]; profiles: Row[]; branches: Row[]; privacy_notices: Row[]; account_consents: Row[]; invitations: Row[]; chairs: Row[]; treatments: Row[]; patients: Row[]; patient_notes: Row[]; patient_access_log: Row[]; patient_documents: Row[]; document_access_log: Row[] }
export const fakeStorage: { bucket: string; path: string; type: string }[] = []
export const fakeDb: Db = { tenants: [], memberships: [], profiles: [], branches: [], privacy_notices: [], account_consents: [], invitations: [], chairs: [], treatments: [], patients: [], patient_notes: [], patient_access_log: [], patient_documents: [], document_access_log: [] }

export const NOTICE_ID = '30000000-0000-4000-8000-000000000001'
export const NOTICE_VERSION = 'borrador-2026-11-15'

/** Aviso vigente y, si `accepted`, la aceptación de la persona de la sesión. */
export function seedNotice({ accepted = true, version = NOTICE_VERSION }: { accepted?: boolean; version?: string } = {}) {
  fakeDb.privacy_notices.push({ id: NOTICE_ID, version, title: 'Aviso de privacidad de dentro (borrador)', url_path: '/aviso-de-privacidad', is_current: true, is_draft: true })
  if (accepted) fakeDb.account_consents.push({ id: 1, user_id: fakeUser().id, notice_id: NOTICE_ID, source: 'signup' })
}

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
    onboarding_state: { tasks: { identity: true } },
    whatsapp_e164: null,
    city: '',
    created_by: null,
    created_at: '2026-11-15T00:00:00Z',
    updated_at: '2026-11-15T00:00:00Z',
    ...overrides,
  }
}

/** Siembra una clínica con la persona de la sesión como dueña y una sucursal. */
export function seedClinic(tenant: Row = fakeTenant(), userId = fakeUser().id, role = 'owner') {
  fakeDb.tenants.push(tenant)
  fakeDb.memberships.push({ id: `m-${String(tenant.id)}`, tenant_id: tenant.id, user_id: userId, role, status: 'active', created_at: '2026-11-15T00:00:00Z' })
  if (!fakeDb.profiles.some((p) => p.id === userId)) fakeDb.profiles.push({ id: userId, full_name: 'Dueña Prueba', phone_e164: null, avatar_path: null })
  fakeDb.branches.push({ id: tenant.id === TENANT_ID ? BRANCH_ID : `b-${String(tenant.id)}`, tenant_id: tenant.id, name: 'Sucursal principal', address: '', is_active: true })
}

function query(table: string) {
  const filters: [string, unknown][] = []
  const inFilters: [string, unknown[]][] = []
  const preds: ((r: Row) => boolean)[] = []
  let withCount = false
  let range: [number, number] | null = null
  let single = false
  const run = () => {
    let rows = ((fakeDb as Record<string, Row[] | undefined>)[table] ?? []).filter(
      (r) => filters.every(([k, v]) => r[k] === v) && inFilters.every(([k, vs]) => vs.includes(r[k])) && preds.every((f) => f(r)),
    )
    const total = rows.length
    if (range) rows = rows.slice(range[0], range[1] + 1)
    // Como Supabase: cada respuesta trae objetos nuevos (copias), no referencias a la base.
    rows = rows.map((r) => structuredClone(r))
    if (table === 'memberships') {
      rows = rows.map((m) => {
        const tenant = fakeDb.tenants.find((t) => t.id === m.tenant_id)
        return { ...m, tenant: tenant ? structuredClone(tenant) : null }
      })
    }
    return Promise.resolve(single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null, count: withCount ? total : null })
  }
  const like = (v: unknown, pattern: string) =>
    String(v ?? '').toLowerCase().includes(pattern.replace(/^%|%$/g, '').replace(/\\(.)/g, '$1').toLowerCase())
  const builder = {
    select: (_cols?: string, opts?: { count?: string }) => {
      if (opts?.count) withCount = true
      return builder
    },
    is: (k: string, v: unknown) => {
      preds.push((r) => (r[k] ?? null) === v)
      return builder
    },
    not: (k: string, _op: string, v: unknown) => {
      preds.push((r) => (r[k] ?? null) !== v)
      return builder
    },
    ilike: (k: string, pattern: string) => {
      preds.push((r) => like(r[k], pattern))
      return builder
    },
    or: (expr: string) => {
      const parts = expr.split(',').map((p) => p.split('.ilike.') as [string, string])
      preds.push((r) => parts.some(([k, pat]) => like(r[k], pat)))
      return builder
    },
    range: (a: number, b: number) => {
      range = [a, b]
      return builder
    },
    eq: (k: string, v: unknown) => {
      filters.push([k, v])
      return builder
    },
    in: (k: string, vs: unknown[]) => {
      inFilters.push([k, vs])
      return builder
    },
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => {
      single = true
      return run()
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => run().then(resolve, reject),
  }
  return builder
}

type FnResult = Promise<{ data: unknown; error: { context?: { json: () => Promise<unknown> } } | null }>
export const functionOverrides: Record<string, (body: Record<string, unknown>) => FnResult> = {}

function functionHandler(name: string, body: Record<string, unknown>): FnResult {
  const override = functionOverrides[name]
  if (override) return override(body)
  if (name === 'document-url') {
    const doc = fakeDb.patient_documents.find((d) => d.id === body.document_id)
    if (!doc) return Promise.resolve({ data: null, error: { context: { json: () => Promise.resolve({ status: 'error', code: 'not_found', message: 'No encontramos este documento o no tienes acceso.' }) } } })
    fakeDb.document_access_log.push({ document_id: doc.id, action: body.action })
    return Promise.resolve({ data: { status: 'ok', url: `https://storage.test/firmado/${String(doc.id)}`, expires_in: 60 }, error: null })
  }
  if (name === 'invite-member') {
    const existing = fakeDb.invitations.find((i) => i.tenant_id === body.tenant_id && i.email === body.email && i.status === 'pending')
    if (existing) {
      existing.role = body.role
    } else {
      fakeDb.invitations.push({
        id: `inv-${fakeDb.invitations.length + 1}`,
        tenant_id: body.tenant_id,
        email: body.email,
        role: body.role,
        branch_ids: body.branch_ids,
        status: 'pending',
        expires_at: '2026-11-22T00:00:00Z',
        created_at: '2026-11-15T00:00:00Z',
      })
    }
    return Promise.resolve({ data: { status: 'sent', invitation_id: 'inv-1' }, error: null })
  }
  return Promise.resolve({ data: null, error: null })
}

type RpcResult = Promise<{ data: unknown; error: { code: string; message: string } | null }>
export const rpcOverrides: Record<string, (args: Record<string, unknown>) => RpcResult> = {}

function rpcHandler(fn: string, args: Record<string, unknown>): RpcResult {
  const override = rpcOverrides[fn]
  if (override) return override(args)
  if (fn === 'am_i_platform_admin') return Promise.resolve({ data: false, error: null })
  if (fn === 'accept_privacy_notice') {
    const notice = fakeDb.privacy_notices.find((n) => n.is_current)
    if (!notice || notice.version !== args.p_version) return Promise.resolve({ data: null, error: { code: '22023', message: 'cambió' } })
    const userId = current?.user.id
    if (!fakeDb.account_consents.some((c) => c.user_id === userId && c.notice_id === notice.id)) {
      fakeDb.account_consents.push({ id: fakeDb.account_consents.length + 1, user_id: userId, notice_id: notice.id, source: args.p_source })
    }
    return Promise.resolve({ data: {}, error: null })
  }
  if (fn === 'accept_my_invitations') return Promise.resolve({ data: 0, error: null })
  if (fn === 'register_document') {
    const obj = fakeStorage.find((o) => o.path === args.p_storage_path)
    if (!obj) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
    const row = {
      id: `d-${fakeDb.patient_documents.length + 1}`,
      tenant_id: String(args.p_storage_path).split('/')[0],
      patient_id: args.p_patient,
      kind: args.p_kind,
      name: args.p_name,
      storage_path: args.p_storage_path,
      mime: obj.type,
      size_bytes: 2048,
      created_at: '2026-11-16T12:00:00Z',
      archived_at: null,
    }
    fakeDb.patient_documents.push(row)
    fakeDb.document_access_log.push({ document_id: row.id, action: 'upload' })
    return Promise.resolve({ data: row, error: null })
  }
  if (fn === 'set_document_archived') {
    const d = fakeDb.patient_documents.find((x) => x.id === args.p_document)
    if (d) d.archived_at = args.p_archived ? '2026-11-16T13:00:00Z' : null
    return Promise.resolve({ data: d ?? null, error: null })
  }
  if (fn === 'create_patient') {
    if (!args.p_consent_method) return Promise.resolve({ data: null, error: { code: '22023', message: 'consent' } })
    const row = {
      id: `p-${fakeDb.patients.length + 1}`,
      tenant_id: args.p_tenant,
      full_name: String(args.p_full_name).trim(),
      birth_date: args.p_birth_date ?? null,
      phone_e164: args.p_phone_e164 ?? null,
      email: args.p_email ?? null,
      source: args.p_source ?? 'manual',
      primary_doctor_id: args.p_primary_doctor ?? null,
      tags: [],
      archived_at: null,
      created_at: '2026-11-16T10:00:00Z',
      consent: { method: args.p_consent_method, notice_version: 'clinica-borrador-2026-11', recorded_at: '2026-11-16T10:00:00Z' },
    }
    fakeDb.patients.push(row)
    fakeDb.patient_access_log.push({ patient_id: row.id, action: 'create' })
    return Promise.resolve({ data: row, error: null })
  }
  if (fn === 'open_patient') {
    const pt = fakeDb.patients.find((x) => x.id === args.p_patient)
    if (!pt) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
    fakeDb.patient_access_log.push({ patient_id: pt.id, action: 'view' })
    const { consent, ...patient } = pt as Row & { consent?: Row }
    const notes = fakeDb.patient_notes.filter((n) => n.patient_id === pt.id).reverse()
    return Promise.resolve({ data: structuredClone({ patient, consent: consent ?? null, notes }), error: null })
  }
  if (fn === 'add_patient_note') {
    fakeDb.patient_notes.push({ id: `n-${fakeDb.patient_notes.length + 1}`, patient_id: args.p_patient, body: args.p_body, author_id: current?.user.id, author_name: 'Dueña Prueba', created_at: '2026-11-16T11:00:00Z' })
    return Promise.resolve({ data: {}, error: null })
  }
  if (fn === 'update_patient') {
    const pt = fakeDb.patients.find((x) => x.id === args.p_patient)
    if (pt) {
      const map = { p_full_name: 'full_name', p_birth_date: 'birth_date', p_phone_e164: 'phone_e164', p_email: 'email', p_source: 'source', p_primary_doctor: 'primary_doctor_id' } as const
      for (const [a, c] of Object.entries(map)) if (typeof args[a] === 'string') pt[c] = args[a] || null
    }
    return Promise.resolve({ data: pt ?? null, error: null })
  }
  if (fn === 'set_patient_archived') {
    const pt = fakeDb.patients.find((x) => x.id === args.p_patient)
    if (pt) pt.archived_at = args.p_archived ? '2026-11-16T12:00:00Z' : null
    return Promise.resolve({ data: pt ?? null, error: null })
  }
  if (fn === 'set_branch_hours') {
    const b = fakeDb.branches.find((x) => x.id === args.p_branch)
    if (b) b.opening_hours = args.p_hours
    return Promise.resolve({ data: b ?? null, error: null })
  }
  if (fn === 'update_my_profile') {
    const p = fakeDb.profiles.find((x) => x.id === current?.user.id)
    if (p) {
      if (typeof args.p_full_name === 'string') p.full_name = args.p_full_name
      if (typeof args.p_phone_e164 === 'string') p.phone_e164 = args.p_phone_e164 || null
    }
    return Promise.resolve({ data: p ?? null, error: null })
  }
  if (fn === 'create_chair') {
    const b = fakeDb.branches.find((x) => x.id === args.p_branch)
    const dup = fakeDb.chairs.some((c) => c.branch_id === args.p_branch && String(c.name).toLowerCase() === String(args.p_name).trim().toLowerCase())
    if (dup) return Promise.resolve({ data: null, error: { code: '23505', message: 'dup' } })
    const row = { id: `chair-${fakeDb.chairs.length + 1}`, tenant_id: b?.tenant_id, branch_id: args.p_branch, name: String(args.p_name).trim(), is_active: true, created_at: `2026-11-16T00:00:0${fakeDb.chairs.length}Z` }
    fakeDb.chairs.push(row)
    return Promise.resolve({ data: row, error: null })
  }
  if (fn === 'update_chair') {
    const c = fakeDb.chairs.find((x) => x.id === args.p_chair)
    if (c && typeof args.p_is_active === 'boolean') c.is_active = args.p_is_active
    return Promise.resolve({ data: c ?? null, error: null })
  }
  if (fn === 'create_branch') {
    const row = { id: `branch-${fakeDb.branches.length + 1}`, tenant_id: args.p_tenant, name: args.p_name, address: args.p_address ?? '', is_active: true, created_at: '2026-11-16T01:00:00Z' }
    fakeDb.branches.push(row)
    return Promise.resolve({ data: row, error: null })
  }
  if (fn === 'update_branch') {
    const b = fakeDb.branches.find((x) => x.id === args.p_branch)
    if (b) {
      if (typeof args.p_name === 'string') b.name = args.p_name
      if (typeof args.p_address === 'string') b.address = args.p_address
    }
    return Promise.resolve({ data: b ?? null, error: null })
  }
  if (fn === 'save_treatments') {
    const items = args.p_items as Row[]
    for (const it of items) {
      if (it.id) {
        const t = fakeDb.treatments.find((x) => x.id === it.id)
        if (t) Object.assign(t, it)
      } else {
        fakeDb.treatments.push({ ...it, id: `t-${fakeDb.treatments.length + 1}`, tenant_id: args.p_tenant })
      }
    }
    return Promise.resolve({ data: items.length, error: null })
  }
  if (fn === 'set_onboarding_task') {
    const t = fakeDb.tenants.find((x) => x.id === args.p_tenant)
    if (t) {
      const state = (t.onboarding_state ?? {}) as { tasks?: Record<string, boolean> }
      t.onboarding_state = { ...state, tasks: { ...(state.tasks ?? {}), [String(args.p_task)]: Boolean(args.p_done) } }
    }
    return Promise.resolve({ data: t?.onboarding_state ?? null, error: null })
  }
  if (fn === 'revoke_invitation') {
    const inv = fakeDb.invitations.find((i) => i.id === args.p_invitation)
    if (inv) inv.status = 'revoked'
    return Promise.resolve({ data: inv ?? null, error: null })
  }
  if (fn === 'update_member_role' || fn === 'revoke_member') {
    const m = fakeDb.memberships.find((x) => x.id === args.p_membership)
    if (m && fn === 'update_member_role') m.role = args.p_role
    if (m && fn === 'revoke_member') m.status = 'revoked'
    return Promise.resolve({ data: m ?? null, error: null })
  }
  if (fn === 'update_tenant_identity') {
    const t = fakeDb.tenants.find((x) => x.id === args.p_tenant)
    if (t && typeof args.p_logo_path === 'string') t.logo_path = args.p_logo_path || null
    if (t) {
      for (const [arg, col] of [['p_display_name', 'display_name'], ['p_owner_display_name', 'owner_display_name'], ['p_owner_title', 'owner_title'], ['p_brand_color', 'brand_color'], ['p_city', 'city']] as const) {
        if (typeof args[arg] === 'string') t[col] = args[arg]
      }
      if (typeof args.p_whatsapp_e164 === 'string') t.whatsapp_e164 = args.p_whatsapp_e164 || null
    }
    return Promise.resolve({ data: t ?? null, error: null })
  }
  if (fn === 'create_tenant') {
    const tenant = fakeTenant({
      id: '10000000-0000-4000-8000-0000000000ff',
      display_name: args.p_display_name,
      kind: args.p_kind,
      slug: args.p_slug,
      owner_display_name: args.p_owner_display_name,
      owner_title: args.p_owner_title,
      brand_color: args.p_brand_color,
      whatsapp_e164: args.p_whatsapp_e164 || null,
      city: args.p_city,
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
  fakeSupabase.auth.updateUser.mockImplementation(() => Promise.resolve({ data: {}, error: null }))
  fakeSupabase.auth.verifyOtp.mockReset()
  for (const k of Object.keys(fakeDb) as (keyof Db)[]) fakeDb[k] = []
  fakeStorage.length = 0
  for (const k of Object.keys(rpcOverrides)) delete rpcOverrides[k]
  for (const k of Object.keys(functionOverrides)) delete functionOverrides[k]
}
