type Props = { displayName: string; ownerLine: string; initials: string; color: string; logoUrl?: string | null }

const Mark = ({ initials, color, className, logoUrl }: { initials: string; color: string; className: string; logoUrl?: string | null | undefined }) =>
  logoUrl ? (
    <img src={logoUrl} alt="" aria-hidden="true" className={`shrink-0 bg-white object-contain p-0.5 ${className}`} />
  ) : (
    <div aria-hidden="true" className={`flex shrink-0 items-center justify-center font-display font-extrabold text-white ${className}`} style={{ backgroundColor: color }}>
      {initials}
    </div>
  )

// El PDF y la burbuja de WhatsApp son blancos en la vida real: se muestran en claro en ambos temas.
const PAPER = { backgroundColor: '#FFFFFF', color: '#1C1726' } as const

/** Vista previa en vivo: menú, PDF de presupuesto y mensaje al paciente. Sin datos de ejemplo. */
export function IdentityPreview({ displayName, ownerLine, initials, color, logoUrl }: Props) {
  const name = displayName.trim() || 'Tu clínica'
  return (
    <aside aria-label="Vista previa" className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
      <span className="text-label tracking-[0.06em] text-ink-muted uppercase">Vista previa en vivo</span>
      <div className="flex flex-wrap gap-3.5">
        <div className="flex min-h-55 flex-[1_1_170px] flex-col gap-2.5 rounded-lg bg-night p-4 text-on-night">
          <Mark logoUrl={logoUrl} initials={initials} color={color} className="size-10 rounded-md text-ui" />
          <strong className="font-display text-ui break-words">{name}</strong>
          <span className="text-micro text-on-night-muted">{ownerLine || 'Responsable · Cargo'}</span>
          <div aria-hidden="true" className="mt-1.5 flex flex-col gap-1.5">
            <span className="h-2 w-[70%] rounded-pill bg-night-active" />
            <span className="h-2 w-[55%] rounded-pill bg-night-active" />
            <span className="h-2 w-[62%] rounded-pill bg-night-active" />
          </div>
          <span className="grow" />
          <span className="text-[10px] text-on-night-muted">Menú · Hecho con dentro</span>
        </div>
        <div className="flex min-h-55 flex-[1_1_170px] flex-col gap-2.5 rounded-lg border border-border p-4" style={PAPER}>
          <div className="flex items-center gap-2">
            <Mark logoUrl={logoUrl} initials={initials} color={color} className="size-7 rounded-sm text-[10px]" />
            <strong className="text-label break-words">{name}</strong>
          </div>
          <span aria-hidden="true" className="h-2.5 w-3/4 rounded-sm bg-[#F0EBFF]" />
          <span aria-hidden="true" className="h-4 w-1/2 rounded-sm bg-[#F0EBFF]" />
          <span className="grow" />
          <span className="flex min-h-8 items-center justify-center rounded-sm text-micro font-semibold text-white" style={{ backgroundColor: color }}>
            Pagar anticipo
          </span>
          <span className="text-[10px] text-[#5E5869]">PDF del presupuesto</span>
        </div>
      </div>
      <div className="rounded-lg bg-lavender p-3.5">
        <div className="max-w-80 rounded-[14px_14px_14px_4px] px-3 py-2.5 text-caption" style={PAPER}>
          Hola. Te recordamos tu cita de mañana a las 10:00.
          <br />
          <strong style={{ color }}>{name}</strong>
        </div>
        <span className="mt-1.5 block text-[10px] text-ink-muted">Mensaje de WhatsApp a tu paciente</span>
      </div>
    </aside>
  )
}
