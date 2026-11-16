import type { IconName } from '@/components/ui/Icon'

export type SectionId =
  | 'inicio'
  | 'agenda'
  | 'leads'
  | 'pacientes'
  | 'presupuestos'
  | 'cobros'
  | 'seguimientos'
  | 'doctores'
  | 'crece'
  | 'configuracion'

export type Section = {
  id: SectionId
  label: string
  path: string
  icon: IconName
  /** Texto del estado vacío de la página. */
  empty: { title: string; description: string }
}

/** Las 10 secciones del menú, en el orden del mockup `Menu.dc.html`. */
export const SECTIONS: readonly Section[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    path: '/',
    icon: 'inicio',
    empty: {
      title: 'Tu negocio, por dentro',
      description: 'Aquí verás lo cobrado, los presupuestos por cerrar, las citas de hoy y los leads nuevos en cuanto empieces a registrarlos.',
    },
  },
  {
    id: 'agenda',
    label: 'Agenda',
    path: '/agenda',
    icon: 'agenda',
    empty: {
      title: 'Tu agenda está vacía',
      description: 'Aquí verás las citas por doctor y sillón. Agenda tu primera cita y aparecerá en este espacio.',
    },
  },
  {
    id: 'leads',
    label: 'Leads',
    path: '/leads',
    icon: 'leads',
    empty: {
      title: 'Aún no tienes leads',
      description: 'Los interesados que lleguen por Meta, tu perfil público o que registres a mano se ordenan aquí por etapa.',
    },
  },
  {
    id: 'pacientes',
    label: 'Pacientes',
    path: '/pacientes',
    icon: 'pacientes',
    empty: {
      title: 'Aún no tienes pacientes',
      description: 'Registra a tu primer paciente o importa tu lista. Aquí tendrás su ficha, citas, presupuestos y documentos.',
    },
  },
  {
    id: 'presupuestos',
    label: 'Presupuestos',
    path: '/presupuestos',
    icon: 'presupuestos',
    empty: {
      title: 'Aún no tienes presupuestos',
      description: 'Crea un presupuesto con el PDF de tu clínica y dale seguimiento hasta que se acepte.',
    },
  },
  {
    id: 'cobros',
    label: 'Cobros',
    path: '/cobros',
    icon: 'cobros',
    empty: {
      title: 'Aún no hay cobros',
      description: 'Cuando registres un pago o envíes un link de pago, lo verás aquí. El dinero va directo a la cuenta de tu clínica.',
    },
  },
  {
    id: 'seguimientos',
    label: 'Seguimientos',
    path: '/seguimientos',
    icon: 'seguimientos',
    empty: {
      title: 'No tienes seguimientos pendientes',
      description: 'Aquí aparecerán las tareas para que ningún presupuesto se pierda y ningún paciente se olvide.',
    },
  },
  {
    id: 'doctores',
    label: 'Doctores',
    path: '/doctores',
    icon: 'doctores',
    empty: {
      title: 'Aún no hay doctores',
      description: 'Invita a tu equipo. Cada doctor ve solo sus pacientes, su agenda y sus comisiones.',
    },
  },
  {
    id: 'crece',
    label: 'Crece tu clínica',
    path: '/crece',
    icon: 'crece',
    empty: {
      title: 'Crece tu clínica',
      description: 'Aquí encontrarás servicios para atraer más pacientes. Muy pronto verás el catálogo.',
    },
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    path: '/configuracion',
    icon: 'configuracion',
    empty: {
      title: 'Configura tu clínica',
      description: 'Identidad, sucursales, sillones, tratamientos y precios. Lo que ajustes aquí se usa en toda la app.',
    },
  },
]

export const GUIDE_PATH = '/guia'
export const MORE_PATH = '/mas'

/** Pestañas de la barra inferior en móvil: Inicio · Agenda · Pacientes · Leads · Más. */
export const MOBILE_TAB_IDS: readonly SectionId[] = ['inicio', 'agenda', 'pacientes', 'leads']

/** Opciones del botón "+ Nuevo" (llevan a la sección donde se creará cada cosa). */
export const NEW_ACTIONS: readonly { label: string; path: string; icon: IconName }[] = [
  { label: 'Cita', path: '/agenda', icon: 'agenda' },
  { label: 'Paciente', path: '/pacientes/nuevo', icon: 'pacientes' },
  { label: 'Lead', path: '/leads', icon: 'leads' },
  { label: 'Presupuesto', path: '/presupuestos', icon: 'presupuestos' },
]

export function sectionById(id: SectionId): Section {
  const s = SECTIONS.find((x) => x.id === id)
  if (!s) throw new Error(`Sección desconocida: ${id}`)
  return s
}
