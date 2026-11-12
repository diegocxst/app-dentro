import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'violet' | 'automatic' | 'growth' | 'success' | 'warning' | 'error' | 'info'

/**
 * Píldora de estado: fondo `-soft` + texto del color del estado (AA ≥ 4.5:1 en ambos temas).
 * `automatic` usa texto `ink` con punto turquesa porque `turquoise-text` sobre `turquoise-soft`
 * no llega a 4.5:1 en tema claro (4.26:1).
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface text-ink-muted border border-border',
  violet: 'bg-lavender text-violet',
  automatic: 'bg-turquoise-soft text-ink',
  growth: 'bg-orange-soft text-orange-text',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  error: 'bg-error-soft text-error',
  info: 'bg-info-soft text-info',
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }

export function Badge({ tone = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-label font-semibold', TONES[tone], className)}
      {...rest}
    >
      {tone === 'automatic' && <span aria-hidden="true" className="size-1.5 rounded-pill bg-turquoise" />}
      {children}
    </span>
  )
}
