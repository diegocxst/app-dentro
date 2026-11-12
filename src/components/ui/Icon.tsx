import type { SVGProps } from 'react'

/** Trazos tomados de los mockups aprobados (docs/diseno/pantallas). */
const PATHS = {
  inicio: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5',
  agenda: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  leads: 'M4 13l3-8h10l3 8v6H4zM4 13h5l1 2h4l1-2h5',
  pacientes: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2 .5 3 2.5 3 5',
  presupuestos: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
  cobros: 'M3 6h18v12H3zM3 10h18M7 15h3',
  seguimientos: 'M4 4h16v16H4zM8 12l3 3 5-6',
  doctores: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21c0-4 3-6 7-6s7 2 7 6',
  crece: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  configuracion: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  ayuda: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  sucursal: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  notificaciones: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  mas_nuevo: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5 9-10',
} as const

export type IconName = keyof typeof PATHS

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName
  size?: number
  strokeWidth?: number
}

export function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
