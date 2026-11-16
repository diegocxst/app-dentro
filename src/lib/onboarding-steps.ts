import type { GuideTaskId } from './onboarding'

/** Los 5 pasos del onboarding (P04) y la tarea de la guía que cumple cada uno. */
export const ONBOARDING_STEPS: readonly { task: GuideTaskId; path: string; label: string; hint: string }[] = [
  { task: 'identity', path: '/bienvenida', label: 'Identidad de tu clínica', hint: 'Nombre, logo y color de marca' },
  { task: 'branches', path: '/bienvenida/sucursales', label: 'Sucursales y sillones', hint: 'Dónde y con qué atiendes' },
  { task: 'team', path: '/bienvenida/equipo', label: 'Tu equipo', hint: 'Invita doctores y recepción' },
  { task: 'treatments', path: '/bienvenida/tratamientos', label: 'Tratamientos y precios', hint: 'Catálogo para presupuestos' },
  { task: 'whatsapp', path: '/bienvenida/whatsapp', label: 'Conecta WhatsApp y Meta', hint: 'Para recibir leads' },
]
