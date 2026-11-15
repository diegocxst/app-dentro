import type { Json } from './database.types'

/** Tareas de la guía de inicio (decisión 2026-11-10: 7 tareas). */
export const GUIDE_TOTAL = 7

/**
 * Avance de la guía a partir de `tenants.onboarding_state`
 * (`{ "tasks": { "<id>": true, … } }`). Se llena en E2.
 */
export function guideProgress(state: Json | null | undefined): { done: number; total: number } {
  let done = 0
  if (state && typeof state === 'object' && !Array.isArray(state)) {
    const tasks = state.tasks
    if (tasks && typeof tasks === 'object' && !Array.isArray(tasks)) {
      done = Object.values(tasks).filter((v) => v === true).length
    }
  }
  return { done: Math.min(done, GUIDE_TOTAL), total: GUIDE_TOTAL }
}
