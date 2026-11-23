import { money, monthly } from '@/lib/quotes'

/** Mensaje de WhatsApp (maqueta P20). La clínica lo envía desde su teléfono. */
export function quoteMessage(q: { patient: string; title: string; doctor: string; total: number; downPayment: number; installments: number; clinic: string }): string {
  const first = q.patient.trim().split(/\s+/)[0] ?? ''
  // «Presupuesto de ortodoncia» → no repetir «presupuesto de presupuesto…».
  const title = q.title.trim().toLowerCase().replace(/^presupuesto( de)?\s*/, '')
  const what = title ? `de ${title}` : ''
  const withDoctor = q.doctor.trim() ? ` con ${q.doctor.trim()}` : ''
  const intro = `Hola, ${first}. Te comparto tu presupuesto ${what}${withDoctor} en ${q.clinic}.`.replace(/\s+/g, ' ').replace(' .', '.')
  if (q.installments > 0) {
    const m = monthly(q.total, q.downPayment, q.installments)
    const apartar = q.downPayment > 0 ? `Puedes apartar tu lugar con un anticipo de ${money(q.downPayment)} y pagar el resto` : 'Puedes pagarlo'
    return `${intro} ${apartar} en ${q.installments} mensualidades de ${money(m)}.`
  }
  return `${intro} El total es de ${money(q.total)}.`
}

/** Nombre de archivo sin acentos ni signos raros: «Presupuesto P-0142 Laura Mendez.pdf». */
function pdfFileName(kind: string, folio: string, patient: string): string {
  const clean = patient
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60)
  return `${kind} ${folio}${clean ? ` ${clean}` : ''}.pdf`
}

export const quoteFileName = (folio: string, patient: string) => pdfFileName('Presupuesto', folio, patient)
export const receiptFileName = (folio: string, patient: string) => pdfFileName('Comprobante', folio, patient)

export const whatsappUrl = (phoneE164: string | null, text: string) =>
  phoneE164 ? `https://wa.me/${phoneE164.replace('+', '')}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`

/** Logo (PNG, JPG o WebP firmado) → PNG en data URL para el PDF. `null` si no se puede. */
export async function logoToPng(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    const bmp = await createImageBitmap(blob)
    const size = 256
    const scale = Math.min(size / bmp.width, size / bmp.height, 1)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
