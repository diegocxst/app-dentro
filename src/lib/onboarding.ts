import type { Json } from './db'

export type GuideTaskId = 'identity' | 'branches' | 'team' | 'treatments' | 'whatsapp' | 'first_patient' | 'first_quote'

export type GuideTask = { id: GuideTaskId; title: string; why: string; minutes: number; cta: string; path: string }

/**
 * Guía de inicio (decisión 2026-11-10: 7 tareas; mockup Main-Bienvenida).
 * Los ids deben coincidir con private.is_onboarding_task() (migración 20261116000100).
 */
export const GUIDE_TASKS: readonly GuideTask[] = [
  { id: 'identity', title: 'Identidad de tu clínica', why: 'Tu logo y color en presupuestos y mensajes', minutes: 2, cta: 'Editar', path: '/configuracion/identidad' },
  { id: 'branches', title: 'Sucursal y sillones', why: 'Para que la agenda sepa dónde atiendes', minutes: 2, cta: 'Agregar sillones', path: '/bienvenida/sucursales' },
  { id: 'team', title: 'Invita a tu equipo', why: 'Cada doctor ve solo sus pacientes y comisiones', minutes: 2, cta: 'Invitar', path: '/bienvenida/equipo' },
  { id: 'treatments', title: 'Tratamientos y precios', why: 'Arma presupuestos en segundos', minutes: 3, cta: 'Agregar precios', path: '/bienvenida/tratamientos' },
  { id: 'whatsapp', title: 'Conecta tu WhatsApp', why: 'Envía recordatorios y presupuestos desde dentro', minutes: 1, cta: 'Conectar', path: '/bienvenida/whatsapp' },
  { id: 'first_patient', title: 'Registra tu primer paciente', why: 'O importa tu lista desde Excel', minutes: 2, cta: 'Agregar paciente', path: '/pacientes' },
  { id: 'first_quote', title: 'Crea tu primer presupuesto', why: 'Con PDF de tu clínica y link de pago', minutes: 3, cta: 'Crear presupuesto', path: '/presupuestos' },
]

export const GUIDE_TOTAL = GUIDE_TASKS.length

/** Tareas marcadas en `tenants.onboarding_state` (`{ "tasks": { "<id>": true } }`). */
export function guideDone(state: Json | null | undefined): Set<GuideTaskId> {
  const done = new Set<GuideTaskId>()
  if (state && typeof state === 'object' && !Array.isArray(state)) {
    const tasks = state.tasks
    if (tasks && typeof tasks === 'object' && !Array.isArray(tasks)) {
      for (const t of GUIDE_TASKS) if (tasks[t.id] === true) done.add(t.id)
    }
  }
  return done
}

export function guideProgress(state: Json | null | undefined): { done: number; total: number } {
  return { done: guideDone(state).size, total: GUIDE_TOTAL }
}

/** Minutos que faltan para terminar la guía. */
export function minutesLeft(done: Set<GuideTaskId>): number {
  return GUIDE_TASKS.reduce((sum, t) => sum + (done.has(t.id) ? 0 : t.minutes), 0)
}
