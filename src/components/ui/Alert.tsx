import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type AlertTone = 'error' | 'success' | 'warning' | 'info'

const TONES: Record<AlertTone, string> = {
  error: 'bg-error-soft text-error',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
}

/** Aviso con fondo `-soft` y texto del color del estado (AA en ambos temas). */
export function Alert({ tone = 'info', title, children, className }: { tone?: AlertTone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-md px-4 py-3 text-ui', TONES[tone], className)}>
      {title && <p className="m-0 font-semibold">{title}</p>}
      {children && <div className={cn(title && 'mt-1')}>{children}</div>}
    </div>
  )
}
