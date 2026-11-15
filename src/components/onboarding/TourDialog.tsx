import { useEffect, useRef, useState } from 'react'

const STEPS = [
  { title: 'Aquí creas todo', text: 'Con «Nuevo» registras citas, pacientes, leads y presupuestos desde cualquier pantalla.' },
  { title: 'Tu menú', text: 'Aquí están las secciones de tu clínica. Empieza por Agenda y Pacientes.' },
  { title: 'Busca lo que sea', text: 'Escribe el nombre de un paciente o de un tratamiento y lo encuentras al instante.' },
  { title: 'Tu guía te acompaña', text: 'Marca cada paso cuando lo termines. La encuentras siempre al final del menú.' },
] as const

/** Recorrido de bienvenida de 4 pasos (mockup Main-Bienvenida). */
export function TourDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  const last = step === STEPS.length - 1
  const current = STEPS[step]!

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
    <div
      role="dialog"
      aria-label="Recorrido de bienvenida"
      aria-describedby="tour-text"
      className="fixed inset-x-4 bottom-[calc(168px+env(safe-area-inset-bottom))] z-40 flex flex-col gap-2.5 rounded-lg bg-night p-4.5 text-on-night shadow-popover md:inset-x-auto md:top-19 md:right-6 md:bottom-auto md:w-80"
    >
      <span aria-hidden="true" className="absolute -top-1.75 right-11 hidden size-3.5 rotate-45 bg-night md:block" />
      <span className="text-label text-turquoise">
        {step + 1} de {STEPS.length}
      </span>
      <strong className="font-display text-body">{current.title}</strong>
      <span id="tour-text" className="text-ui text-on-night-muted">
        {current.text}
      </span>
      <div className="mt-1 flex items-center gap-2">
        <button type="button" onClick={onClose} className="min-h-10 px-1 text-caption text-on-night-muted hover:text-on-night">
          Saltar recorrido
        </button>
        <span className="grow" />
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
  )
}
