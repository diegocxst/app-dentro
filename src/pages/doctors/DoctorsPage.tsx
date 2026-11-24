import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoadError } from '@/components/feedback/LoadError'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-styles'
import { Skeleton } from '@/components/ui/Skeleton'
import { fetchTeam, type TeamMember } from '@/data/team'
import { cn } from '@/lib/cn'
import { doctorColorClass, initials, TREATING_ROLES } from '@/lib/doctors'
import { isManager, ROLE_LABEL } from '@/lib/roles'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'
import { TeamTabs } from './TeamTabs'

/** P26 · Doctores de la clínica (con y sin acceso). La gerencia da de alta y edita. */
export function DoctorsPage() {
  const { active } = useWorkspace()
  const tenantId = active?.tenant_id
  const manager = isManager(active?.role) && active?.tenant.status === 'active'
  const [team, setTeam] = useState<TeamMember[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!tenantId) return
    let current = true
    fetchTeam(tenantId).then(
      (t) => {
        if (!current) return
        setFailed(false)
        setTeam(t)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [tenantId, attempt])

  if (!active) return null
  const doctors = (team ?? []).filter((m) => TREATING_ROLES.includes(m.role))

  return (
    <>
      <PageHeader
        eyebrow="Tu equipo"
        title="Doctores"
        description="Quién atiende en tu clínica, con su especialidad y su color en la agenda."
        actions={
          manager && (
            <Link to="/doctores/nuevo" className={buttonClasses('primary')}>
              Nuevo doctor
            </Link>
          )
        }
      />
      <TeamTabs />
      {failed ? (
        <LoadError title="No pudimos cargar a los doctores" onRetry={reload} />
      ) : !team ? (
        <Skeleton className="h-48 w-full" label="Cargando doctores" />
      ) : (
        <div className="flex flex-col gap-4">
          {manager && doctors.every((d) => d.role === 'owner') && (
            <Alert tone="info">
              Por ahora solo estás tú. Agrega a tus doctores: con correo les llega una invitación; sin correo quedan como doctores sin acceso.
            </Alert>
          )}
          <ul aria-label="Doctores de la clínica" className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {doctors.map((d, i) => (
              <li key={d.id}>
                <Link
                  to={`/doctores/${d.id}`}
                  className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface-raised p-4 hover:border-violet"
                >
                  <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-pill text-caption font-semibold text-on-night', doctorColorClass(d.color, i))}>
                    {initials(d.fullName)}
                  </span>
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="truncate font-semibold text-ink">{d.fullName}</span>
                    <span className="truncate text-caption text-ink-muted">{[ROLE_LABEL[d.role], d.specialty].filter(Boolean).join(' · ')}</span>
                  </span>
                  {!d.hasAccess && <Badge tone="neutral">Sin acceso</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
