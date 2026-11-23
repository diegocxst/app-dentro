/* eslint-disable react-refresh/only-export-components -- módulo de PDF (no es UI de la app; no usa recarga en caliente) */
// PDF del comprobante de pago con la identidad de la clínica (M5-B). No es factura. Se carga solo al usarlo.
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { base, C, ClinicBand, day, money, type ClinicPdf } from '@/pages/pdf/pdfBase'

export type ReceiptPdfData = {
  clinic: ClinicPdf
  folio: string
  paidAt: string
  patient: string
  doctor: string
  amount: number
  method: string
  reference: string
  quote: { folio: string; title: string; total: number } | null
  balance: number | null
}

const s = StyleSheet.create({
  ...base,
  amountBox: { marginTop: 18, paddingTop: 14, paddingBottom: 18, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  amount: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginTop: 6, lineHeight: 1.3 },
  dl: { marginTop: 16 },
  dlRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.soft },
  dt: { width: 150, color: C.muted },
  dd: { flex: 1 },
})

function ReceiptDocument({ d }: { d: ReceiptPdfData }) {
  const rows: [string, string][] = [
    ['Forma de pago', d.method],
    ...(d.reference ? ([['Referencia', d.reference]] as [string, string][]) : []),
    ...(d.doctor ? ([['Doctor', d.doctor]] as [string, string][]) : []),
    ...(d.quote
      ? ([
          ['Presupuesto', [d.quote.folio, d.quote.title].filter(Boolean).join(' · ')],
          ['Total del presupuesto', money(d.quote.total)],
        ] as [string, string][])
      : ([['Concepto', 'Abono a cuenta']] as [string, string][])),
  ]
  return (
    <Document title={`Comprobante ${d.folio} · ${d.patient}`} author={d.clinic.name} creator="dentro" language="es-MX">
      <Page size="LETTER" style={s.page}>
        <ClinicBand clinic={d.clinic} />
        <View style={s.body}>
          <View style={s.row}>
            <View>
              <Text style={s.muted}>Comprobante de pago de</Text>
              <Text style={s.h1}>{d.patient}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.bold}>Folio {d.folio}</Text>
              <Text style={s.muted}>{day(d.paidAt)}</Text>
            </View>
          </View>

          <View style={s.amountBox}>
            <Text style={s.muted}>Recibimos</Text>
            <Text style={[s.amount, { color: d.clinic.brandColor }]}>{money(d.amount)}</Text>
          </View>

          <View style={s.dl}>
            {rows.map(([k, v]) => (
              <View key={k} style={s.dlRow} wrap={false}>
                <Text style={s.dt}>{k}</Text>
                <Text style={s.dd}>{v}</Text>
              </View>
            ))}
          </View>

          {d.balance !== null && (
            <View style={s.box} wrap={false}>
              <Text>
                <Text style={s.bold}>Saldo restante: </Text>
                {d.balance > 0 ? money(d.balance) : 'liquidado'}
              </Text>
              <Text style={[s.muted, { marginTop: 4 }]}>Después de este pago. Cantidades en MXN.</Text>
            </View>
          )}

          <Text style={[s.muted, { marginTop: 18 }]}>Este comprobante no es una factura (CFDI).</Text>
        </View>

        <Text style={s.footer} fixed render={() => `${d.clinic.name} · Comprobante ${d.folio} · hecho con dentro`} />
      </Page>
    </Document>
  )
}

export async function renderReceiptPdf(d: ReceiptPdfData): Promise<Blob> {
  return pdf(<ReceiptDocument d={d} />).toBlob()
}
