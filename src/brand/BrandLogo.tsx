import { cn } from '@/lib/cn'

/**
 * Logotipo horizontal de dentro. Sobre fondos claros usa la versión a color y en
 * tema oscuro la negativa (regla de marca: nunca el logo sobre fondos sin contraste).
 * `variant="negative"` fuerza la negativa (p. ej. sobre `night`).
 */
export function BrandLogo({ width = 128, variant = 'auto', className }: { width?: number; variant?: 'auto' | 'negative'; className?: string }) {
  const height = Math.round((width * 291) / 974)
  const common = { alt: 'dentro', width, height, style: { width, height: 'auto' } } as const
  if (variant === 'negative') {
    return <img src="/brand/dentro-horizontal-negativo.svg" className={cn('block', className)} {...common} />
  }
  return (
    <>
      <img src="/brand/dentro-horizontal-color.svg" className={cn('brand-logo-light block', className)} {...common} />
      <img src="/brand/dentro-horizontal-negativo.svg" className={cn('brand-logo-dark hidden', className)} {...common} alt="" aria-hidden="true" />
    </>
  )
}
