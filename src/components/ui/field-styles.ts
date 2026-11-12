export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

export const fieldControlClasses =
  'h-10 w-full rounded-sm border bg-surface-raised px-3 text-ui text-ink placeholder:text-ink-muted ' +
  'focus:outline-2 focus:outline-offset-0 focus:outline-violet disabled:opacity-50'
