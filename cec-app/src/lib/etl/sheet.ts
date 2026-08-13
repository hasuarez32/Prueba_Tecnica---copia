/**
 * Utilidades sobre libros de SheetJS.
 *
 * Se trabaja siempre con una matriz densa (`Matriz`) equivalente a lo que
 * devuelve `iter_rows(values_only=True)` de openpyxl: SheetJS, igual que
 * openpyxl, deja el valor de una celda combinada sólo en la esquina superior
 * izquierda, así que el forward-fill de la fila `Mes:` funciona idéntico.
 */

import * as XLSX from 'xlsx'
import { norm } from './normalize'

export type Celda = string | number | boolean | Date | null
export type Matriz = Celda[][]

export function leerLibro(datos: ArrayBuffer | Uint8Array): XLSX.WorkBook {
  return XLSX.read(datos, {
    type: 'array',
    // Convierte celdas de fecha a `Date` en hora local, en vez de a serial.
    cellDates: true,
    cellNF: false,
    cellText: false,
  })
}

/** Hoja → matriz densa, con `null` en los huecos y filas vacías conservadas. */
export function hojaAMatriz(hoja: XLSX.WorkSheet): Matriz {
  const filas = XLSX.utils.sheet_to_json<Celda[]>(hoja, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  })
  return filas as Matriz
}

/** Valor de una celda por índices 0-based, tolerante a filas cortas. */
export function celda(m: Matriz, fila: number, col: number): Celda {
  const f = m[fila]
  if (!f) return null
  const v = f[col]
  return v === undefined ? null : v
}

/** Número de columnas de la fila más ancha. */
export function anchoMatriz(m: Matriz): number {
  let max = 0
  for (const f of m) if (f && f.length > max) max = f.length
  return max
}

/** Busca una hoja por nombre exacto normalizado y, si falla, por coincidencia parcial. */
export function buscarHoja(libro: XLSX.WorkBook, nombre: string): XLSX.WorkSheet | null {
  const objetivo = norm(nombre)
  for (const n of libro.SheetNames) if (norm(n) === objetivo) return libro.Sheets[n]
  for (const n of libro.SheetNames) if (norm(n).includes(objetivo)) return libro.Sheets[n]
  return null
}

/**
 * Primer valor no vacío a la derecha de una etiqueta.
 * La maquetación de FORMAS DE PAGO varía (el valor puede estar 1 o 2 celdas a
 * la derecha), así que se avanza hasta toparse con otra etiqueta.
 */
export function valorALaDerecha(m: Matriz, fila: number, col: number, saltos = 6): Celda {
  const ancho = anchoMatriz(m)
  for (let c = col + 1; c < Math.min(col + 1 + saltos, ancho); c++) {
    const v = celda(m, fila, c)
    if (v === null || v === undefined) continue
    const s = String(v).trim()
    if (!s) continue
    // Otra etiqueta: el valor de esta estaba vacío.
    if (s.endsWith(':') && s.length > 3) return null
    return v
  }
  return null
}

export function esVacia(v: Celda): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}
