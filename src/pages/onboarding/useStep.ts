import { useNavigate } from 'react-router'
import { setGuideTask } from '@/data/onboarding'
import { guideDone, type GuideTaskId } from '@/lib/onboarding'
import { ONBOARDING_STEPS } from '@/lib/onboarding-steps'
import { isManager } from '@/lib/roles'
import { useWorkspace } from '@/workspace/workspace-context'

/** Datos y acciones comunes de los pasos 2 a 5 del onboarding. */
export function useStep(index: number) {
  const { active, state, refresh } = useWorkspace()
  const navigate = useNavigate()
  const step = ONBOARDING_STEPS[index]!
  const next = ONBOARDING_STEPS[index + 1]?.path ?? '/'
  const back = ONBOARDING_STEPS[index - 1]?.path ?? '/'
  const fullName = state.status === 'ready' ? (state.profile?.full_name ?? '') : ''
  const firstName = fullName.trim().split(/\s+/)[0] ?? ''

  /** Marca la tarea de la guía y pasa al siguiente paso. */
  const complete = async (task: GuideTaskId = step.task) => {
    if (active) await setGuideTask(active.tenant_id, task, true)
    await refresh()
    navigate(next)
  }

  return {
    tenantId: active?.tenant_id ?? '',
    tenant: active?.tenant ?? null,
    canEdit: isManager(active?.role) && active?.tenant.status === 'active',
    done: guideDone(active?.tenant.onboarding_state),
    greeting: firstName ? `Hola, ${firstName}` : 'Te damos la bienvenida',
    back,
    next,
    complete,
  }
}
