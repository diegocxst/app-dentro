import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article'
  padding?: 'none' | 'sm' | 'md'
  dashed?: boolean
}

const PADDING = { none: '', sm: 'p-4', md: 'p-6' } as const

export function Card({ as: Tag = 'div', padding = 'md', dashed = false, className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-lg bg-surface-raised',
        dashed ? 'border border-dashed border-border-strong' : 'border border-border',
        PADDING[padding],
        className,
      )}
      {...rest}
    />
  )
}
