import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Archivo elegido + su URL local (blob:) para previsualizarlo. La URL se crea al
 * elegir (no en un efecto) y se libera al cambiar de archivo o al desmontar.
 */
export function useFilePreview(): [{ file: File; url: string } | null, (file: File | null) => void] {
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null)
  const latest = useRef<string | null>(null)

  const set = useCallback((file: File | null) => {
    if (latest.current) URL.revokeObjectURL(latest.current)
    const next = file ? { file, url: URL.createObjectURL(file) } : null
    latest.current = next?.url ?? null
    setPicked(next)
  }, [])

  useEffect(
    () => () => {
      if (latest.current) URL.revokeObjectURL(latest.current)
    },
    [],
  )

  return [picked, set]
}
