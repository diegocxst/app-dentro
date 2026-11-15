import { useId, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './Field'
import { describedBy, fieldControlClasses } from './field-styles'
import { Icon } from './Icon'

export type SelectOption = { value: string; label: string; disabled?: boolean }

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> & {
  label: string
  options: readonly SelectOption[]
  placeholder?: string
  hint?: string | undefined
  error?: string | undefined
  id?: string
}

export function Select({ label, options, placeholder, hint, error, id, className, ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <Field id={selectId} label={label} hint={hint} error={error}>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(selectId, hint, error)}
          className={cn(fieldControlClasses, 'appearance-none pr-9', error ? 'border-error' : 'border-border', className)}
          {...rest}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted" />
      </div>
    </Field>
  )
}
