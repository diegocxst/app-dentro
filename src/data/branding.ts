import { LOGO_BUCKET, logoPath } from '@/lib/logo'
import { supabase } from '@/lib/supabase'

/** Vigencia de las URL firmadas del logo. */
export const LOGO_URL_SECONDS = 60 * 60

/**
 * Sube el logo a Storage privado y lo asigna a la clínica (RPC). Si la asignación
 * falla, se borra el archivo recién subido para no dejar huérfanos.
 */
export async function uploadClinicLogo(tenantId: string, file: File): Promise<string> {
  const path = logoPath(tenantId, file)
  const bucket = supabase.storage.from(LOGO_BUCKET)
  const { error: upError } = await bucket.upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
  if (upError) throw upError
  const { error } = await supabase.rpc('update_tenant_identity', { p_tenant: tenantId, p_logo_path: path })
  if (error) {
    await bucket.remove([path]).catch(() => undefined)
    throw error
  }
  return path
}

/** URL temporal para mostrar el logo (el bucket es privado). */
export async function signedLogoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, LOGO_URL_SECONDS)
  if (error) return null
  return data.signedUrl
}
