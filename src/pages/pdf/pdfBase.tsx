/* eslint-disable react-refresh/only-export-components -- piezas de PDF (no son UI de la app; no usan recarga en caliente) */
// Piezas comunes de los PDF de la clínica (presupuesto y comprobante). Se cargan solo al usarlas.
import { Font, Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import { money as appMoney } from '@/lib/quotes'

export type ClinicPdf = { name: string; address: string; phone: string; brandColor: string; logoPng: string | null }

// Sin división silábica (no partir folios, correos ni nombres).
Font.registerHyphenationCallback((word) => [word])

// Tema claro del sistema "dentro" (el PDF siempre es claro). El color de marca de la
// clínica ya garantiza contraste ≥ 4.5:1 con blanco (private.ensure_brand_color).
export const C = { ink: '#1C1726', muted: '#6B6478', border: '#E6E2EC', soft: '#F6F4FA', success: '#1A7A50' }
export const base = StyleSheet.create({
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
  box: { marginTop: 14, padding: 12, borderRadius: 6, backgroundColor: C.soft },
  bold: { fontFamily: 'Helvetica-Bold' },
  // Desde arriba: con `bottom` react-pdf lo dibuja fuera de la hoja (carta = 792 pt).
  footer: { position: 'absolute', top: 756, left: 40, right: 40, fontSize: 8, lineHeight: 1, color: C.muted },
})

// Helvetica (WinAnsi) no trae el signo «−» (U+2212): en el PDF va el guion normal.
export const money = (n: number) => appMoney(n).replace('−', '-')

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
/** Fecha sin hora («18 de noviembre de 2026») a partir de AAAA-MM-DD o de un ISO. */
export const day = (v: string) => dateFmt.format(new Date(`${v.slice(0, 10)}T12:00:00`))

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/** Franja superior con el color, el logo (o las iniciales), el nombre y los datos de la clínica. */
export function ClinicBand({ clinic }: { clinic: ClinicPdf }) {
  const meta = [clinic.address, clinic.phone].filter(Boolean)
  return (
    <View style={[base.band, { backgroundColor: clinic.brandColor }]}>
      {clinic.logoPng ? (
        <Image src={clinic.logoPng} style={base.logo} />
      ) : (
        <View style={base.initials}>
          <Text style={{ color: clinic.brandColor, fontFamily: 'Helvetica-Bold', fontSize: 15 }}>{initialsOf(clinic.name)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={base.clinicName}>{clinic.name}</Text>
        {meta.length > 0 && <Text style={base.clinicMeta}>{meta.join(' · ')}</Text>}
      </View>
    </View>
  )
}
