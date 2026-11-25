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
    setSession: vi.fn(),
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
type Db = { tenants: Row[]; memberships: Row[]; profiles: Row[]; branches: Row[]; privacy_notices: Row[]; account_consents: Row[]; invitations: Row[]; chairs: Row[]; treatments: Row[]; patients: Row[]; patient_notes: Row[]; patient_access_log: Row[]; patient_documents: Row[]; document_access_log: Row[]; arco_requests: Row[]; appointments: Row[]; leads: Row[]; lead_activity: Row[]; quotes: Row[]; quote_items: Row[]; payments: Row[]; commission_schemes: Row[]; commission_entries: Row[]; commission_payouts: Row[]; doctor_settings: Row[] }
export const fakeStorage: { bucket: string; path: string; type: string }[] = []
export const fakeDb: Db = { tenants: [], memberships: [], profiles: [], branches: [], privacy_notices: [], account_consents: [], invitations: [], chairs: [], treatments: [], patients: [], patient_notes: [], patient_access_log: [], patient_documents: [], document_access_log: [], arco_requests: [], appointments: [], leads: [], lead_activity: [], quotes: [], quote_items: [], payments: [], commission_schemes: [], commission_entries: [], commission_payouts: [], doctor_settings: [] }

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
    commission_period: 'quincenal',
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
export function seedClinic(tenant: Row = fakeTenant(), userId = fakeUser().id, role = 'owner', branch: Row = {}) {
  fakeDb.tenants.push(tenant)
  fakeDb.memberships.push({ id: `m-${String(tenant.id)}`, tenant_id: tenant.id, user_id: userId, role, status: 'active', display_name: '', created_at: '2026-11-15T00:00:00Z' })
  if (!fakeDb.profiles.some((p) => p.id === userId)) fakeDb.profiles.push({ id: userId, full_name: 'Dueña Prueba', phone_e164: null, avatar_path: null, title: '' })
  fakeDb.branches.push({ id: tenant.id === TENANT_ID ? BRANCH_ID : `b-${String(tenant.id)}`, tenant_id: tenant.id, name: 'Sucursal principal', address: '', is_active: true, timezone: 'America/Mexico_City', opening_hours: {}, ...branch })
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
      existing.membership_id = body.membership_id ?? existing.membership_id ?? null
    } else {
      fakeDb.invitations.push({
        id: `inv-${fakeDb.invitations.length + 1}`,
        tenant_id: body.tenant_id,
        email: body.email,
        role: body.role,
        branch_ids: body.branch_ids,
        membership_id: body.membership_id ?? null,
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



// ── Doctores (M6-B1): nombre en la clínica, perfil y doctores sin acceso, con las reglas de la base ──
const DOCTOR_COLORS = ['violet', 'turquoise', 'orange', 'info', 'success', 'warning']
/** Nombre en la clínica o, si está vacío, el de la cuenta. */
export const memberLabel = (m: Row) => String(m.display_name ?? '').trim() || String(fakeDb.profiles.find((p) => p.id === m.user_id)?.full_name ?? '').trim()
function badDoctorFields(a: Record<string, unknown>) {
  return String(a.p_specialty ?? '').length > 80 || (a.p_color != null && !DOCTOR_COLORS.includes(String(a.p_color))) || (a.p_phone != null && !/^\+[1-9]\d{7,14}$/.test(String(a.p_phone)))
}
function upsertDoctorSettings(m: Row, a: Record<string, unknown>) {
  const row = { membership_id: m.id, tenant_id: m.tenant_id, specialty: String(a.p_specialty ?? '').trim(), calendar_color: a.p_color ?? null, phone_e164: a.p_phone ?? null }
  const i = fakeDb.doctor_settings.findIndex((d) => d.membership_id === m.id)
  if (i >= 0) fakeDb.doctor_settings[i] = { ...fakeDb.doctor_settings[i], ...row } // como el servidor: no toca el horario
  else fakeDb.doctor_settings.push(row)
}

// ── Comisiones (M6-A): mismas reglas y límites que la base (periodo ≤ 400 días, ≤ 200 movimientos) ──
const err = (code: string) => Promise.resolve({ data: null, error: { code, message: code } })
const localDate = (iso: unknown) => String(iso).slice(0, 10)
const activeScheme = (doctor: unknown) => fakeDb.commission_schemes.find((x) => x.membership_id === doctor && !x.ended_at)

function commissionOnPayment(pay: Row) {
  const sch = pay.doctor_id ? activeScheme(pay.doctor_id) : undefined
  if (!sch) return
  const rate = sch.kind === 'percent_collected' ? Number(sch.percent) : 100
  fakeDb.commission_entries.push({
    id: `ce-${fakeDb.commission_entries.length + 1}`, tenant_id: pay.tenant_id, doctor_id: pay.doctor_id, payment_id: pay.id, scheme_id: sch.id, kind: 'comision',
    base: Number(pay.amount), rate, amount: Math.round(Number(pay.amount) * rate) / 100, period_date: localDate(pay.paid_at), payout_id: null, created_at: '2026-11-23T12:00:00Z', voided_at: null,
  })
}

function commissionOnVoid(pay: Row) {
  const e = fakeDb.commission_entries.find((x) => x.payment_id === pay.id && x.kind === 'comision')
  if (!e || e.voided_at) return
  if (!e.payout_id) e.voided_at = '2026-11-23T13:00:00Z'
  else fakeDb.commission_entries.push({ ...e, id: `ce-${fakeDb.commission_entries.length + 1}`, kind: 'ajuste', base: -Number(e.base), amount: -Number(e.amount), period_date: new Date().toISOString().slice(0, 10), payout_id: null })
}

function badPeriod(from: unknown, to: unknown) {
  if (!from || !to) return true
  const days = (Date.parse(String(to)) - Date.parse(String(from))) / 86400000
  return days < 0 || days > 400
}


/** Igual que private.within_doctor_hours (0021): sin horario propio, sí; si tiene, la cita cabe en un turno. */
function withinDoctorHours(doctorId: unknown, branchId: unknown, startIso: unknown, endIso: unknown): boolean {
  const schedule = fakeDb.doctor_settings.find((d) => d.membership_id === doctorId)?.schedule as Record<string, [string, string][]> | null | undefined
  if (!schedule) return true
  const tz = String(fakeDb.branches.find((b) => b.id === branchId)?.timezone ?? 'America/Mexico_City')
  const parts = (iso: unknown) => {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
    const p = Object.fromEntries(f.formatToParts(new Date(String(iso))).map((x) => [x.type, x.value]))
    return { day: String(p.weekday).toLowerCase().slice(0, 3), date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
  }
  const a = parts(startIso)
  const b = parts(endIso)
  if (a.date !== b.date) return false
  return (schedule[a.day] ?? []).some(([from, to]) => a.time >= from && b.time <= to)
}

function commissionRpc(fn: string, args: Record<string, unknown>): RpcResult | null {
  const me = (tenant: unknown) => fakeDb.memberships.find((m) => m.tenant_id === tenant && m.user_id === current?.user.id && m.status === 'active')
  const isMgr = (tenant: unknown) => ['owner', 'admin'].includes(String(me(tenant)?.role))
  const inRange = (d: string) => d >= String(args.p_from) && d <= String(args.p_to)
  if (fn === 'commission_summary') {
    const mine = me(args.p_tenant)
    if (!mine) return err('42501')
    if (badPeriod(args.p_from, args.p_to)) return err('22023')
    const docs = fakeDb.memberships.filter(
      (m) => m.tenant_id === args.p_tenant && m.status === 'active' && ['owner', 'admin', 'doctor', 'doctor_collab'].includes(String(m.role)) && (isMgr(args.p_tenant) || m.id === mine.id),
    )
    if (!isMgr(args.p_tenant) && !['doctor', 'doctor_collab'].includes(String(mine.role))) return Promise.resolve({ data: [], error: null })
    const data = docs.map((m) => {
      const s = activeScheme(m.id)
      const pays = fakeDb.payments.filter((x) => x.doctor_id === m.id && !x.voided_at && inRange(localDate(x.paid_at)))
      const ents = fakeDb.commission_entries.filter((e) => e.doctor_id === m.id && !e.voided_at && inRange(String(e.period_date)))
      const sum = (rs: Row[]) => Math.round(rs.reduce((t, e) => t + Number(e.amount), 0) * 100) / 100
      const payouts = fakeDb.commission_payouts.filter((po) => po.doctor_id === m.id && po.period_from === args.p_from)
      return {
        doctor_id: m.id, full_name: memberLabel(m) || 'Sin nombre', role: m.role,
        scheme_kind: s?.kind ?? null, percent: s?.percent ?? null, rent_amount: s?.rent_amount ?? null,
        patients: new Set(pays.map((x) => x.patient_id)).size, collected: pays.reduce((t, x) => t + Number(x.amount), 0),
        commission: sum(ents), pending: sum(ents.filter((e) => !e.payout_id)), paid: sum(ents.filter((e) => e.payout_id)),
        rent_due: s?.kind === 'chair_rent' && !payouts.some((po) => Number(po.rent) > 0) ? Number(s.rent_amount) : 0,
        last_paid_at: payouts.map((po) => String(po.paid_at)).sort().at(-1) ?? null,
      }
    })
    return Promise.resolve({ data, error: null })
  }
  if (fn === 'commission_lines') {
    const doc = fakeDb.memberships.find((m) => m.id === args.p_doctor)
    if (!doc || !(isMgr(doc.tenant_id) || me(doc.tenant_id)?.id === doc.id)) return err('P0002')
    if (badPeriod(args.p_from, args.p_to)) return err('22023')
    const all = fakeDb.commission_entries
      .filter((e) => e.doctor_id === doc.id && !e.voided_at && inRange(String(e.period_date)))
      .map((e) => {
        const pay = fakeDb.payments.find((x) => x.id === e.payment_id)
        const q = fakeDb.quotes.find((x) => x.id === pay?.quote_id)
        return { id: e.id, kind: e.kind, base: e.base, rate: e.rate, amount: e.amount, period_date: e.period_date, paid: Boolean(e.payout_id), folio: pay?.folio,
          method: pay?.method, patient: fakeDb.patients.find((x) => x.id === pay?.patient_id)?.full_name, quote_title: q?.title ?? null, quote_folio: q?.folio ?? null }
      })
      .sort((a, b) => String(b.period_date).localeCompare(String(a.period_date)) || Number(b.folio) - Number(a.folio))
    const limit = Math.min(Math.max(Number(args.p_limit ?? 50), 1), 200)
    const offset = Math.max(Number(args.p_offset ?? 0), 0)
    return Promise.resolve({ data: { total: all.length, rows: all.slice(offset, offset + limit) }, error: null })
  }
  if (fn === 'pay_commissions') {
    const doc = fakeDb.memberships.find((m) => m.id === args.p_doctor)
    if (!doc || !isMgr(doc.tenant_id)) return err('P0002')
    if (badPeriod(args.p_from, args.p_to)) return err('22023')
    const pend = fakeDb.commission_entries.filter((e) => e.doctor_id === doc.id && !e.voided_at && !e.payout_id && inRange(String(e.period_date)))
    const s = activeScheme(doc.id)
    const rent = s?.kind === 'chair_rent' && !fakeDb.commission_payouts.some((po) => po.doctor_id === doc.id && po.period_from === args.p_from && Number(po.rent) > 0) ? Number(s.rent_amount) : 0
    if (pend.length === 0 && rent === 0) return err('22023')
    const commissions = pend.reduce((t, e) => t + Number(e.amount), 0)
    const po = { id: `po-${fakeDb.commission_payouts.length + 1}`, tenant_id: doc.tenant_id, doctor_id: doc.id, period_from: args.p_from, period_to: args.p_to, commissions, rent, total: commissions - rent, notes: args.p_notes ?? null, paid_at: '2026-11-23T14:00:00Z', paid_by: current?.user.id }
    fakeDb.commission_payouts.push(po)
    for (const e of pend) e.payout_id = po.id
    return Promise.resolve({ data: po, error: null })
  }
  if (fn === 'set_commission_scheme') {
    const doc = fakeDb.memberships.find((m) => m.id === args.p_membership)
    if (!doc || !isMgr(doc.tenant_id)) return err('P0002')
    if (!['admin', 'doctor', 'doctor_collab'].includes(String(doc.role))) return err('22023')
    const pct = Number(args.p_percent)
    if (args.p_kind === 'percent_collected' && !(pct > 0 && pct <= 100)) return err('22023')
    if (args.p_kind === 'chair_rent' && !(Number(args.p_rent) > 0)) return err('22023')
    for (const x of fakeDb.commission_schemes) if (x.membership_id === doc.id && !x.ended_at) x.ended_at = '2026-11-23T12:00:00Z'
    if (!args.p_kind) return Promise.resolve({ data: null, error: null })
    const row = { id: `cs-${fakeDb.commission_schemes.length + 1}`, tenant_id: doc.tenant_id, membership_id: doc.id, kind: args.p_kind,
      percent: args.p_kind === 'percent_collected' ? pct : null, rent_amount: args.p_kind === 'chair_rent' ? Number(args.p_rent) : null, started_at: '2026-11-23T12:00:00Z', ended_at: null, created_by: current?.user.id }
    fakeDb.commission_schemes.push(row)
    return Promise.resolve({ data: row, error: null })
  }
  if (fn === 'set_commission_period') {
    if (!isMgr(args.p_tenant)) return err('42501')
    if (!['quincenal', 'mensual'].includes(String(args.p_period))) return err('22023')
    const t = fakeDb.tenants.find((x) => x.id === args.p_tenant)
    if (t) t.commission_period = args.p_period
    return Promise.resolve({ data: t, error: null })
  }
  return null
}

function rpcHandler(fn: string, args: Record<string, unknown>): RpcResult {
  const override = rpcOverrides[fn]
  if (override) return override(args)
  const commission = commissionRpc(fn, args)
  if (commission) return commission
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
  if (fn === 'register_payment' || fn === 'void_payment' || fn === 'patient_account' || fn === 'payment_stats' || fn === 'receivables') {
    const paidOf = (qid: unknown) => fakeDb.payments.filter((x) => x.quote_id === qid && !x.voided_at).reduce((t, x) => t + Number(x.amount), 0)
    if (fn === 'register_payment') {
      const q = fakeDb.quotes.find((x) => x.id === args.p_quote)
      if (q && Number(args.p_amount) > Number(q.total) - paidOf(q.id)) return Promise.resolve({ data: null, error: { code: '22023', message: 'saldo' } })
      const row = {
        id: `pay-${fakeDb.payments.length + 1}`, tenant_id: TENANT_ID, folio: fakeDb.payments.length + 1, patient_id: args.p_patient, quote_id: args.p_quote ?? null,
        doctor_id: q?.doctor_id ?? null, amount: args.p_amount, method: args.p_method, paid_at: args.p_paid_at ?? '2026-11-19T12:00:00Z', reference: args.p_reference ?? null,
        notes: args.p_notes ?? null, registered_by: 'u-1', created_at: '2026-11-19T12:00:00Z', voided_at: null, voided_by: null, void_reason: null,
      }
      fakeDb.payments.push(row)
      commissionOnPayment(row)
      if (q && (q.status === 'presentado' || q.status === 'en_duda')) q.status = 'aceptado'
      return Promise.resolve({ data: row, error: null })
    }
    if (fn === 'void_payment') {
      const pay = fakeDb.payments.find((x) => x.id === args.p_payment)
      if (!pay) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
      Object.assign(pay, { voided_at: '2026-11-19T13:00:00Z', void_reason: args.p_reason })
      commissionOnVoid(pay)
      return Promise.resolve({ data: pay, error: null })
    }
    const open = (pid?: unknown) =>
      fakeDb.quotes
        .filter((q) => (!pid || q.patient_id === pid) && ['presentado', 'en_duda', 'aceptado', 'en_tratamiento', 'terminado'].includes(String(q.status)))
        .map((q): Row => ({ ...q, paid: paidOf(q.id), balance: Number(q.total) - paidOf(q.id) }))
    const won = (q: Row) => ['aceptado', 'en_tratamiento', 'terminado'].includes(String(q.status))
    if (fn === 'patient_account') {
      if (fakeDb.memberships.some((m) => m.user_id === current?.user.id && m.status === 'active' && m.role === 'doctor_intern')) return Promise.resolve({ data: null, error: { code: '42501', message: 'Sin acceso a montos' } })
      const qs = open(args.p_patient)
      const paid = fakeDb.payments.filter((x) => x.patient_id === args.p_patient && !x.voided_at).reduce((t, x) => t + Number(x.amount), 0)
      return Promise.resolve({ data: { quotes: qs, paid_total: paid, balance: qs.filter(won).reduce((t, q) => t + Number(q.balance), 0), last_payment_at: null }, error: null })
    }
    if (fn === 'payment_stats') {
      const sum = fakeDb.payments.filter((x) => !x.voided_at).reduce((t, x) => t + Number(x.amount), 0)
      return Promise.resolve({ data: { today: sum, month: sum, month_count: fakeDb.payments.filter((x) => !x.voided_at).length, receivable: open().filter(won).reduce((t, q) => t + Number(q.balance), 0) }, error: null })
    }
    const byPatient = new Map<unknown, number>()
    for (const q of open().filter(won)) byPatient.set(q.patient_id, (byPatient.get(q.patient_id) ?? 0) + Number(q.balance))
    return Promise.resolve({
      data: [...byPatient].filter(([, b]) => b > 0).map(([pid, balance]) => {
        const p = fakeDb.patients.find((x) => x.id === pid)
        return { patient_id: pid, full_name: p?.full_name ?? '', phone_e164: p?.phone_e164 ?? null, balance, quotes: 1, last_payment_at: null }
      }),
      error: null,
    })
  }
  if (fn === 'save_quote') {
    const items = (args.p_items as Row[]) ?? []
    if (items.length === 0) return Promise.resolve({ data: null, error: { code: '22023', message: 'partidas' } })
    const total = items.reduce((t, i) => t + Number(i.quantity) * Number(i.unit_price), 0)
    const fields = {
      patient_id: args.p_patient, doctor_id: args.p_doctor ?? null, title: args.p_title ?? '', total,
      down_payment: Number(args.p_installments) > 0 ? Number(args.p_down_payment ?? 0) : 0, installments: Number(args.p_installments ?? 0),
      valid_until: args.p_valid_until ?? '2026-12-18', notes: args.p_notes ?? null, updated_at: '2026-11-18T12:30:00Z',
    }
    let q = fakeDb.quotes.find((x) => x.id === args.p_quote)
    if (q) Object.assign(q, fields)
    else {
      q = { id: `q-${fakeDb.quotes.length + 1}`, tenant_id: TENANT_ID, folio: fakeDb.quotes.length + 1, status: 'borrador', lost_reason: null, sent_at: null, last_followup_at: null, status_changed_at: '2026-11-18T12:00:00Z', created_by: 'u-1', created_at: '2026-11-18T12:00:00Z', ...fields }
      fakeDb.quotes.push(q)
    }
    fakeDb.quote_items = fakeDb.quote_items.filter((i) => i.quote_id !== q.id)
    items.forEach((i, position) => fakeDb.quote_items.push({ id: `${String(q.id)}-${position}`, tenant_id: TENANT_ID, quote_id: q.id, position, treatment_id: i.treatment_id ?? null, concept: i.concept, note: i.note ?? '', quantity: i.quantity, unit_price: i.unit_price }))
    return Promise.resolve({ data: q, error: null })
  }
  if (fn === 'set_quote_status' || fn === 'mark_quote_followup') {
    const q = fakeDb.quotes.find((x) => x.id === args.p_quote)
    if (!q) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
    if (fn === 'mark_quote_followup') q.last_followup_at = '2026-11-18T13:00:00Z'
    else {
      if (args.p_status === 'perdido' && !args.p_reason) return Promise.resolve({ data: null, error: { code: '22023', message: 'motivo' } })
      q.status = args.p_status
      q.lost_reason = args.p_status === 'perdido' ? args.p_reason : null
      if (args.p_status === 'presentado') q.sent_at ??= '2026-11-18T12:45:00Z'
    }
    q.updated_at = '2026-11-18T13:05:00Z'
    return Promise.resolve({ data: q, error: null })
  }
  if (fn === 'quote_stats') {
    // El pasante no ve montos (0021).
    if (fakeDb.memberships.some((m) => m.tenant_id === args.p_tenant && m.user_id === current?.user.id && m.role === 'doctor_intern')) return Promise.resolve({ data: null, error: { code: '42501', message: 'Sin acceso' } })
    const won = fakeDb.quotes.filter((q) => ['aceptado', 'en_tratamiento', 'terminado'].includes(String(q.status)))
    const decided = won.length + fakeDb.quotes.filter((q) => q.status === 'perdido').length
    const doubt = fakeDb.quotes.filter((q) => q.status === 'en_duda').reduce((t, q) => t + Number(q.total), 0)
    return Promise.resolve({ data: { won: won.length, decided, in_doubt_total: doubt, avg_ticket: won.length ? won.reduce((t, q) => t + Number(q.total), 0) / won.length : 0 }, error: null })
  }
  if (fn === 'create_lead') {
    if (args.p_notice_shared !== true) return Promise.resolve({ data: null, error: { code: '22023', message: 'aviso' } })
    const row = {
      id: `lead-${fakeDb.leads.length + 1}`, tenant_id: args.p_tenant, full_name: args.p_full_name, phone_e164: args.p_phone_e164 ?? null,
      email: args.p_email ?? null, interest: args.p_interest ?? '', source: args.p_source ?? 'manual', status: 'nuevo', lost_reason: null,
      assigned_to: args.p_assigned_to ?? null, notice_version: 'clinica-borrador-2026-11', converted_patient_id: null, first_response_at: null,
      status_changed_at: '2026-11-16T12:00:00Z', created_by: 'u-1', created_at: '2026-11-16T12:00:00Z', updated_at: '2026-11-16T12:00:00Z',
    }
    fakeDb.leads.push(row)
    fakeDb.lead_activity.push({ id: fakeDb.lead_activity.length + 1, tenant_id: row.tenant_id, lead_id: row.id, actor_id: 'u-1', kind: 'created', from_status: null, to_status: 'nuevo', body: null, created_at: '2026-11-16T12:00:00Z' })
    return Promise.resolve({ data: row, error: null })
  }
  if (fn === 'set_lead_status' || fn === 'update_lead' || fn === 'add_lead_note') {
    const l = fakeDb.leads.find((x) => x.id === args.p_lead)
    if (!l) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
    const log = (kind: string, extra: Row = {}) =>
      fakeDb.lead_activity.push({ id: fakeDb.lead_activity.length + 1, tenant_id: l.tenant_id, lead_id: l.id, actor_id: 'u-1', kind, from_status: null, to_status: null, body: null, created_at: '2026-11-16T13:00:00Z', ...extra })
    if (fn === 'set_lead_status') {
      if (args.p_status === 'perdido' && !args.p_reason) return Promise.resolve({ data: null, error: { code: '22023', message: 'motivo' } })
      log('status', { from_status: l.status, to_status: args.p_status, body: args.p_reason ?? null })
      l.first_response_at ??= l.status === 'nuevo' ? '2026-11-16T13:00:00Z' : null
      l.status = args.p_status
      l.lost_reason = args.p_status === 'perdido' ? args.p_reason : null
    } else if (fn === 'add_lead_note') {
      log('note', { body: args.p_body })
    } else {
      const map: Record<string, string> = { p_full_name: 'full_name', p_phone_e164: 'phone_e164', p_email: 'email', p_interest: 'interest', p_source: 'source', p_assigned_to: 'assigned_to' }
      for (const [k, col] of Object.entries(map)) if (k in args) l[col] = args[k] === '' ? null : args[k]
      l.updated_at = '2026-11-16T13:30:00Z'
      log('p_assigned_to' in args ? 'assigned' : 'updated')
    }
    return Promise.resolve({ data: fn === 'add_lead_note' ? null : l, error: null })
  }
  if (fn === 'lead_stats') {
    return Promise.resolve({ data: { leads: fakeDb.leads.length, reached_valoracion: fakeDb.leads.filter((l) => l.status === 'valoracion' || l.status === 'convertido').length, median_response_minutes: 130, unanswered_24h: 0 }, error: null })
  }
  if (fn === 'list_appointments') {
    const from = Date.parse(String(args.p_from))
    const to = Date.parse(String(args.p_to))
    // Igual que el servidor: hasta 400 días por consulta.
    if (!(to > from) || to - from > 400 * 86_400_000) return Promise.resolve({ data: null, error: { code: '22023', message: 'Rango de fechas inválido' } })
    const rows = fakeDb.appointments
      .filter((a) => (!args.p_branch || a.branch_id === args.p_branch) && (!args.p_patient || a.patient_id === args.p_patient) && (!args.p_lead || a.lead_id === args.p_lead))
      .filter((a) => Date.parse(String(a.starts_at)) < to && Date.parse(String(a.ends_at)) > from)
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
      .map((a) => {
        const p = fakeDb.patients.find((x) => x.id === a.patient_id) ?? fakeDb.leads.find((x) => x.id === a.lead_id)
        const m = fakeDb.memberships.find((x) => x.id === a.doctor_id)
        return {
          ...a,
          lead_id: a.lead_id ?? null,
          patient_name: p?.full_name ?? '',
          patient_phone: p?.phone_e164 ?? null,
          doctor_name: m ? memberLabel(m) : '',
          chair_name: fakeDb.chairs.find((x) => x.id === a.chair_id)?.name ?? '',
          branch_name: fakeDb.branches.find((x) => x.id === a.branch_id)?.name ?? '',
          treatment_name: fakeDb.treatments.find((x) => x.id === a.treatment_id)?.name ?? null,
        }
      })
    return Promise.resolve({ data: rows, error: null })
  }
  if (fn === 'create_lead_appointment') {
    const l = fakeDb.leads.find((x) => x.id === args.p_lead)
    if (!l) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
    const row = {
      id: `cita-${fakeDb.appointments.length + 1}`, tenant_id: TENANT_ID, patient_id: null, lead_id: l.id, status: 'programada', kind: 'valoracion',
      doctor_id: args.p_doctor, branch_id: args.p_branch, chair_id: args.p_chair, starts_at: args.p_starts_at, ends_at: args.p_ends_at,
      treatment_id: args.p_treatment ?? null, notes: args.p_notes ?? null, cancel_reason: null,
    }
    fakeDb.appointments.push(row)
    l.status = 'valoracion'
    return Promise.resolve({ data: row, error: null })
  }
  if (fn === 'lead_patient_matches') {
    const l = fakeDb.leads.find((x) => x.id === args.p_lead)
    return Promise.resolve({ data: fakeDb.patients.filter((p) => l && ((l.phone_e164 && p.phone_e164 === l.phone_e164) || (l.email && p.email === l.email))), error: null })
  }
  if (fn === 'convert_lead') {
    const l = fakeDb.leads.find((x) => x.id === args.p_lead)
    if (!l) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
    let p = fakeDb.patients.find((x) => x.id === args.p_patient)
    if (!p) {
      if (!args.p_consent_method) return Promise.resolve({ data: null, error: { code: '22023', message: 'consentimiento' } })
      p = {
        id: `p-conv-${fakeDb.patients.length + 1}`, tenant_id: l.tenant_id, full_name: l.full_name, phone_e164: l.phone_e164, email: l.email,
        source: l.source, primary_doctor_id: args.p_primary_doctor ?? null, birth_date: args.p_birth_date ?? null, tags: [], archived_at: null,
        created_at: '2026-11-16T14:00:00Z', consent: { method: args.p_consent_method, notice_version: 'clinica-borrador-2026-11', recorded_at: '2026-11-16T14:00:00Z' },
      }
      fakeDb.patients.push(p)
    }
    for (const a of fakeDb.appointments) if (a.lead_id === l.id) Object.assign(a, { patient_id: p.id, lead_id: null })
    Object.assign(l, { status: 'convertido', converted_patient_id: p.id })
    return Promise.resolve({ data: p, error: null })
  }
  if (fn === 'create_appointment' || fn === 'update_appointment') {
    const s0 = Date.parse(String(args.p_starts_at))
    const e0 = Date.parse(String(args.p_ends_at))
    const clash = fakeDb.appointments.some(
      (a) =>
        a.id !== args.p_appointment &&
        a.status !== 'cancelada' &&
        (a.chair_id === args.p_chair || a.doctor_id === args.p_doctor) &&
        Date.parse(String(a.starts_at)) < e0 &&
        Date.parse(String(a.ends_at)) > s0,
    )
    if (clash) return Promise.resolve({ data: null, error: { code: '23P01', message: 'conflicting key value violates exclusion constraint' } })
    if (!withinDoctorHours(args.p_doctor, args.p_branch, args.p_starts_at, args.p_ends_at)) return Promise.resolve({ data: null, error: { code: 'DH002', message: 'Fuera del horario del doctor' } })
    const fields = {
      doctor_id: args.p_doctor, branch_id: args.p_branch, chair_id: args.p_chair, starts_at: args.p_starts_at, ends_at: args.p_ends_at,
      kind: args.p_kind ?? 'tratamiento', treatment_id: args.p_treatment ?? null, notes: args.p_notes ?? null,
    }
    if (fn === 'update_appointment') {
      const a = fakeDb.appointments.find((x) => x.id === args.p_appointment)
      if (!a) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
      Object.assign(a, fields, { status: 'programada' })
      return Promise.resolve({ data: a, error: null })
    }
    const row = {
      id: `cita-${fakeDb.appointments.length + 1}`, tenant_id: TENANT_ID, patient_id: args.p_patient, status: 'programada',
      cancel_reason: null, created_by: 'u-1', created_at: '2026-11-16T12:00:00Z', updated_at: '2026-11-16T12:00:00Z', ...fields,
    }
    fakeDb.appointments.push(row)
    return Promise.resolve({ data: row, error: null })
  }
  if (fn === 'set_appointment_status') {
    const a = fakeDb.appointments.find((x) => x.id === args.p_appointment)
    if (!a) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
    a.status = args.p_status
    if (args.p_status === 'cancelada') a.cancel_reason = args.p_reason ?? null
    return Promise.resolve({ data: a, error: null })
  }
  if (fn === 'set_branch_timezone') {
    const b = fakeDb.branches.find((x) => x.id === args.p_branch)
    if (b) b.timezone = args.p_timezone
    return Promise.resolve({ data: b ?? null, error: null })
  }
  if (fn === 'create_arco_request') {
    const p = fakeDb.patients.find((x) => x.id === args.p_patient)
    const id = `arco-${fakeDb.arco_requests.length + 1}`
    fakeDb.arco_requests.push({
      id, tenant_id: p?.tenant_id, patient_id: args.p_patient, right: args.p_right, channel: args.p_channel,
      received_on: args.p_received_on, due_on: '2026-12-14', details: args.p_details ?? null, status: 'recibida',
      response: null, created_by: 'u-1', created_at: '2026-11-16T12:00:00Z', resolved_by: null, resolved_at: null,
    })
    return Promise.resolve({ data: id, error: null })
  }
  if (fn === 'update_arco_request') {
    const r = fakeDb.arco_requests.find((x) => x.id === args.p_request)
    if (!r) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
    r.status = args.p_status
    if (args.p_response) r.response = args.p_response
    if (args.p_status === 'atendida' || args.p_status === 'improcedente') r.resolved_at = '2026-11-16T13:00:00Z'
    return Promise.resolve({ data: r, error: null })
  }
  if (fn === 'export_patient_data') {
    const p = fakeDb.patients.find((x) => x.id === args.p_patient)
    if (!p) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'no' } })
    return Promise.resolve({
      data: {
        format: 'dentro.patient-export.v1', generated_at: '2026-11-16T12:00:00Z',
        clinic: { name: 'Clínica Prueba', city: 'CDMX', notice_version: 'clinica-borrador-2026-11' },
        patient: { ...p, primary_doctor: null, updated_at: p.created_at }, consents: [], notes: [], documents: [], access_log: [],
        arco_requests: fakeDb.arco_requests.filter((r) => r.patient_id === p.id),
      },
      error: null,
    })
  }
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
      if (typeof args.p_title === 'string') {
        // Igual que el servidor: solo «Dr.», «Dra.» o sin título.
        if (!['', 'Dr.', 'Dra.'].includes(args.p_title.trim())) return Promise.resolve({ data: null, error: { code: '22023', message: 'Título inválido' } })
        p.title = args.p_title.trim()
      }
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
  if (fn === 'set_doctor_schedule') {
    // Igual que el servidor: la gerencia o el propio doctor; hasta dos turnos por día.
    const target = fakeDb.memberships.find((x) => x.id === args.p_membership)
    const mine = target && fakeDb.memberships.find((m) => m.tenant_id === target.tenant_id && m.user_id === current?.user.id && m.status === 'active')
    if (!target || !mine) return err('P0002')
    if (!['owner', 'admin'].includes(String(mine.role)) && mine.id !== target.id) return err('42501')
    const hours = args.p_hours as Record<string, [string, string][]> | null
    if (hours && Object.values(hours).some((r) => r.length > 2)) return err('22023')
    const i = fakeDb.doctor_settings.findIndex((d) => d.membership_id === target.id)
    if (i >= 0) fakeDb.doctor_settings[i]!.schedule = hours
    else fakeDb.doctor_settings.push({ membership_id: target.id, tenant_id: target.tenant_id, specialty: '', calendar_color: null, phone_e164: null, schedule: hours })
    return Promise.resolve({ data: fakeDb.doctor_settings.find((d) => d.membership_id === target.id) ?? null, error: null })
  }
  if (fn === 'create_doctor' || fn === 'update_doctor_profile') {
    const target = fn === 'update_doctor_profile' ? fakeDb.memberships.find((x) => x.id === args.p_membership && x.status === 'active') : null
    const tenant = fn === 'create_doctor' ? args.p_tenant : target?.tenant_id
    const mine = fakeDb.memberships.find((m) => m.tenant_id === tenant && m.user_id === current?.user.id && m.status === 'active')
    if (fn === 'update_doctor_profile' && (!target || !mine)) return err('P0002')
    if (!mine || (mine.role !== 'owner' && mine.role !== 'admin')) return err('42501')
    const name = String(args.p_name ?? '').trim()
    const offline = fn === 'create_doctor' || target?.user_id == null
    if (fn === 'create_doctor' && !['doctor', 'doctor_collab', 'doctor_intern'].includes(String(args.p_role ?? 'doctor'))) return err('22023')
    if (name.length > 120 || (name.length < 2 && (offline || name !== ''))) return err('22023')
    if (badDoctorFields(args)) return err('22023')
    const m: Row = target ?? { id: `m-doc-${fakeDb.memberships.length + 1}`, tenant_id: tenant, user_id: null, role: args.p_role ?? 'doctor', status: 'active', created_at: '2026-11-23T12:00:00Z' }
    m.display_name = name
    if (!target) fakeDb.memberships.push(m)
    upsertDoctorSettings(m, args)
    return Promise.resolve({ data: structuredClone(m), error: null })
  }
  if (fn === 'update_member_role' || fn === 'revoke_member') {
    const m = fakeDb.memberships.find((x) => x.id === args.p_membership)
    if (m && fn === 'update_member_role' && m.user_id == null && !['doctor', 'doctor_collab', 'doctor_intern'].includes(String(args.p_role))) return err('22023')
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
  fakeSupabase.auth.setSession.mockReset()
  for (const k of Object.keys(fakeDb) as (keyof Db)[]) fakeDb[k] = []
  fakeStorage.length = 0
  for (const k of Object.keys(rpcOverrides)) delete rpcOverrides[k]
  for (const k of Object.keys(functionOverrides)) delete functionOverrides[k]
}
