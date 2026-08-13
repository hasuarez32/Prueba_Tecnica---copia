/**
 * Contraste del mapa de calor semanal.
 *
 * La celda mezcla el color de relleno con el fondo de la tarjeta según la
 * intensidad, así que la tinta tiene que ser legible en TODA la rampa, no sólo
 * en el extremo lleno. Con el cyan brillante en tema oscuro la celda llena
 * quedaba en 1,18:1 —el número era invisible— y las intermedias no llegaban a
 * AA con ninguna tinta disponible.
 *
 * Estas pruebas fijan los tokens elegidos: si alguien los cambia por un color
 * que rompa la legibilidad, fallan aquí y no en la pantalla de un usuario.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CSS = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.css'),
  'utf8',
)

type RGB = [number, number, number]

function hex(h: string): RGB {
  const s = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB
}

/** Luminancia relativa según WCAG 2.1. */
function luminancia([r, g, b]: RGB): number {
  const f = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contraste(a: RGB, b: RGB): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Lo que hace `color-mix(in srgb, relleno X%, transparent)` sobre la tarjeta. */
function mezcla(relleno: RGB, fondo: RGB, alpha: number): RGB {
  return relleno.map((c, i) => Math.round(c * alpha + fondo[i] * (1 - alpha))) as RGB
}

/**
 * Lee un token del bloque `:root` o del bloque `.dark` del CSS, resolviendo las
 * indirecciones: algunos tokens semánticos apuntan a otro (`--heading: var(--navy)`).
 */
function token(nombre: string, tema: 'claro' | 'oscuro', saltos = 0): string {
  if (saltos > 4) throw new Error(`--${nombre} encadena demasiadas referencias`)
  const inicio = tema === 'claro' ? CSS.indexOf(':root {') : CSS.indexOf('.dark {')
  const bloque = CSS.slice(inicio, CSS.indexOf('}', inicio))
  const m = bloque.match(new RegExp(`--${nombre}:\\s*([^;]+);`))
  if (!m) throw new Error(`No encontré --${nombre} en el tema ${tema}`)
  const valor = m[1].trim()
  const ref = valor.match(/^var\(--([\w-]+)\)$/)
  if (ref) return token(ref[1], tema, saltos + 1)
  if (!/^#[0-9a-fA-F]{6}$/.test(valor)) {
    throw new Error(`--${nombre} en tema ${tema} no es un color sólido: ${valor}`)
  }
  return valor
}

// La intensidad nunca baja de 0.16 (mínimo de la celda) ni pasa de 1.
const INTENSIDADES = [1, 0.9, 0.75, 0.55, 0.35, 0.16]
const AA = 4.5

describe('contraste del mapa de calor', () => {
  for (const tema of ['claro', 'oscuro'] as const) {
    it(`la tinta es legible en toda la rampa · tema ${tema}`, () => {
      const relleno = hex(token('celda-relleno', tema))
      const tinta = hex(token('celda-tinta', tema))
      const tarjeta = hex(tema === 'claro' ? '#ffffff' : token('card', tema))

      for (const i of INTENSIDADES) {
        const fondo = mezcla(relleno, tarjeta, i)
        const r = contraste(tinta, fondo)
        expect(r, `intensidad ${i} en tema ${tema} da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
      }
    })
  }

  it('una celda vacía usa el color de texto normal y también contrasta', () => {
    for (const tema of ['claro', 'oscuro'] as const) {
      const tarjeta = hex(tema === 'claro' ? '#ffffff' : token('card', tema))
      const heading = hex(token('heading', tema))
      expect(contraste(heading, tarjeta)).toBeGreaterThanOrEqual(AA)
    }
  })

  it('documenta por qué no se puede usar el cyan de marca en tema oscuro', () => {
    // Regresión: este era el valor anterior y por eso el número no se veía.
    const cyanBrillante = hex('#4fd8d8')
    const tintaAntigua = hex('#7fe6e6') // --pill-tab-fg del tema oscuro
    expect(contraste(tintaAntigua, cyanBrillante)).toBeLessThan(2)
  })
})
