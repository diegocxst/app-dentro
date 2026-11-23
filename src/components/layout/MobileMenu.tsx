import { useEffect, useRef } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Sidebar } from './Sidebar'

type Props = { onClose: () => void }

/** Menú lateral completo en móvil y tablet: se abre con ☰ y se cierra al elegir, con Esc o tocando fuera. */
export function MobileMenu({ onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.querySelector<HTMLElement>('a[href], button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // Mantener el foco dentro del panel mientras está abierto.
      if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button')]
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      back?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-night/50" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Menú" className="absolute inset-y-0 left-0 max-w-[85vw] shadow-lg">
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={onClose}
          className="absolute top-3 right-2 z-10 flex size-11 items-center justify-center rounded-md text-on-night hover:bg-night-raised"
        >
          <Icon name="cerrar" size={20} />
        </button>
        <Sidebar label="Menú" />
      </div>
    </div>
  )
}
