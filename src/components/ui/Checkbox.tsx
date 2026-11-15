import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'

type CheckboxProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'id'> & {
  label: ReactNode
  error?: string | undefined
}

export function Checkbox({ label, error, ...rest }: CheckboxProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 text-ui text-ink">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-violet"
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="m-0 text-caption text-error">
          {error}
        </p>
      )}
    </div>
  )
}
