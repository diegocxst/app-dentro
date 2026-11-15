import { createClient } from '@supabase/supabase-js'
import { withAuthDiag } from './authDiag'
import type { Database } from './database.types'
import { env, missingEnv } from './env'

// Si faltan variables se crea un cliente que nunca se usa: App muestra antes la
// pantalla de configuración incompleta. Solo la clave PUBLISHABLE (D1).
const configured = missingEnv().length === 0

export const supabase = createClient<Database>(
  configured ? env.supabaseUrl : 'http://localhost.invalid',
  configured ? env.supabasePublishableKey : 'missing',
  {
    // Solo en desarrollo: estado HTTP y código de error de Auth en la consola (sin datos).
    ...(import.meta.env.DEV ? { global: { fetch: withAuthDiag(fetch.bind(globalThis)) } } : {}),
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
