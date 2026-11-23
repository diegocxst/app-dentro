import { useCallback } from 'react'
import { formatPhone } from '@/lib/phone'
import { logoToPng } from '@/lib/quoteShare'
import type { ClinicPdf } from '@/pages/pdf/pdfBase'
import { useWorkspace } from '@/workspace/workspace-context'

/** Identidad de la clínica para los PDF (logo en PNG, color, dirección de la sucursal y WhatsApp). */
export function useClinicPdf(): () => Promise<ClinicPdf> {
  const { active, branches, activeBranchId, logoUrl } = useWorkspace()
  const address = (branches.find((b) => b.id === activeBranchId) ?? branches[0])?.address ?? ''
  const tenant = active?.tenant
  return useCallback(async () => {
    if (!tenant) throw new Error('Sin clínica')
    return {
      name: tenant.display_name,
      address,
      phone: tenant.whatsapp_e164 ? `WhatsApp ${formatPhone(tenant.whatsapp_e164)}` : '',
      brandColor: tenant.brand_color,
      logoPng: await logoToPng(logoUrl),
    }
  }, [tenant, address, logoUrl])
}
