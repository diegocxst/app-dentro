import type { DocumentKind } from './db'

// Reglas de documentos del paciente. Deben coincidir con el bucket `patient-documents`
// y con private.is_document_path() (migración 20261116000500).

export const DOCUMENTS_BUCKET = 'patient-documents'
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024

export const DOCUMENT_KINDS: readonly { value: DocumentKind; label: string }[] = [
  { value: 'radiografia', label: 'Radiografía' },
  { value: 'foto', label: 'Fotografía' },
  { value: 'consentimiento', label: 'Consentimiento' },
  { value: 'receta', label: 'Receta' },
  { value: 'formulario', label: 'Historia clínica o formulario' },
  { value: 'presupuesto', label: 'Presupuesto' },
  { value: 'modelo', label: 'Modelo 3D' },
  { value: 'otro', label: 'Otro' },
]
export const kindLabel = (k: DocumentKind) => DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? 'Otro'

const BY_MIME: Record<string, 'pdf' | 'jpg' | 'png' | 'webp'> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Extensión permitida del archivo (STL por nombre: los navegadores no le dan tipo fijo). */
export function documentExt(file: Pick<File, 'type' | 'name'>): 'pdf' | 'jpg' | 'png' | 'webp' | 'stl' | null {
  if (BY_MIME[file.type]) return BY_MIME[file.type]!
  if (/\.stl$/i.test(file.name)) return 'stl'
  return null
}

export function documentProblem(file: Pick<File, 'type' | 'name' | 'size'>): string | null {
  if (!documentExt(file)) return 'Usa PDF, JPG, PNG, WebP o STL.'
  if (file.size > DOCUMENT_MAX_BYTES) return 'El archivo pesa más de 25 MB.'
  if (file.size === 0) return 'El archivo está vacío.'
  return null
}

/** Ruta en el bucket: <clínica>/<paciente>/<uuid>.<ext>. */
export function documentPath(tenantId: string, patientId: string, ext: string, id: string = crypto.randomUUID()): string {
  return `${tenantId}/${patientId}/${id.toLowerCase()}.${ext}`
}

/** Nombre sugerido: el del archivo sin extensión. */
export function suggestedName(file: Pick<File, 'name'>): string {
  return file.name.replace(/\.[^.]+$/, '').slice(0, 160) || 'Documento'
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
