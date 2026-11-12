import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AA_NORMAL, contrastRatio } from '@/lib/color'

type Token = { name: string; value: { light: string; dark: string } }
const root = process.cwd()
const json = JSON.parse(readFileSync(resolve(root, 'docs/diseno/tokens.json'), 'utf8')) as { color: { tokens: Token[] } }
const css = readFileSync(resolve(root, 'src/brand/tokens.css'), 'utf8')

function block(selector: string): string {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`No existe ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}
function vars(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of text.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim()
  return out
}

const light = vars(block(':root {'))
const dark = vars(block(':root[data-theme="dark"]'))
const darkMedia = vars(block(':root:not([data-theme="light"])'))
const themes = { light, dark } as const

describe('tokens.css', () => {
  it('coincide con docs/diseno/tokens.json en claro y oscuro', () => {
    for (const t of json.color.tokens) {
      expect(light[t.name], `${t.name} (claro)`).toBe(t.value.light)
      expect(dark[t.name], `${t.name} (oscuro)`).toBe(t.value.dark)
      expect(darkMedia[t.name], `${t.name} (oscuro por sistema)`).toBe(t.value.dark)
    }
  })

  it('el tema oscuro por sistema es idéntico al oscuro manual', () => {
    expect(darkMedia).toEqual(dark)
  })
})

/** Pares texto / fondo que usa la interfaz. Todos deben cumplir AA (4.5:1). */
const TEXT_PAIRS: [fg: string, bg: string][] = [
  ['ink', 'surface'],
  ['ink', 'surface-raised'],
  ['ink-muted', 'surface'],
  ['ink-muted', 'surface-raised'],
  ['violet', 'surface-raised'],
  ['violet', 'lavender'],
  ['on-violet', 'violet'],
  ['turquoise-text', 'surface-raised'],
  ['orange-text', 'surface'],
  ['orange-text', 'surface-raised'],
  ['orange-text', 'orange-soft'],
  ['ink', 'turquoise-soft'],
  ['success', 'success-soft'],
  ['warning', 'warning-soft'],
  ['error', 'error-soft'],
  ['info', 'info-soft'],
  ['ink-muted', 'surface'],
  ['on-night', 'night'],
  ['on-night-muted', 'night'],
  ['on-night-growth', 'night'],
  ['on-night', 'night-active'],
  ['on-night-muted', 'night-raised'],
  ['on-night', 'night-raised'],
]

describe('contraste AA de los textos', () => {
  for (const [name, t] of Object.entries(themes)) {
    for (const [fg, bg] of TEXT_PAIRS) {
      it(`${fg} sobre ${bg} (${name})`, () => {
        expect(t[fg], fg).toBeDefined()
        expect(t[bg], bg).toBeDefined()
        expect(contrastRatio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(AA_NORMAL)
      })
    }
  }

  it('texto night sobre turquesa y naranja (regla de marca)', () => {
    for (const t of Object.values(themes)) {
      expect(contrastRatio('#1E1240', t.turquoise!)).toBeGreaterThanOrEqual(AA_NORMAL)
      expect(contrastRatio('#1E1240', t.orange!)).toBeGreaterThanOrEqual(AA_NORMAL)
    }
  })
})
