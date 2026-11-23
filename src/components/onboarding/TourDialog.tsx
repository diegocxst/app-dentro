import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { placeCard } from '@/lib/tour'

type Step = { target: string; title: string; text: string; mobileText?: string }

const STEPS: readonly Step[] = [
  { target: 'nuevo', title: 'Aquí creas todo', text: 'Con «Nuevo» registras citas, pacientes, leads y presupuestos desde cualquier pantalla.' },
  {
    target: 'menu',
    title: 'Tu menú',
    text: 'Aquí están las secciones de tu clínica. Empieza por Agenda y Pacientes.',
    mobileText: 'Toca este botón para ver todas las secciones de tu clínica. Abajo tienes las que más usas.',
  },
  { target: 'buscar', title: 'Busca lo que sea', text: 'Escribe el nombre de un paciente o de un tratamiento y lo encuentras al instante.' },
  {
    target: 'guia',
    title: 'Tu guía te acompaña',
    text: 'Marca cada paso cuando lo termines. La encuentras siempre al final del menú.',
    mobileText: 'Marca cada paso cuando lo termines. La encuentras siempre al final del menú (botón ☰).',
  },
]

/** Primer elemento visible marcado con `data-tour` que contiene `token`. */
function findTarget(token: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour~="${token}"]`)
  return [...all].find((el) => el.getClientRects().length > 0) ?? null
}

/** Recorrido de bienvenida de 4 pasos: resalta la parte real de la app que explica cada paso. */
export function TourDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [desktop] = useState(() => window.matchMedia?.('(min-width: 1024px)').matches ?? true)
  const nextRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  // La primera vez la tarjeta aparece ya en su lugar; entre pasos se desliza.
  const placed = useRef(false)
  const last = step === STEPS.length - 1
  const current = STEPS[step]!
  const text = !desktop && current.mobileText ? current.mobileText : current.text

  // Coloca la tarjeta junto al elemento y lo resalta (sin estado: se escribe directo en el estilo).
  useLayoutEffect(() => {
    const place = () => {
      const card = cardRef.current
      const spot = spotRef.current
      if (!card || !spot) return
      if (!placed.current) {
        placed.current = true
        card.style.transition = spot.style.transition = 'none'
        requestAnimationFrame(() => requestAnimationFrame(() => (card.style.transition = spot.style.transition = '')))
      }
      card.style.visibility = 'visible'
      const view = { width: window.innerWidth, height: window.innerHeight }
      const size = { width: card.offsetWidth, height: card.offsetHeight }
      const el = findTarget(current.target)
      if (!el) {
        spot.style.display = 'none'
        const pos = placeCard({ top: 0, left: 0, width: view.width, height: view.height }, size, view)
        Object.assign(card.style, { top: `${pos.top}px`, left: `${pos.left}px` })
        return
      }
      const r = el.getBoundingClientRect()
      const pad = 6
      Object.assign(spot.style, {
        display: 'block',
        top: `${r.top - pad}px`,
        left: `${r.left - pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
      })
      const pos = placeCard({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 }, size, view)
      Object.assign(card.style, { top: `${pos.top}px`, left: `${pos.left}px` })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [current.target, text])

  useEffect(() => {
    nextRef.current?.focus()
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div
        ref={spotRef}
        aria-hidden="true"
        className="pointer-events-none fixed z-40 hidden rounded-md outline-2 outline-turquoise transition-all duration-200 motion-reduce:transition-none"
        style={{ boxShadow: '0 0 0 9999px rgb(30 18 64 / 0.45)' }}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-label="Recorrido de bienvenida"
        aria-describedby="tour-text"
        style={{ visibility: 'hidden' }}
        className="fixed top-4 left-4 z-50 flex w-[min(320px,calc(100vw-32px))] flex-col gap-2.5 rounded-lg bg-night p-4.5 text-on-night shadow-popover transition-[top,left] duration-200 motion-reduce:transition-none"
      >
        <span className="text-label text-turquoise">
          {step + 1} de {STEPS.length}
        </span>
        <strong className="font-display text-body">{current.title}</strong>
        <span id="tour-text" className="text-ui text-on-night-muted">
          {text}
        </span>
        <div className="mt-1 flex items-center gap-2">
          <button type="button" onClick={onClose} className="min-h-10 px-1 text-caption text-on-night-muted hover:text-on-night">
            Saltar recorrido
          </button>
          <span className="grow" />
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-10 px-2 text-ui font-semibold text-on-night-muted hover:text-on-night">
              Atrás
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={() => (last ? onClose() : setStep((s) => s + 1))}
            className="min-h-10 rounded-nav bg-white px-4 text-ui font-semibold text-[#1E1240]"
          >
            {last ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </>
  )
}
