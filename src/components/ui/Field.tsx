import type { ReactNode } from 'react'

type FieldProps = {
  id: string
  label: string
  hint?: string | undefined
  error?: string | undefined
  children: ReactNode
}

/** Envoltura de etiqueta + ayuda + error para campos de formulario. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ui font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
