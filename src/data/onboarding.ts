import type { GuideTaskId } from '@/lib/onboarding'
import { supabase } from '@/lib/supabase'

export async function setGuideTask(tenantId: string, task: GuideTaskId, done: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_onboarding_task', { p_tenant: tenantId, p_task: task, p_done: done })
  if (error) throw error
}

/** El recorrido es por persona: se recuerda en sus metadatos de Auth. */
export async function markTourSeen(): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { tour_seen_at: new Date().toISOString() } })
  if (error) throw error
}
