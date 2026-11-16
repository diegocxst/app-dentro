import { useState } from 'react'
import { Link } from 'react-router'
import { TreatmentsEditor } from '@/components/catalog/TreatmentsEditor'
import { Alert } from '@/components/ui/Alert'
import { isManager } from '@/lib/roles'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

export function TreatmentsConfigPage() {
  const { active } = useWorkspace()
  const [saved, setSaved] = useState(false)
  if (!active) return null
  return (
    <>
      <PageHeader eyebrow="Configuración" title="Tratamientos y precios" actions={<Link to="/configuracion" className="text-ui font-semibold text-violet">Volver</Link>} />
      {saved && (
        <Alert tone="success" className="mb-4">
          Listo. Guardamos tus tratamientos.
        </Alert>
      )}
      <TreatmentsEditor
        key={saved ? 'saved' : 'editing'}
        tenantId={active.tenant_id}
        canEdit={isManager(active.role) && active.tenant.status === 'active'}
        submitLabel="Guardar cambios"
        onSaved={() => setSaved(true)}
      />
    </>
  )
}
