/* eslint-disable react-refresh/only-export-components -- módulo de PDF (no es UI de la app; no usa recarga en caliente) */
// PDF legible de la exportación ARCO. Se carga solo al exportar (import dinámico).
import { Document, Font, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { ARCO_STATUS, channelLabel, rightLabel, type PatientExport } from '@/lib/arco'
import { kindLabel } from '@/lib/documents'
import type { DocumentKind, PatientSource } from '@/lib/db'
import { sourceLabel } from '@/lib/patients'
import { formatPhone } from '@/lib/phone'

// Sin división silábica: no partir versiones de aviso, correos ni nombres.
Font.registerHyphenationCallback((word) => [word])

// Colores del tema claro del sistema "dentro" (el PDF siempre es claro).
const C = { ink: '#1C1726', muted: '#6B6478', violet: '#6A35F0', border: '#E6E2EC', soft: '#F6F4FA' }

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 40, paddingBottom: 56, fontSize: 10, color: C.ink, fontFamily: 'Helvetica', lineHeight: 1.4 },
  brand: { fontSize: 9, color: C.violet, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  title: { fontSize: 18, lineHeight: 1.25, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 4 },
  muted: { color: C.muted },
  section: { marginTop: 16 },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.border },
  row: { flexDirection: 'row', paddingVertical: 2 },
  key: { width: 130, color: C.muted },
  val: { flex: 1 },
  item: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.soft },
  // Desde arriba: con `bottom` react-pdf lo dibuja fuera de la hoja (carta = 792 pt de alto).
  footer: { position: 'absolute', top: 756, left: 40, right: 40, fontSize: 8, lineHeight: 1, color: C.muted },
})

const date = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const d = (v: string | null) => (v ? date.format(new Date(v.length === 10 ? `${v}T12:00:00` : v)) : '—')
const dt = (v: string) => dateTime.format(new Date(v))

const ACTIONS: Record<string, string> = {
  create: 'Alta',
  view: 'Consulta',
  update: 'Edición',
  archive: 'Archivo',
  unarchive: 'Reactivación',
  note: 'Nota',
  export: 'Exportación',
  upload: 'Subida',
  download: 'Descarga',
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <Text style={s.key}>{k}</Text>
      <Text style={s.val}>{v}</Text>
    </View>
  )
}

function ExportDocument({ data }: { data: PatientExport }) {
  const p = data.patient
  return (
    <Document title={`Datos de ${p.full_name}`} author={data.clinic.name} creator="dentro" language="es-MX">
      <Page size="LETTER" style={s.page}>
        <Text style={s.brand}>{data.clinic.name.toUpperCase()}</Text>
        <Text style={s.title}>Datos personales de {p.full_name}</Text>
        <Text style={s.muted}>
          Generado el {dt(data.generated_at)} a solicitud del titular (derecho de acceso). Aviso de privacidad: {data.clinic.notice_version}.
        </Text>

        <View style={s.section}>
          <Text style={s.h2}>Datos de identificación y contacto</Text>
          <Field k="Nombre" v={p.full_name} />
          <Field k="Fecha de nacimiento" v={d(p.birth_date)} />
          <Field k="Teléfono" v={p.phone_e164 ? formatPhone(p.phone_e164) : '—'} />
          <Field k="Correo" v={p.email ?? '—'} />
          <Field k="Cómo llegó" v={sourceLabel(p.source as PatientSource)} />
          <Field k="Doctor tratante" v={p.primary_doctor || 'Sin asignar'} />
          <Field k="Etiquetas" v={p.tags.length ? p.tags.join(', ') : '—'} />
          <Field k="Paciente desde" v={d(p.created_at)} />
          {p.archived_at && <Field k="Archivado" v={d(p.archived_at)} />}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Consentimientos</Text>
          {data.consents.length === 0 && <Text style={s.muted}>Sin consentimientos registrados.</Text>}
          {data.consents.map((c, i) => (
            <Text key={i} style={s.item}>
              {c.method === 'papel' ? 'Firmado en papel' : 'Aceptado en digital'} el {d(c.recorded_at)} · aviso {c.notice_version}
            </Text>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Notas del expediente ({data.notes.length})</Text>
          {data.notes.length === 0 && <Text style={s.muted}>Sin notas.</Text>}
          {data.notes.map((n, i) => (
            <View key={i} style={s.item} wrap={false}>
              <Text>{n.body}</Text>
              <Text style={s.muted}>
                {n.author || 'Equipo'} · {dt(n.created_at)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Documentos ({data.documents.length})</Text>
          {data.documents.length === 0 && <Text style={s.muted}>Sin documentos.</Text>}
          {data.documents.map((x, i) => (
            <Text key={i} style={s.item}>
              {x.name} · {kindLabel(x.kind as DocumentKind)} · {d(x.created_at)}
              {x.archived_at ? ' · archivado' : ''}
            </Text>
          ))}
          {data.documents.length > 0 && <Text style={s.muted}>Los archivos se entregan por separado.</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Solicitudes de derechos ARCO ({data.arco_requests.length})</Text>
          {data.arco_requests.length === 0 && <Text style={s.muted}>Sin solicitudes.</Text>}
          {data.arco_requests.map((r, i) => (
            <View key={i} style={s.item} wrap={false}>
              <Text>
                {rightLabel(r.right)} · {channelLabel(r.channel)} · recibida el {d(r.received_on)} · {ARCO_STATUS[r.status]}
              </Text>
              {r.response && <Text style={s.muted}>Respuesta: {r.response}</Text>}
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Quién ha consultado sus datos ({data.access_log.length})</Text>
          {data.access_log.map((a, i) => (
            <Text key={i} style={s.item}>
              {dt(a.at)} · {ACTIONS[a.action] ?? a.action} · {a.target === 'ficha' ? 'ficha' : `documento «${a.target}»`} · {a.by || 'Equipo'}
            </Text>
          ))}
        </View>

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${data.clinic.name} · Documento confidencial con datos de salud · página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  )
}

export async function renderExportPdf(data: PatientExport): Promise<Blob> {
  return pdf(<ExportDocument data={data} />).toBlob()
}
