import { cn } from '@/lib/cn'

type SkeletonProps = { className?: string; label?: string }

/** Bloque de carga. Úsalo con un tamaño explícito (`h-4 w-32`, etc.). */
export function Skeleton({ className, label }: SkeletonProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('block animate-pulse rounded-sm bg-lavender motion-reduce:animate-none', className)}
    />
  )
}
