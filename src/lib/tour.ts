// Reglas puras del recorrido de bienvenida: dónde poner la tarjeta junto al elemento que explica.

export type Box = { top: number; left: number; width: number; height: number }
export type Size = { width: number; height: number }

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))

/**
 * Posición de la tarjeta (top/left en px de la ventana) junto a `target`:
 * abajo, arriba, a la derecha o a la izquierda, lo primero que quepa.
 * Si no cabe en ningún lado, abajo al centro de la pantalla.
 */
export function placeCard(target: Box, card: Size, view: Size, gap = 12, margin = 16): { top: number; left: number; side: 'abajo' | 'arriba' | 'derecha' | 'izquierda' | 'centro' } {
  const bottom = target.top + target.height
  const right = target.left + target.width
  const centerX = clamp(target.left + target.width / 2 - card.width / 2, margin, view.width - card.width - margin)
  const centerY = clamp(target.top + target.height / 2 - card.height / 2, margin, view.height - card.height - margin)
  if (bottom + gap + card.height <= view.height - margin) return { top: bottom + gap, left: centerX, side: 'abajo' }
  if (target.top - gap - card.height >= margin) return { top: target.top - gap - card.height, left: centerX, side: 'arriba' }
  if (right + gap + card.width <= view.width - margin) return { top: centerY, left: right + gap, side: 'derecha' }
  if (target.left - gap - card.width >= margin) return { top: centerY, left: target.left - gap - card.width, side: 'izquierda' }
  return { top: view.height - card.height - margin, left: clamp(view.width / 2 - card.width / 2, margin, view.width - card.width - margin), side: 'centro' }
}
