import { describe, expect, it } from 'vitest'
import { placeCard } from './tour'

const card = { width: 320, height: 160 }
const desktop = { width: 1280, height: 800 }
const phone = { width: 375, height: 812 }

describe('recorrido · posición de la tarjeta', () => {
  it('debajo del botón «Nuevo» de la barra superior, sin salirse a la derecha', () => {
    expect(placeCard({ top: 12, left: 1150, width: 110, height: 40 }, card, desktop)).toEqual({ top: 64, left: 944, side: 'abajo' })
  })

  it('a la derecha del menú lateral (ocupa todo el alto)', () => {
    expect(placeCard({ top: 0, left: 0, width: 248, height: 800 }, card, desktop)).toEqual({ top: 320, left: 260, side: 'derecha' })
  })

  it('arriba del botón flotante en el celular', () => {
    expect(placeCard({ top: 660, left: 303, width: 56, height: 56 }, card, phone)).toEqual({ top: 488, left: 39, side: 'arriba' })
  })

  it('si no cabe en ningún lado, abajo al centro', () => {
    expect(placeCard({ top: 0, left: 0, width: 375, height: 812 }, card, phone)).toEqual({ top: 636, left: 27.5, side: 'centro' })
  })
})
