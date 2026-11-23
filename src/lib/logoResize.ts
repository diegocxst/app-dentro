// Reduce el logo en el navegador (canvas) para que pese poco en el bucket, el menú y los PDF.
import { fitSize, LOGO_MAX_BYTES, LOGO_SIZE } from './logo'

const NAMES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Devuelve el archivo listo para subir: si ya pesa 1 MB o menos se queda igual;
 * si pesa más se reduce a LOGO_SIZE px. PNG y WebP conservan la transparencia.
 * Lanza un error si no se pudo dejar en 1 MB o menos.
 */
export async function prepareLogo(file: File): Promise<File> {
  if (file.size <= LOGO_MAX_BYTES) return file
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitSize(bitmap.width, bitmap.height, LOGO_SIZE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  // JPG sigue en JPG; PNG y WebP salen en PNG (con transparencia) y, si aún pesa, en WebP.
  const tries: Array<[string, number | undefined]> =
    file.type === 'image/jpeg' ? [['image/jpeg', 0.9], ['image/jpeg', 0.75]] : [['image/png', undefined], ['image/webp', 0.9]]
  for (const [type, quality] of tries) {
    const blob = await toBlob(canvas, type, quality)
    if (blob && blob.type === type && blob.size > 0 && blob.size <= LOGO_MAX_BYTES) {
      const base = file.name.replace(/\.[^.]+$/, '') || 'logo'
      return new File([blob], `${base}.${NAMES[type]}`, { type })
    }
  }
  throw new Error('too-big')
}
