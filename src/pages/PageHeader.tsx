import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: string; title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4 lg:mb-8">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
        {eyebrow && <span className="text-label tracking-[0.06em] text-ink-muted uppercase">{eyebrow}</span>}
        <h1 className="m-0 text-[22px] leading-7 font-bold md:text-title">{title}</h1>
      </div>
      {actions}
    </div>
  )
}
