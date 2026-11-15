import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-4 animate-spin rounded-pill border-2 border-current border-r-transparent motion-reduce:animate-none', className)}
    />
  )
}

/** Carga de pantalla completa (sesión, enlaces de correo). */
export function FullPageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface text-ink-muted">
      <Spinner className="size-6 text-violet" />
      <span className="text-ui">{label}</span>
    </div>
  )
}
