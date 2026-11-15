import { useId, type ComponentPropsWithRef } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './Field'
import { describedBy, fieldControlClasses } from './field-styles'

type InputProps = Omit<ComponentPropsWithRef<'input'>, 'id'> & {
  label: string
  hint?: string | undefined
  error?: string | undefined
  id?: string
}

export function Input({ label, hint, error, id, className, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <Field id={inputId} label={label} hint={hint} error={error}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        className={cn(fieldControlClasses, error ? 'border-error' : 'border-border', className)}
        {...rest}
      />
    </Field>
  )
}
