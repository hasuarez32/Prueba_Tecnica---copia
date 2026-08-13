/**
 * Fuente A — Cronograma (§3 de ESPECIFICACION_BASE_CONSOLIDADA.md).
 *
 * La hoja relevante tiene nombre variable (`owssvr`, `owssvr (1)`,
 * `owssvr - 2026-08-11T...`), así que se detecta por sus **encabezados**
 * (`Sesión` + `Fecha`), nunca por el nombre. Las columnas se mapean por nombre
 * de encabezado, no por posición: varían entre programas.
 */

import type * as XLSX from 'xlsx'
import type { ISODate, HoraTexto, Incidencia } from './types'
import { hojaAMatriz, anchoMatriz, type Matriz, type Celda } from './sheet'
import { norm, parseFecha, parseHora, parseNum, limpiarTexto } from './normalize'

export interface FilaCronograma {
  orden_archivo: number
  num_sesion: number | null
  fecha: ISODate | null
  hora_inicio: HoraTexto | null
  hora_fin: HoraTexto | null
  /** Fecha embebida en la celda de hora, si vino como datetime completo.
   *  Sirve para detectar horas fechadas en otro día (§10). */
  fecha_de_hora_inicio: ISODate | null
  fecha_de_hora_fin: ISODate | null
  fecha_era_texto: boolean
  hora_era_texto: boolean
  intensidad_horaria: number | null
  modulo: string
  salon: string
  docente: string
}

export interface ResultadoCronograma {
  filas: FilaCronograma[]
  incidencias: Incidencia[]
  hoja: string | null
  /** Encabezados detectados, útiles para explicar un fallo al usuario. */
  encabezados: string[]
}

/** Alias por campo. Se compara con `startsWith` sobre el encabezado normalizado. */
const CAMPOS: Record<keyof typeof PLANTILLA, string[]> = {
  num_sesion: ['sesion'],
  fecha: ['fecha'],
  hora_inicio: ['hora inicio'],
  hora_fin: ['hora fin'],
  intensidad_horaria: ['intensidad horaria'],
  modulo: ['nombre del modulo', 'modulo'],
  salon: ['salon'],
  docente: ['nombre del docente', 'docente'],
}

const PLANTILLA = {
  num_sesion: 0, fecha: 0, hora_inicio: 0, hora_fin: 0,
  intensidad_horaria: 0, modulo: 0, salon: 0, docente: 0,
}

const OBLIGATORIOS: Array<keyof typeof PLANTILLA> = [
  'num_sesion', 'fecha', 'hora_inicio', 'hora_fin', 'intensidad_horaria',
]

const ETIQUETA_CAMPO: Record<string, string> = {
  num_sesion: 'Sesión',
  fecha: 'Fecha',
  hora_inicio: 'Hora Inicio',
  hora_fin: 'Hora Fin',
  intensidad_horaria: 'Intensidad horaria por sesión',
  modulo: 'Nombre del módulo',
  salon: 'Salón',
  docente: 'Nombre del docente',
}

/** ¿Esta fila de encabezados corresponde a un cronograma? */
function esFilaEncabezados(fila: Celda[] | undefined): boolean {
  if (!fila) return false
  const hs = fila.map((h) => norm(h))
  return hs.some((h) => h.startsWith('sesion')) && hs.some((h) => h.startsWith('fecha'))
}

export function leerCronograma(libro: XLSX.WorkBook, archivo: string): ResultadoCronograma {
  const incidencias: Incidencia[] = []

  let matriz: Matriz | null = null
  let nombreHoja: string | null = null
  for (const nombre of libro.SheetNames) {
    const m = hojaAMatriz(libro.Sheets[nombre])
    if (esFilaEncabezados(m[0])) {
      matriz = m
      nombreHoja = nombre
      break
    }
  }

  if (!matriz || !nombreHoja) {
    incidencias.push({
      severidad: 'error',
      mensaje: 'No encuentro la hoja del cronograma: ninguna tiene las columnas «Sesión» y «Fecha» en la primera fila.',
      donde: `${archivo} · hojas revisadas: ${libro.SheetNames.join(', ') || '(ninguna)'}`,
      sugerencia: 'El cronograma debe tener los encabezados en la fila 1. Exporta la vista estándar de la lista de clases.',
    })
    return { filas: [], incidencias, hoja: null, encabezados: [] }
  }

  const encabezados = (matriz[0] ?? []).map((h) => norm(h))
  const crudos = (matriz[0] ?? []).map((h) => limpiarTexto(h))

  const idx: Partial<Record<keyof typeof PLANTILLA, number>> = {}
  for (const campo of Object.keys(CAMPOS) as Array<keyof typeof PLANTILLA>) {
    const alias = CAMPOS[campo]
    const i = encabezados.findIndex((h) => alias.some((a) => h.startsWith(a)))
    if (i >= 0) idx[campo] = i
  }

  for (const campo of OBLIGATORIOS) {
    if (idx[campo] === undefined) {
      incidencias.push({
        severidad: campo === 'fecha' || campo === 'num_sesion' ? 'error' : 'aviso',
        mensaje: `No encuentro la columna «${ETIQUETA_CAMPO[campo]}» en el cronograma.`,
        donde: `${archivo} · hoja «${nombreHoja}» · encabezados: ${crudos.filter(Boolean).join(' | ')}`,
        sugerencia: `Agrega una columna llamada «${ETIQUETA_CAMPO[campo]}» o renombra la equivalente.`,
      })
    }
  }
  if (idx.salon === undefined) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: 'El cronograma no trae columna «Salón»: la modalidad se tomará de «MODALIDAD» en FORMAS DE PAGO.',
      donde: `${archivo} · hoja «${nombreHoja}»`,
    })
  }
  if (idx.modulo === undefined) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: 'El cronograma no trae columna «Nombre del módulo»: las sesiones quedarán sin módulo.',
      donde: `${archivo} · hoja «${nombreHoja}»`,
    })
  }

  // Sin fecha no hay sesiones que construir.
  if (idx.fecha === undefined) {
    return { filas: [], incidencias, hoja: nombreHoja, encabezados: crudos }
  }

  const ancho = anchoMatriz(matriz)
  const filas: FilaCronograma[] = []
  let orden = 0

  for (let r = 1; r < matriz.length; r++) {
    const fila = matriz[r]
    if (!fila) continue
    const vacia = fila.every((v) => v === null || v === undefined || String(v).trim() === '')
    if (vacia) continue

    const val = (campo: keyof typeof PLANTILLA): Celda => {
      const i = idx[campo]
      if (i === undefined || i >= ancho) return null
      const v = fila[i]
      return v === undefined ? null : v
    }

    const crudoFecha = val('fecha')
    const crudoHi = val('hora_inicio')
    const crudoHf = val('hora_fin')
    const fecha = parseFecha(crudoFecha)
    const num = parseNum(val('num_sesion'))

    if (fecha === null && num === null) continue
    orden += 1

    if (fecha === null) {
      incidencias.push({
        severidad: 'error',
        mensaje: `La fecha de la sesión ${num ?? orden} no se puede interpretar (valor: «${String(crudoFecha ?? '')}»).`,
        donde: `${archivo} · hoja «${nombreHoja}» · fila ${r + 1}, columna «Fecha»`,
        sugerencia: 'Usa una fecha real de Excel o el formato DD/MM/AAAA.',
      })
    }

    filas.push({
      orden_archivo: orden,
      num_sesion: num === null ? null : Math.trunc(num),
      fecha,
      hora_inicio: parseHora(crudoHi),
      hora_fin: parseHora(crudoHf),
      fecha_de_hora_inicio: crudoHi instanceof Date ? parseFecha(crudoHi) : null,
      fecha_de_hora_fin: crudoHf instanceof Date ? parseFecha(crudoHf) : null,
      fecha_era_texto: typeof crudoFecha === 'string',
      hora_era_texto: typeof crudoHi === 'string' || typeof crudoHf === 'string',
      intensidad_horaria: parseNum(val('intensidad_horaria')),
      modulo: limpiarTexto(val('modulo')),
      salon: limpiarTexto(val('salon')),
      docente: limpiarTexto(val('docente')),
    })
  }

  if (filas.length === 0) {
    incidencias.push({
      severidad: 'error',
      mensaje: 'El cronograma no tiene ninguna fila de sesión legible.',
      donde: `${archivo} · hoja «${nombreHoja}»`,
      sugerencia: 'Verifica que debajo de los encabezados haya al menos una sesión con fecha.',
    })
  }

  return { filas, incidencias, hoja: nombreHoja, encabezados: crudos }
}
