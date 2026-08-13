/**
 * Primitivas de normalización — puerto de las funciones equivalentes de
 * `construir_base.py` (§7 y §10 de ESPECIFICACION_BASE_CONSOLIDADA.md).
 *
 * Todo lo que entra por aquí viene de celdas de Excel, así que cada función
 * tiene que tolerar: texto, número, `Date`, serial de Excel, nulo y basura.
 */

import type { ISODate, HoraTexto, Modalidad } from './types'

export const MESES_NOMBRE: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre',
  12: 'Diciembre',
}

export const MESES_CORTO: Record<number, string> = {
  1: 'ene', 2: 'feb', 3: 'mar', 4: 'abr', 5: 'may', 6: 'jun',
  7: 'jul', 8: 'ago', 9: 'sep', 10: 'oct', 11: 'nov', 12: 'dic',
}

export const DIAS_NOMBRE: Record<number, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes',
  6: 'Sábado', 7: 'Domingo',
}

export const DIAS_CORTO: Record<number, string> = {
  1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom',
}

/** Nombres de mes (y abreviaturas) → número. */
const MESES_NUM: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11,
  diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9,
  set: 9, oct: 10, nov: 11, dic: 12,
}

/** El año con el que se reconstruyen los encabezados `DD T` cuando el
 *  cronograma no da pistas (§4.2). */
export const ANIO_POR_DEFECTO = 2026

/**
 * Minúsculas, sin tildes, sin puntuación de borde, espacios colapsados.
 * Es la base de todas las comparaciones de encabezados y etiquetas.
 */
export function norm(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
    .replace(/\u00a0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[:.\s]+|[:.\s]+$/g, '')
}

/** Texto de celda listo para la base: sin saltos ni marcadores de plantilla. */
export function limpiarTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number' && Number.isNaN(v)) return ''
  const s = String(v)
    .replace(/\u00a0/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (s === '0' || s === '#' || /^n\/?a$/i.test(s)) return ''
  return s
}

function dosDigitos(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** `Date` → `YYYY-MM-DD` usando getters locales (nunca `toISOString`, que
 *  desplazaría la fecha según la zona horaria). */
export function dateAISO(d: Date): ISODate {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

export function armarISO(anio: number, mes: number, dia: number): ISODate | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const d = new Date(anio, mes - 1, dia)
  // Rechaza fechas imposibles (31 de febrero se desborda a marzo).
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null
  return dateAISO(d)
}

/** Serial de Excel (base 1899-12-30) → `Date` local. */
function serialADate(serial: number): Date {
  const dias = Math.floor(serial)
  const fraccion = serial - dias
  const base = new Date(1899, 11, 30)
  base.setDate(base.getDate() + dias)
  const segundos = Math.round(fraccion * 86400)
  base.setHours(Math.floor(segundos / 3600), Math.floor((segundos % 3600) / 60), segundos % 60, 0)
  return base
}

/**
 * Normaliza cualquier representación de fecha a `YYYY-MM-DD`.
 * Acepta `Date`, serial de Excel y texto (`2026-07-25`, `24/07/2026`…).
 */
export function parseFecha(v: unknown): ISODate | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : dateAISO(v)
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 1 || v >= 80000) return null
    return dateAISO(serialADate(v))
  }
  const s = String(v).trim()
  if (!s) return null

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return armarISO(+m[1], +m[2], +m[3])

  // Formato latino: día primero.
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (m) {
    let anio = +m[3]
    if (anio < 100) anio += anio < 70 ? 2000 : 1900
    return armarISO(anio, +m[2], +m[1])
  }

  // "24 de julio de 2026" / "14 de julio del 2026"
  m = s.match(/(\d{1,2})\s+de\s+([a-záéíóúü]+)\s+(?:de[l]?\s+)?(\d{4})/i)
  if (m) {
    const mes = MESES_NUM[norm(m[2])]
    if (mes) return armarISO(+m[3], mes, +m[1])
  }

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : dateAISO(d)
}

/**
 * Normaliza a `HH:MM`. Acepta `Date`, fracción de día de Excel, serial
 * completo y texto (`8:00 a.m.`, `18:30`, `21h`).
 */
export function parseHora(v: unknown): HoraTexto | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return `${dosDigitos(v.getHours())}:${dosDigitos(v.getMinutes())}`
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    if (v >= 0 && v < 1) {
      const total = Math.round(v * 24 * 60)
      return `${dosDigitos(Math.floor(total / 60) % 24)}:${dosDigitos(total % 60)}`
    }
    if (v >= 1 && v < 80000) {
      const d = serialADate(v)
      return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
    }
    return null
  }

  let s = String(v).trim().toLowerCase().replace(/\./g, '')
  if (!s) return null
  const pm = /\bp\s?m\b/.test(s)
  const am = /\ba\s?m\b/.test(s)
  s = s.replace(/\s*[ap]\s?m\s*/g, '').trim()

  const m = s.match(/^(\d{1,2})(?:[:h](\d{1,2}))?(?::(\d{1,2}))?$/)
  if (!m) return null
  let h = +m[1]
  const mi = m[2] ? +m[2] : 0
  if (pm && h < 12) h += 12
  if (am && h === 12) h = 0
  if (h > 23 || mi > 59) return null
  return `${dosDigitos(h)}:${dosDigitos(mi)}`
}

/** Normaliza a número. Tolera `$ 1.400.000`, `1,5`, textos con unidades. */
export function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v instanceof Date) return null

  let s = String(v).trim().replace(/[^\d,.\-]/g, '')
  if (!s || s === '-' || s === '.' || s === ',') return null

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    const i = s.lastIndexOf(',')
    const dec = s.slice(i + 1)
    s = dec.length <= 2 ? `${s.slice(0, i).replace(/,/g, '')}.${dec}` : s.replace(/,/g, '')
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Documento de identidad → primer número.
 * §10: `12345 /67890` debe quedar en `12345`.
 */
export function limpiarDocumento(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'number' ? String(Math.trunc(v)) : String(v).trim()
  if (!s) return ''
  s = s.split(/[/;,|]/)[0]
  s = s.replace(/\D/g, '')
  return s === '' || s === '0' ? '' : s
}

/** Texto libre de `Salón`/`MODALIDAD` → set fijo de modalidades (§7). */
export function normalizarModalidad(v: unknown): Modalidad | '' {
  const s = norm(v)
  if (!s) return ''
  if (s.includes('independiente')) return 'Trabajo Independiente'
  if (s.includes('hospital') || s.includes('practica') || s.includes('clinic')) return 'Práctica'
  if ((s.includes('presencial') && s.includes('virtual')) || s.includes('hibrid') ||
      s.includes('blended') || s.includes('mixt')) return 'Híbrido'
  if (s.includes('remoto') || s.includes('distancia')) return 'Remoto'
  if (s.includes('virtual') || s.includes('online') || s.includes('linea')) return 'Virtual'
  if (s.includes('presencial')) return 'Presencial'
  return ''
}

/** Nombre de mes (o fecha, o número) → 1–12. `null` si no es un mes. */
export function mesANumero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return v.getMonth() + 1
  if (typeof v === 'number') return v >= 1 && v <= 12 ? Math.trunc(v) : null
  const s = norm(v)
  if (!s) return null
  for (const [clave, num] of Object.entries(MESES_NUM)) {
    if (s.startsWith(clave)) return num
  }
  return null
}

/**
 * `programa_id` y nombre corto legible a partir del nombre de carpeta o del
 * curso. El recorrido de carpetas sigue siendo dinámico: este mapa sólo fija
 * identificadores estables y bonitos para los programas conocidos.
 */
const MAPA_PROGRAMAS: Array<[string, string, string]> = [
  ['bienestar', 'BIENESTAR', 'Bienestar y Felicidad'],
  ['felicidad', 'BIENESTAR', 'Bienestar y Felicidad'],
  ['bootcamp', 'BOOTCAMP', 'Bootcamp Analítica'],
  ['heridas', 'HERIDAS', 'Cuidado de Heridas'],
  ['ecografia', 'ECOGRAFIA', 'Ecografía Clínica'],
  ['odontolog', 'ODONTOLOGIA', 'Odontología Estética'],
  ['normatividad', 'NORMATIVIDAD', 'Normatividad Eléctr.'],
  ['electric', 'NORMATIVIDAD', 'Normatividad Eléctr.'],
  ['project', 'PROJECT', 'Gerencia Proyectos'],
  ['proyectos', 'PROJECT', 'Gerencia Proyectos'],
  ['sensorial', 'SENSORIAL', 'Integración Sensorial'],
]

export function identificarPrograma(nombre: string): { id: string; corto: string } {
  const n = norm(nombre)
  for (const [clave, id, corto] of MAPA_PROGRAMAS) {
    if (n.includes(clave)) return { id, corto }
  }
  const id = norm(nombre).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()
  return { id: (id || 'PROGRAMA').slice(0, 24), corto: nombre.trim() || 'Programa' }
}

/** Título con la primera letra en mayúscula (sentence case). */
export function sentenceCase(s: string): string {
  const t = s.trim()
  if (!t) return ''
  if (t === t.toUpperCase() && t.length > 3) {
    const bajo = t.toLowerCase()
    return bajo.charAt(0).toUpperCase() + bajo.slice(1)
  }
  return t.charAt(0).toUpperCase() + t.slice(1)
}
