import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type EmptyStateProps = {
  icon?: IconName
  title: string
  description: string
  action?: ReactNode
  headingLevel?: 'h1' | 'h2'
}

/** Estado vacío explicativo: dice qué va aquí y qué sigue. */
export function EmptyState({ icon, title, description, action, headingLevel: H = 'h2' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border-strong bg-surface-raised px-6 py-12 text-center">
      {icon && (
        <span className="flex size-14 items-center justify-center rounded-lg bg-lavender text-violet">
          <Icon name={icon} size={26} />
        </span>
      )}
      <div className="flex max-w-md flex-col gap-2">
        <H className="m-0 text-subtitle text-ink">{title}</H>
        <p className="m-0 text-ui text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  )
}
