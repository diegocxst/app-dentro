import { useCallback, useState } from 'react'
import { downloadBlob, whatsappUrl } from '@/lib/quoteShare'

/** ¿El navegador puede compartir archivos (celular)? Si no, se descarga y se abre WhatsApp. */
function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })
  } catch {
    return false
  }
}

export type ShareResult = { cancelled: true } | { cancelled: false; attachHint: string }

/**
 * Envía un PDF por WhatsApp desde el teléfono de la clínica (sin enlaces públicos):
 * en celular abre el menú de compartir con el archivo; en computadora lo descarga y
 * abre WhatsApp con el mensaje listo para adjuntarlo.
 */
export function useShareFile() {
  const [mobile] = useState(canShareFiles)
  const share = useCallback(
    async (opts: { file: File | null; phone: string | null; message: string }): Promise<ShareResult> => {
      const { file, phone, message } = opts
      if (file && mobile) {
        try {
          await navigator.share({ files: [file], text: message })
        } catch (e) {
          if ((e as { name?: string }).name === 'AbortError') return { cancelled: true } // canceló el menú de compartir
          throw e
        }
        return { cancelled: false, attachHint: '' }
      }
      if (file) downloadBlob(file, file.name)
      window.open(whatsappUrl(phone, message), '_blank', 'noopener')
      return { cancelled: false, attachHint: file ? `Descargamos «${file.name}». Adjúntalo en el chat de WhatsApp que se abrió.` : '' }
    },
    [mobile],
  )
  return { mobile, share }
}
