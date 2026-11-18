/* eslint-disable react-refresh/only-export-components -- módulo de PDF (no es UI de la app; no usa recarga en caliente) */
// PDF del presupuesto con la identidad de la clínica (P20). Se carga solo al usarlo.
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { lineTotal, money as appMoney, planText } from '@/lib/quotes'

export type QuotePdfData = {
  clinic: { name: string; address: string; phone: string; brandColor: string; logoPng: string | null }
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

// Sin división silábica (no partir folios, correos ni nombres).
Font.registerHyphenationCallback((word) => [word])

// Tema claro del sistema "dentro" (el PDF siempre es claro). El color de marca de la
// clínica ya garantiza contraste ≥ 4.5:1 con blanco (private.ensure_brand_color).
const C = { ink: '#1C1726', muted: '#6B6478', border: '#E6E2EC', soft: '#F6F4FA', success: '#1A7A50' }
const s = StyleSheet.create({
  page: { paddingTop: 0, paddingHorizontal: 0, paddingBottom: 64, fontSize: 10, color: C.ink, fontFamily: 'Helvetica', lineHeight: 1.4 },
  band: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 40, gap: 12 },
  logo: { width: 44, height: 44, objectFit: 'contain', backgroundColor: '#FFFFFF', borderRadius: 6 },
  initials: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  clinicName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', lineHeight: 1.2 },
  clinicMeta: { fontSize: 9, color: '#FFFFFF', marginTop: 2 },
  body: { paddingHorizontal: 40, paddingTop: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: C.muted },
  h1: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  thead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4, marginTop: 18, color: C.muted, fontSize: 9 },
  tr: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.soft },
  cConcept: { flex: 1 },
  cQty: { width: 40, textAlign: 'right' },
  cPrice: { width: 80, textAlign: 'right' },
  cTotal: { width: 80, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, alignItems: 'baseline' },
  total: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  box: { marginTop: 14, padding: 12, borderRadius: 6, backgroundColor: C.soft },
  bold: { fontFamily: 'Helvetica-Bold' },
  // Desde arriba: con `bottom` react-pdf lo dibuja fuera de la hoja (carta = 792 pt).
  footer: { position: 'absolute', top: 756, left: 40, right: 40, fontSize: 8, lineHeight: 1, color: C.muted },
})

// Helvetica (WinAnsi) no trae el signo «−» (U+2212): en el PDF va el guion normal.
const money = (n: number) => appMoney(n).replace('\u2212', '-')

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
const day = (v: string) => dateFmt.format(new Date(`${v.slice(0, 10)}T12:00:00`))
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

function QuoteDocument({ d }: { d: QuotePdfData }) {
  return (
    <Document title={`Presupuesto ${d.folio} · ${d.patient}`} author={d.clinic.name} creator="dentro" language="es-MX">
      <Page size="LETTER" style={s.page}>
        <View style={[s.band, { backgroundColor: d.clinic.brandColor }]}>
          {d.clinic.logoPng ? (
            <Image src={d.clinic.logoPng} style={s.logo} />
          ) : (
            <View style={s.initials}>
              <Text style={{ color: d.clinic.brandColor, fontFamily: 'Helvetica-Bold', fontSize: 15 }}>{initialsOf(d.clinic.name)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.clinicName}>{d.clinic.name}</Text>
            {[d.clinic.address, d.clinic.phone].filter(Boolean).length > 0 && <Text style={s.clinicMeta}>{[d.clinic.address, d.clinic.phone].filter(Boolean).join(' · ')}</Text>}
          </View>
        </View>

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
