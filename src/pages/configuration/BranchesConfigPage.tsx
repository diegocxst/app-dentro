import { Link } from 'react-router'
import { BranchesEditor } from '@/components/catalog/BranchesEditor'
import { isManager } from '@/lib/roles'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

export function BranchesConfigPage() {
  const { active } = useWorkspace()
  if (!active) return null
  return (
    <>
      <PageHeader eyebrow="Configuración" title="Sucursales y sillones" actions={<Link to="/configuracion" className="text-ui font-semibold text-violet">Volver</Link>} />
      <BranchesEditor tenantId={active.tenant_id} canEdit={isManager(active.role) && active.tenant.status === 'active'} />
    </>
  )
}
