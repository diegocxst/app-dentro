// Dirección del perfil público de la clínica (M13). Debe coincidir con el CHECK de
// public.tenants.slug y con private.is_reserved_slug() (una prueba lo verifica).
// Origen: core-base (Realt-In).

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin', 'administrador', 'agenda', 'api', 'app', 'assets', 'auth', 'ayuda',
  'blog', 'clinica', 'clinicas', 'configuracion', 'consultorio', 'consultorios',
  'cuenta', 'dashboard', 'dentistas', 'dentro', 'doctores', 'guia', 'ingresar',
  'login', 'pacientes', 'perfil', 'precios', 'privacidad', 'registro', 'soporte',
  'static', 'superadmin', 'terminos', 'www',
])

/** Convierte un nombre en un slug válido: sin acentos, minúsculas y guiones simples. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
}

export type SlugProblem = 'length' | 'format' | 'double-dash' | 'reserved'

export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < 3 || slug.length > 48) return 'length'
  if (!SLUG_PATTERN.test(slug)) return 'format'
  if (slug.includes('--')) return 'double-dash'
  if (RESERVED_SLUGS.has(slug)) return 'reserved'
  return null
}

export const SLUG_PROBLEM_MESSAGES: Record<SlugProblem, string> = {
  length: 'Usa entre 3 y 48 caracteres.',
  format: 'Usa solo minúsculas, números y guiones, sin guion al inicio ni al final.',
  'double-dash': 'Sin dos guiones seguidos.',
  reserved: 'Esa dirección está reservada. Elige otra.',
}
