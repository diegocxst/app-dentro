/* eslint-disable react-refresh/only-export-components -- módulo de PDF (no es UI de la app; no usa recarga en caliente) */
// PDF del presupuesto con la identidad de la clínica (P20). Se carga solo al usarlo.
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { lineTotal, planText } from '@/lib/quotes'
import { base, C, ClinicBand, day, money, type ClinicPdf } from '@/pages/pdf/pdfBase'

export type QuotePdfData = {
  clinic: ClinicPdf
  folio: string
  date: string
  patient: string
  doctor: string
  title: string
  items: { concept: string; note: string; quantity: number; unitPrice: number }[]
  total: number
  downPayment: number
  installments: number
  validUntil: string
  notes: string
}

const s = StyleSheet.create({
  ...base,
  thead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4, marginTop: 18, color: C.muted, fontSize: 9 },
  tr: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.soft },
  cConcept: { flex: 1 },
  cQty: { width: 40, textAlign: 'right' },
  cPrice: { width: 80, textAlign: 'right' },
  cTotal: { width: 80, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, alignItems: 'baseline' },
  total: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
})

function QuoteDocument({ d }: { d: QuotePdfData }) {
  return (
    <Document title={`Presupuesto ${d.folio} · ${d.patient}`} author={d.clinic.name} creator="dentro" language="es-MX">
      <Page size="LETTER" style={s.page}>
        <ClinicBand clinic={d.clinic} />

        <View style={s.body}>
          <View style={s.row}>
            <View>
              <Text style={s.muted}>Presupuesto para</Text>
              <Text style={s.h1}>{d.patient}</Text>
              {(d.doctor || d.title) && <Text style={s.muted}>{[d.doctor, d.title].filter(Boolean).join(' · ')}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.bold}>Folio {d.folio}</Text>
              <Text style={s.muted}>{day(d.date)}</Text>
            </View>
          </View>

          <View style={s.thead}>
            <Text style={s.cConcept}>Concepto</Text>
            <Text style={s.cQty}>Cant.</Text>
            <Text style={s.cPrice}>Precio</Text>
            <Text style={s.cTotal}>Importe</Text>
          </View>
          {d.items.map((it, i) => (
            <View key={i} style={s.tr} wrap={false}>
              <View style={s.cConcept}>
                <Text>{it.concept}</Text>
                {it.note ? <Text style={s.muted}>{it.note}</Text> : null}
              </View>
              <Text style={s.cQty}>{it.quantity}</Text>
              <Text style={[s.cPrice, it.unitPrice < 0 ? { color: C.success } : {}]}>{money(it.unitPrice)}</Text>
              <Text style={[s.cTotal, it.unitPrice < 0 ? { color: C.success } : {}]}>{money(lineTotal(it))}</Text>
            </View>
          ))}

          <View style={s.totalRow}>
            <Text style={s.bold}>Total</Text>
            <Text style={[s.total, { color: d.clinic.brandColor }]}>{money(d.total)}</Text>
          </View>

          <View style={s.box} wrap={false}>
            <Text>
              <Text style={s.bold}>Plan de pagos: </Text>
              {planText(d.total, d.downPayment, d.installments).replace('\u2212', '-')}.
            </Text>
            <Text style={[s.muted, { marginTop: 4 }]}>Vigencia: hasta el {day(d.validUntil)}. Precios en MXN.</Text>
          </View>

          {d.notes ? (
            <View style={{ marginTop: 14 }} wrap={false}>
              <Text style={s.bold}>Notas</Text>
              <Text>{d.notes}</Text>
            </View>
          ) : null}
        </View>

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${d.clinic.name} · Presupuesto ${d.folio} · página ${pageNumber} de ${totalPages} · hecho con dentro`} />
      </Page>
    </Document>
  )
}

export async function renderQuotePdf(d: QuotePdfData): Promise<Blob> {
  return pdf(<QuoteDocument d={d} />).toBlob()
}
