import { useId, useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { logoProblem } from '@/lib/logo'

type Props = {
  file: File | null
  /** URL local para previsualizar `file`. */
  previewUrl: string | null
  onChange: (file: File | null) => void
  initials: string
  color: string
}

/** Bloque «Logo» del mockup: arrastrar o subir; si no hay, iniciales sobre el color. */
export function LogoPicker({ file, previewUrl: preview, onChange, initials, color }: Props) {
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const pick = (f: File | undefined) => {
    if (!f) return
    const problem = logoProblem(f)
    setError(problem)
    if (!problem) onChange(f)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-wrap items-center gap-4 rounded-md border border-dashed bg-surface-raised p-4',
          dragging ? 'border-violet bg-lavender' : 'border-border-strong',
        )}
      >
        {preview ? (
          <img src={preview} alt="Logo elegido" className="size-16 shrink-0 rounded-lg bg-white object-contain p-1" />
        ) : (
          <div
            role="img"
            aria-label="Logo actual"
            className="flex size-16 shrink-0 items-center justify-center rounded-lg font-display text-[22px] font-extrabold text-white"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
        )}
        <div className="flex min-w-0 flex-[1_1_140px] flex-col gap-1">
          <span className="truncate text-ui font-semibold">{file ? file.name : 'Arrastra tu logo o súbelo'}</span>
          <span className="text-label font-normal text-ink-muted">PNG, JPG o WebP de hasta 1 MB. Si aún no tienes, usamos tus iniciales.</span>
          {file && (
            <button type="button" onClick={() => onChange(null)} className="self-start text-caption font-semibold text-violet hover:underline">
              Quitar logo
            </button>
          )}
        </div>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Subir logo"
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <Button variant="secondary" onClick={() => input.current?.click()}>
          {file ? 'Cambiar' : 'Subir'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="m-0 text-caption text-error">
          {error}
        </p>
      )}
    </div>
  )
}
