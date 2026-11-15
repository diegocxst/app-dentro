import { useClinic } from '@/lib/clinic-context'
import { cn } from '@/lib/cn'

/** Logo de la clínica o, si no hay, sus iniciales sobre `brand_color` (ya validado por contraste). */
export function ClinicAvatar({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  const clinic = useClinic()
  const box = size === 'lg' ? 'size-13 rounded-[14px] text-[18px]' : 'size-10 rounded-md text-ui'
  if (clinic.logoUrl) {
    return <img src={clinic.logoUrl} alt={`Logo de ${clinic.displayName}`} className={cn(box, 'bg-white object-contain p-1')} />
  }
  return (
    <div
      role="img"
      aria-label={`Logo de ${clinic.displayName}`}
      className={cn(box, 'flex shrink-0 items-center justify-center font-display font-extrabold tracking-[0.02em] text-white')}
      style={{ backgroundColor: clinic.brand.color }}
    >
      <span aria-hidden="true">{clinic.initials}</span>
    </div>
  )
}
