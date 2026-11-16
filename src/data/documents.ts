import type { DocumentKind, Tables } from '@/lib/db'
import { documentExt, documentPath, DOCUMENTS_BUCKET } from '@/lib/documents'
import { supabase } from '@/lib/supabase'

export type PatientDocument = Tables<'patient_documents'>

/** Lista de documentos (sin contenido). RLS: solo quien ve al paciente. */
export async function listDocuments(patientId: string): Promise<PatientDocument[]> {
  const { data, error } = await supabase.from('patient_documents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PatientDocument[]
}

/** Sube el archivo a Storage privado y lo registra (queda en la bitácora). */
export async function uploadDocument(input: { tenantId: string; patientId: string; file: File; kind: DocumentKind; name: string }): Promise<PatientDocument> {
  const ext = documentExt(input.file)
  if (!ext) throw Object.assign(new Error('Tipo no permitido'), { code: 'type' })
  const path = documentPath(input.tenantId, input.patientId, ext)
  const { error: upError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, input.file, {
    contentType: ext === 'stl' ? 'model/stl' : input.file.type,
    upsert: false,
  })
  if (upError) throw upError
  const { data, error } = await supabase.rpc('register_document', { p_patient: input.patientId, p_kind: input.kind, p_name: input.name, p_storage_path: path })
  if (error) throw error
  return data as PatientDocument
}

export class DocumentLinkError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** Enlace firmado de 60 s (Edge Function document-url: revisa permiso y registra el acceso). */
export async function documentLink(documentId: string, action: 'view' | 'download'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('document-url', { body: { document_id: documentId, action } })
  if (!error && (data as { status?: string; url?: string })?.url) return (data as { url: string }).url
  const ctx = (error as { context?: Response } | null)?.context
  const body = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => null)) as { code?: string; message?: string } | null) : null
  throw new DocumentLinkError(body?.code ?? 'network', body?.message ?? 'No pudimos abrir el documento. Revisa tu conexión.')
}

export async function setDocumentArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_document_archived', { p_document: id, p_archived: archived })
  if (error) throw error
}
