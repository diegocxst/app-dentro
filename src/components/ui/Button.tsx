import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles'
import { Spinner } from './Spinner'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  /** Ocupa todo el ancho. */
  block?: boolean
  /** Muestra un indicador y desactiva el botón mientras dura la acción. */
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  block = false,
  loading = false,
  className,
  type = 'button',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className, block)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
    </button>
  )
}
