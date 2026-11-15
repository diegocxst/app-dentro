// Reglas del logo de la clínica. Deben coincidir con el bucket `tenant-branding`
// y con private.is_tenant_logo_path() (migración 20261115000400).

export const LOGO_BUCKET = 'tenant-branding'
export const LOGO_MAX_BYTES = 1024 * 1024

export const LOGO_TYPES: Record<string, 'png' | 'jpg' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/** Mensaje si el archivo no sirve como logo; `null` si está bien. */
export function logoProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!LOGO_TYPES[file.type]) return 'Usa una imagen PNG, JPG o WebP.'
  if (file.size > LOGO_MAX_BYTES) return 'El logo pesa más de 1 MB. Usa una versión más ligera.'
  if (file.size === 0) return 'El archivo está vacío.'
  return null
}

/** Ruta del logo dentro del bucket: <clínica>/logo-<id>.<ext>. */
export function logoPath(tenantId: string, file: Pick<File, 'type'>, id: string = crypto.randomUUID()): string {
  const ext = LOGO_TYPES[file.type]
  if (!ext) throw new Error('Tipo de logo no permitido')
  return `${tenantId}/logo-${id.toLowerCase()}.${ext}`
}
