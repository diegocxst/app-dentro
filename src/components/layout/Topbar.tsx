import { useId, useState, type FormEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useClinic } from '@/lib/clinic-context'
import { ClinicAvatar } from './ClinicAvatar'
import { NewMenu } from './NewMenu'

function SearchField({ className }: { className?: string }) {
  const id = useId()
  const onSubmit = (e: FormEvent) => e.preventDefault() // La búsqueda se conecta en E3.
  return (
    <form role="search" onSubmit={onSubmit} className={className}>
      <label
        htmlFor={id}
        className="flex h-10 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-ink-muted focus-within:outline-2 focus-within:outline-violet"
      >
        <Icon name="buscar" size={18} />
        <span className="sr-only">Buscar</span>
        <input
          id={id}
          type="search"
          placeholder="Busca pacientes, leads o presupuestos"
          className="min-w-0 grow border-0 bg-transparent text-ui text-ink outline-none placeholder:text-ink-muted"
        />
      </label>
    </form>
  )
}

function BranchSelect() {
  const clinic = useClinic()
  const [branch, setBranch] = useState(clinic.branches[0]?.id ?? '')
  const id = useId()
  return (
    <div className="relative flex h-10 shrink-0 items-center rounded-md border border-border bg-surface-raised text-ui font-medium text-ink">
      <Icon name="sucursal" size={18} className="pointer-events-none absolute left-3 text-ink-muted" />
      <label htmlFor={id} className="sr-only">
        Sucursal
      </label>
      <select
        id={id}
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        className="h-full max-w-56 cursor-pointer appearance-none truncate rounded-md border-0 bg-transparent pr-9 pl-9 outline-none"
      >
        {clinic.branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={16} strokeWidth={2} className="pointer-events-none absolute right-3 text-ink-muted" />
    </div>
  )
}

function NotificationsButton() {
  return (
    <button
      type="button"
      aria-label="Notificaciones"
      className="flex h-10 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-ink hover:bg-lavender"
    >
      <Icon name="notificaciones" />
    </button>
  )
}

/** Barra superior. Réplica de `Barra.dc.html` (escritorio) y del encabezado de `Movil-MiDia.dc.html` (móvil). */
export function Topbar() {
  const clinic = useClinic()
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface-raised">
      {/* Escritorio y tablet */}
      <div className="hidden min-h-16 items-center gap-3 px-6 py-3 md:flex lg:gap-4 lg:px-8">
        <div className="flex shrink-0 items-center gap-3 lg:hidden">
          <ClinicAvatar size="md" />
          <span className="font-display text-ui font-bold">{clinic.displayName}</span>
        </div>
        <SearchField className="max-w-120 min-w-0 flex-[1_1_200px]" />
        <div className="grow" />
        <BranchSelect />
        <NotificationsButton />
        <NewMenu variant="button" className="hidden lg:block" />
      </div>

      {/* Móvil */}
      <div className="flex flex-col gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 md:hidden">
        <div className="flex items-center gap-3">
          <ClinicAvatar size="md" />
          <div className="flex min-w-0 grow flex-col">
            <span className="truncate font-display text-ui font-bold">{clinic.displayName}</span>
            <span className="truncate text-label font-normal text-ink-muted">{clinic.branches[0]?.name}</span>
          </div>
          <NotificationsButton />
        </div>
        <SearchField />
      </div>
    </header>
  )
}
