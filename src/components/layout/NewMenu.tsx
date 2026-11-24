import { useCallback, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { NEW_ACTIONS } from '@/app/navigation'
import { Icon } from '@/components/ui/Icon'
import { useDismiss } from '@/hooks/useDismiss'
import { canSeeSection } from '@/lib/access'
import { cn } from '@/lib/cn'
import { isManager } from '@/lib/roles'
import { useWorkspace } from '@/workspace/workspace-context'

type NewMenuProps = {
  /** `button`: botón de la barra superior. `fab`: botón flotante en móvil. */
  variant: 'button' | 'fab'
  className?: string
}

/** Botón "+ Nuevo" con el menú de lo que se puede crear. */
export function NewMenu({ variant, className }: NewMenuProps) {
  const [open, setOpen] = useState(false)
  const { active } = useWorkspace()
  const actions = NEW_ACTIONS.filter((a) => (!a.managersOnly || isManager(active?.role)) && (!a.section || canSeeSection(active?.role, a.section)))
  const ref = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  const isFab = variant === 'fab'
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={isFab ? 'Nuevo' : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-center bg-violet text-on-violet transition hover:brightness-110',
          isFab ? 'size-14 rounded-[18px] shadow-fab' : 'min-h-11 gap-2 rounded-md px-4 text-ui font-semibold',
        )}
      >
        <Icon name="mas_nuevo" size={isFab ? 24 : 18} strokeWidth={isFab ? 2.2 : 2} />
        {!isFab && 'Nuevo'}
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          aria-label="Crear nuevo"
          className={cn(
            'absolute z-30 m-0 flex w-52 list-none flex-col gap-0.5 rounded-lg border border-border bg-surface-raised p-1.5 shadow-popover',
            isFab ? 'right-0 bottom-full mb-3' : 'top-full right-0 mt-2',
          )}
        >
          {actions.map((a) => (
            <li key={a.label} role="none">
              <Link
                role="menuitem"
                to={a.path}
                onClick={close}
                className="flex min-h-11 items-center gap-3 rounded-sm px-3 text-ui font-medium text-ink no-underline hover:bg-lavender"
              >
                <Icon name={a.icon} size={18} className="text-violet" />
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
