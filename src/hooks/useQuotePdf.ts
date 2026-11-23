import { useCallback } from 'react'
import type { QuoteCard, QuoteItem } from '@/data/quotes'
import { useClinicPdf } from '@/hooks/useClinicPdf'
import { useDoctors } from '@/hooks/useDoctors'
import { quoteFileName } from '@/lib/quoteShare'
import { folioLabel } from '@/lib/quotes'
import { useWorkspace } from '@/workspace/workspace-context'

/**
 * Arma el PDF del presupuesto con la identidad de la clínica (logo, color, dirección
 * y WhatsApp). El motor de PDF se carga solo al llamar a `build`.
 */
export function useQuotePdf(quote: QuoteCard | null, items: QuoteItem[]) {
  const { active } = useWorkspace()
  const clinicPdf = useClinicPdf()
  const doctors = useDoctors(active?.tenant_id)
  const doctorName = doctors.find((d) => d.id === quote?.doctor_id)?.name ?? ''

  const build = useCallback(async (): Promise<File> => {
    if (!quote) throw new Error('Sin presupuesto')
    const [{ renderQuotePdf }, clinic] = await Promise.all([import('@/pages/quotes/quotePdf'), clinicPdf()])
    const blob = await renderQuotePdf({
      clinic,
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
  }, [quote, items, clinicPdf, doctorName])

  return { build, doctorName }
}
