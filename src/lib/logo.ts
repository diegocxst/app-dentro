// Reglas del logo de la clínica. Deben coincidir con el bucket `tenant-branding`
// y con private.is_tenant_logo_path() (migración 20261115000400).

export const LOGO_BUCKET = 'tenant-branding'
/** Lo que acepta el bucket. Los archivos más pesados se reducen en el navegador antes de subir. */
export const LOGO_MAX_BYTES = 1024 * 1024
/** Lo más pesado que se puede elegir (se reduce a LOGO_SIZE px). */
export const LOGO_INPUT_MAX_BYTES = 20 * 1024 * 1024
/** Lado mayor del logo reducido, en px. */
export const LOGO_SIZE = 512

export const LOGO_TYPES: Record<string, 'png' | 'jpg' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/** Mensaje si el archivo no sirve como logo; `null` si está bien. */
export function logoProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!LOGO_TYPES[file.type]) return 'Usa una imagen PNG, JPG o WebP.'
  if (file.size > LOGO_INPUT_MAX_BYTES) return 'El logo pesa más de 20 MB. Usa una versión más ligera.'
  if (file.size === 0) return 'El archivo está vacío.'
  return null
}

/** Lado mayor y alto/ancho de destino para que el lado mayor mida como mucho `max`. */
export function fitSize(width: number, height: number, max: number = LOGO_SIZE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Ruta del logo dentro del bucket: <clínica>/logo-<id>.<ext>. */
export function logoPath(tenantId: string, file: Pick<File, 'type'>, id: string = crypto.randomUUID()): string {
  const ext = LOGO_TYPES[file.type]
  if (!ext) throw new Error('Tipo de logo no permitido')
  return `${tenantId}/logo-${id.toLowerCase()}.${ext}`
}
