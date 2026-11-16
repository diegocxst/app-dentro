#!/usr/bin/env node
// Prueba la base de dentro en un PostgreSQL 17 DESECHABLE. No toca ningún Supabase.
// Pasos: stub mínimo de Supabase → migraciones → suites de aislamiento →
// rollback (verifica que no quede nada) → reaplicación → suites otra vez.
// Origen: core-base (Realt-In), adaptado a dentro. Uso: npm run test:db
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { ensureBrandContrast } from '../src/lib/color.ts'

const ROOT = fileURLToPath(new URL('../supabase/', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const list = (dir, suffix) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => `${dir}/${f}`)

const migrations = list('migrations', '.sql')
const rollbacks = list('rollback', '.down.sql').reverse()
const suites = list('tests', '_rls_isolation.sql')

const PORT = 55400 + Math.floor(Math.random() * 90)
const PASS = randomBytes(12).toString('hex')
const dir = mkdtempSync(join(tmpdir(), 'dentro-db-'))
const server = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: PASS,
  port: PORT,
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: () => {},
})

let failed = 0
const step = async (name, fn) => {
  try {
    const detail = await fn()
    console.log(`OK    ${name}${detail ? ` · ${detail}` : ''}`)
  } catch (e) {
    failed++
    console.log(`FALLA ${name} · ${e instanceof Error ? e.message : String(e)}`)
  }
}

await server.initialise()
await server.start()
const db = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password: PASS, database: 'postgres' })
db.on('error', () => {})
await db.connect()

const runSuites = async (label) => {
  for (const s of suites) {
    await step(`${label}: ${s}`, async () => {
      let results
      try {
        results = [].concat(await db.query(read(s)))
      } catch (e) {
        await db.query('rollback') // la suite corre en una transacción: no dejarla abierta
        throw e
      }
      const last = results.reverse().find((r) => r.rows?.length)
      const value = last?.rows?.[0]?.resultado
      if (!value) throw new Error('la suite no devolvió resultado')
      return value
    })
  }
}

const countObjects = async () => {
  const { rows } = await db.query(`
    select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'v', 'S')`)
  return rows[0].n
}

try {
  await step('Stub mínimo de Supabase', async () => {
    await db.query(read('tests/local/supabase_stub.sql'))
  })
  for (const m of migrations) {
    await step(`Migración ${m}`, async () => {
      await db.query(read(m))
    })
  }
  await runSuites('Suite')
  await step('ensure_brand_color (SQL) coincide con ensureBrandContrast (src/lib/color.ts)', async () => {
    const samples = ['#0E5E8A', '#2DD4E0', '#FF8A3D', '#FFFF00', '#FFFFFF', '#B42A5B', '#7C4DFF', '#9B7BFF', '#F0EBFF', '#000000', '#abcdef']
    const { rows } = await db.query('select v, private.ensure_brand_color(v) as c from unnest($1::text[]) as v', [samples])
    const diff = rows.filter((r) => r.c !== ensureBrandContrast(r.v).color)
    if (diff.length) throw new Error(diff.map((r) => `${r.v}: SQL ${r.c} ≠ TS ${ensureBrandContrast(r.v).color}`).join(', '))
    return `${samples.length} colores iguales`
  })
  for (const r of rollbacks) {
    await step(`Rollback ${r}`, async () => {
      try {
        await db.query(read(r))
      } catch (e) {
        await db.query('rollback') // no dejar la transacción abierta para los pasos siguientes
        throw e
      }
    })
  }
  await step('El rollback no deja tablas en public ni private', async () => {
    const n = await countObjects()
    if (n !== 0) throw new Error(`quedan ${n} objetos`)
  })
  for (const m of migrations) {
    await step(`Reaplicación ${m}`, async () => {
      await db.query(read(m))
    })
  }
  await runSuites('Suite tras reaplicar')
} finally {
  await db.end()
  await server.stop()
  rmSync(dir, { recursive: true, force: true })
}

console.log(failed ? `\n${failed} paso(s) fallaron` : '\nBase de dentro: TODO OK')
process.exit(failed ? 1 : 0)
