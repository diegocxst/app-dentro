import { useCallback } from 'react'
import type { QuoteCard, QuoteItem } from '@/data/quotes'
import { useDoctors } from '@/hooks/useDoctors'
import { logoToPng, quoteFileName } from '@/lib/quoteShare'
import { folioLabel } from '@/lib/quotes'
import { formatPhone } from '@/lib/phone'
import { useWorkspace } from '@/workspace/workspace-context'

/**
 * Arma el PDF del presupuesto con la identidad de la clínica (logo, color, dirección
 * y WhatsApp). El motor de PDF se carga solo al llamar a `build`.
 */
export function useQuotePdf(quote: QuoteCard | null, items: QuoteItem[]) {
  const { active, branches, activeBranchId, logoUrl } = useWorkspace()
  const doctors = useDoctors(active?.tenant_id)
  const doctorName = doctors.find((d) => d.id === quote?.doctor_id)?.name ?? ''
  const address = (branches.find((b) => b.id === activeBranchId) ?? branches[0])?.address ?? ''
  const tenant = active?.tenant

  const build = useCallback(async (): Promise<File> => {
    if (!quote || !tenant) throw new Error('Sin presupuesto')
    const [{ renderQuotePdf }, logoPng] = await Promise.all([import('@/pages/quotes/quotePdf'), logoToPng(logoUrl)])
    const blob = await renderQuotePdf({
      clinic: {
        name: tenant.display_name,
        address,
        phone: tenant.whatsapp_e164 ? `WhatsApp ${formatPhone(tenant.whatsapp_e164)}` : '',
        brandColor: tenant.brand_color,
        logoPng,
      },
      folio: folioLabel(quote.folio),
      date: quote.created_at,
      patient: quote.patientName,
      doctor: doctorName,
      title: quote.title,
      items: items.map((i) => ({ concept: i.concept, note: i.note, quantity: i.quantity, unitPrice: Number(i.unit_price) })),
      total: Number(quote.total),
      downPayment: Number(quote.down_payment),
      installments: quote.installments,
      validUntil: quote.valid_until,
      notes: quote.notes ?? '',
    })
    return new File([blob], quoteFileName(folioLabel(quote.folio), quote.patientName), { type: 'application/pdf' })
  }, [quote, items, tenant, address, logoUrl, doctorName])

  return { build, doctorName }
}
