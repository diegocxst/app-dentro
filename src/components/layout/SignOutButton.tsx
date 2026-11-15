import { useState } from 'react'
import { useAuth } from '@/auth/auth-context'
import { cn } from '@/lib/cn'

/** Cierra la sesión. `tone="night"` para el menú lateral; `surface` para fondos claros. */
export function SignOutButton({ tone = 'surface', className }: { tone?: 'night' | 'surface'; className?: string }) {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void signOut().finally(() => setBusy(false))
      }}
      className={cn(
        'flex min-h-11 items-center rounded-nav px-3 text-caption font-semibold disabled:opacity-60',
        tone === 'night' ? 'text-on-night-muted hover:bg-night-raised hover:text-on-night' : 'text-ink-muted hover:bg-lavender hover:text-ink',
        className,
      )}
    >
      {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </button>
  )
}
