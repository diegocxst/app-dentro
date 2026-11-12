import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-violet text-on-violet hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-raised text-ink border border-border hover:bg-lavender',
  ghost: 'bg-transparent text-ink hover:bg-lavender',
  danger: 'bg-error text-white hover:brightness-110',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 text-ui',
  md: 'min-h-11 px-4 text-ui',
  lg: 'min-h-12 px-5 text-body',
}

/** Clases compartidas para usar el estilo de botón en enlaces. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold no-underline transition',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}
