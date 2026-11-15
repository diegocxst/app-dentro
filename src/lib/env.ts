// Configuración pública del frontend. Nada aquí es secreto: termina en el JavaScript
// que descarga el navegador. Nunca poner la clave de servicio en variables VITE_*.
// Origen: core-base (Realt-In).

function read(name: keyof ImportMetaEnv): string {
  const v = import.meta.env[name]
  return typeof v === 'string' ? v.trim() : ''
}

export const env = {
  get supabaseUrl() {
    return read('VITE_SUPABASE_URL')
  },
  get supabasePublishableKey() {
    return read('VITE_SUPABASE_PUBLISHABLE_KEY')
  },
  /** URL base para los enlaces de correo (confirmación, recuperación, invitación). */
  get siteUrl() {
    return (read('VITE_SITE_URL') || window.location.origin).replace(/\/+$/, '')
  },
}

/** Variables faltantes, para mostrar un aviso claro en lugar de fallar en silencio. */
export function missingEnv(): string[] {
  const missing: string[] = []
  if (!env.supabaseUrl) missing.push('VITE_SUPABASE_URL')
  if (!env.supabasePublishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')
  return missing
}
