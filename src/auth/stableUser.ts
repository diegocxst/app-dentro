import type { User } from '@supabase/supabase-js'

/**
 * Mismo usuario ⇒ mismo objeto. supabase-js vuelve a emitir SIGNED_IN y
 * TOKEN_REFRESHED con un `user` NUEVO cada vez que la pestaña vuelve a estar
 * visible; si la identidad cambiara, la app recargaría la clínica y se perdería
 * lo escrito sin guardar (bug del iPhone en Realt-In, 2026-10-27).
 */
export function stableUser(prev: User | null, next: User | null): User | null {
  if (prev && next && prev.id === next.id && prev.updated_at === next.updated_at && prev.email === next.email) return prev
  return next
}
