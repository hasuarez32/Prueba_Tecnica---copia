/**
 * Fuente B — Listado de participantes (§4 de ESPECIFICACION_BASE_CONSOLIDADA.md).
 *
 * Dos hojas importan:
 *  - `FORMAS DE PAGO` → metadatos del programa, localizados por el texto de la
 *    etiqueta y tomando el valor a su derecha.
 *  - `CONSOLIDADO`   → la asistencia real. Cada celda son HORAS DE INASISTENCIA
 *    (0 = asistió, vacío = sin tabular).
 */

import type * as XLSX from 'xlsx'
import type { ISODate, Incidencia } from './types'
import {
  hojaAMatriz, anchoMatriz, buscarHoja, celda, valorALaDerecha, esVacia,
  type Matriz, type Celda,
} from './sheet'
import {
  norm, limpiarTexto, parseFecha, parseNum, limpiarDocumento, mesANumero,
  armarISO, ANIO_POR_DEFECTO,
} from './normalize'

/* ───────────────────────────── FORMAS DE PAGO ───────────────────────────── */

export interface MetaPrograma {
  experto_facilitador: string
  nombre_oficial: string
  entidad_convenio: string
  modalidad_declarada: string
  valor_programa: number | null
  n_participantes: number | null
  nrc: string
  cod_banner: string
  codigo_contable: string
  coordinador: string
  lugar_y_fecha: string
}

const ETIQUETAS: Array<[keyof MetaPrograma, string[]]> = [
  ['experto_facilitador', ['experto facilitador']],
  ['nombre_oficial', ['nombre del curso']],
  ['entidad_convenio', ['entidad convenio']],
  ['modalidad_declarada', ['modalidad']],
  ['valor_programa', ['valor del programa']],
  ['n_participantes', ['numero de particiantes', 'numero de participantes']],
  ['nrc', ['nrc']],
  ['cod_banner', ['cod banner']],
  ['codigo_contable', ['codigo contable']],
  ['coordinador', ['coordinador']],
]

/** Encabezados de la tabla de participantes de FORMAS DE PAGO. Marcan dónde
 *  termina el bloque de metadatos: más abajo hay columnas como «CODIGO BANNER»
 *  que colisionan con las etiquetas buscadas. */
const FIN_METADATOS = new Set(['apellidos', 'cedula', 'forma de pago', 'tipo de participante'])

export function leerFormasDePago(
  libro: XLSX.WorkBook,
  archivo: string,
): { meta: MetaPrograma; incidencias: Incidencia[] } {
  const incidencias: Incidencia[] = []
  const meta: MetaPrograma = {
    experto_facilitador: '', nombre_oficial: '', entidad_convenio: '',
    modalidad_declarada: '', valor_programa: null, n_participantes: null,
    nrc: '', cod_banner: '', codigo_contable: '', coordinador: '', lugar_y_fecha: '',
  }

  const hoja = buscarHoja(libro, 'FORMAS DE PAGO')
  if (!hoja) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: 'No existe la hoja «FORMAS DE PAGO»: el curso se importa sin metadatos (NRC, coordinador, valor…).',
      donde: `${archivo} · hojas: ${libro.SheetNames.join(', ')}`,
      sugerencia: 'Usa la plantilla estándar del CEC si necesitas esos datos en el panel.',
    })
    return { meta, incidencias }
  }

  const m = hojaAMatriz(hoja)
  const ancho = anchoMatriz(m)
  const tope = Math.min(30, m.length)

  let filaTabla = tope
  for (let r = 0; r < tope; r++) {
    for (let c = 0; c < Math.min(16, ancho); c++) {
      if (FIN_METADATOS.has(norm(celda(m, r, c)))) {
        filaTabla = r
        r = tope
        break
      }
    }
  }

  const vistos = new Set<string>()
  for (let r = 0; r < filaTabla; r++) {
    for (let c = 0; c < ancho; c++) {
      const v = celda(m, r, c)
      if (typeof v !== 'string') continue
      const etiqueta = norm(v)
      if (!etiqueta) continue

      if (etiqueta.startsWith('lugar y fecha')) {
        meta.lugar_y_fecha = limpiarTexto(valorALaDerecha(m, r, c))
      }
      for (const [campo, alias] of ETIQUETAS) {
        if (vistos.has(campo)) continue
        if (!alias.some((a) => etiqueta.startsWith(a))) continue
        vistos.add(campo)
        const valor = valorALaDerecha(m, r, c)
        if (campo === 'valor_programa' || campo === 'n_participantes') {
          const n = parseNum(valor)
          ;(meta[campo] as number | null) = n
        } else {
          ;(meta[campo] as string) = limpiarTexto(valor)
        }
      }
    }
  }

  const faltantes = ETIQUETAS
    .map(([campo]) => campo)
    .filter((campo) => {
      const v = meta[campo]
      return v === null || v === ''
    })
  if (faltantes.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `FORMAS DE PAGO no trae valor para: ${faltantes.join(', ')}.`,
      donde: `${archivo} · hoja «FORMAS DE PAGO»`,
    })
  }

  return { meta, incidencias }
}

/* ────────────────────────────── CONSOLIDADO ─────────────────────────────── */

export interface ColumnaSesion {
  /** Índice 0-based de la columna en la hoja. */
  col: number
  fecha: ISODate | null
  jornada: 'Mañana' | 'Tarde' | null
  etiqueta: string
  /** Tiene al menos un valor en las filas de participantes (los ceros cuentan). */
  tabulada: boolean
  /** Alguna sesión del cronograma la reclamó. */
  usada: boolean
}

export interface FilaParticipante {
  fila: number
  nombre: string
  documento: string
  empresa: string
  /** Σ de inasistencia según el archivo (para contrastar el recálculo). */
  sigma: number | null
  /** Valor por columna de sesión: `col` → horas de inasistencia. */
  celdas: Map<number, Celda>
}

export interface ResultadoConsolidado {
  columnas: ColumnaSesion[]
  participantes: FilaParticipante[]
  horas_totales: number | null
  horas_falla_max: number | null
  incidencias: Incidencia[]
  ok: boolean
}

/** `24 T`, `8 M`, `5 M`, `12`, `3 M.` */
const RE_DIA_JORNADA = /^(\d{1,2})\s*\.?\s*([a-zA-Z])?\s*\.?$/

const LEYENDA = ['nomenclatura', 'asistencia por sesion', 'inasistencia representada', 'total']

export function leerConsolidado(
  libro: XLSX.WorkBook,
  archivo: string,
  aniosCronograma: number[],
  fechasCronograma: Set<ISODate>,
): ResultadoConsolidado {
  const incidencias: Incidencia[] = []
  const vacio: ResultadoConsolidado = {
    columnas: [], participantes: [], horas_totales: null, horas_falla_max: null,
    incidencias, ok: false,
  }

  const hoja = buscarHoja(libro, 'CONSOLIDADO')
  if (!hoja) {
    incidencias.push({
      severidad: 'error',
      mensaje: 'Falta la hoja CONSOLIDADO — no se puede leer la asistencia.',
      donde: `${archivo} · hojas encontradas: ${libro.SheetNames.join(', ') || '(ninguna)'}`,
      sugerencia: 'Exporta el listado desde la plantilla estándar del CEC (GUECFT061) y vuelve a subirlo.',
    })
    return vacio
  }

  const m = hojaAMatriz(hoja)
  const ancho = anchoMatriz(m)

  // ── fila de encabezados: la que tiene NOMBRE y DOCUMENTO DE IDENTIDAD
  let filaHdr = -1
  for (let r = 0; r < Math.min(40, m.length); r++) {
    let tieneNombre = false
    let tieneDoc = false
    for (let c = 0; c < Math.min(12, ancho); c++) {
      const h = norm(celda(m, r, c))
      if (h === 'nombre') tieneNombre = true
      if (h.startsWith('documento')) tieneDoc = true
    }
    if (tieneNombre && tieneDoc) {
      filaHdr = r
      break
    }
  }
  if (filaHdr < 0) {
    incidencias.push({
      severidad: 'error',
      mensaje: 'La hoja CONSOLIDADO no tiene la fila de encabezados con «NOMBRE» y «DOCUMENTO DE IDENTIDAD».',
      donde: `${archivo} · hoja «CONSOLIDADO»`,
      sugerencia: 'La plantilla estándar los trae en la fila 12; no borres ni muevas esa fila.',
    })
    return vacio
  }

  let colNombre = -1, colDoc = -1, colEmpresa = -1, colCorreo = -1, colSigma = -1, colObs = -1
  for (let c = 0; c < ancho; c++) {
    const h = norm(celda(m, filaHdr, c))
    if (!h) continue
    if (h === 'nombre' && colNombre < 0) colNombre = c
    else if (h.startsWith('documento') && colDoc < 0) colDoc = c
    else if (h.startsWith('empresa') && colEmpresa < 0) colEmpresa = c
    else if (h.startsWith('correo') && colCorreo < 0) colCorreo = c
    else if (h.includes('de inasistencia') && colSigma < 0) colSigma = c
    else if (h.startsWith('observacion') && colObs < 0) colObs = c
  }

  const colIni = Math.max(colNombre, colDoc, colEmpresa, colCorreo) + 1
  let colFin = colSigma >= 0 ? colSigma - 1 : ancho - 1
  if (colSigma < 0 && colObs >= 0) colFin = colObs - 1

  if (colFin < colIni) {
    incidencias.push({
      severidad: 'error',
      mensaje: 'La hoja CONSOLIDADO no tiene columnas de sesión entre «CORREO» y «Σ de inasistencia».',
      donde: `${archivo} · hoja «CONSOLIDADO» · fila ${filaHdr + 1}`,
      sugerencia: 'Cada sesión necesita su columna con la fecha o el día y la jornada (por ejemplo «24 T»).',
    })
    return vacio
  }

  // ── horas totales y tope de fallas
  let horasTotales: number | null = null
  let horasFalla: number | null = null
  for (let r = 0; r < filaHdr; r++) {
    for (let c = 0; c < Math.min(8, ancho); c++) {
      const h = norm(celda(m, r, c))
      if (!h.startsWith('numero de horas')) continue
      const valor = parseNum(valorALaDerecha(m, r, c))
      if (h.includes('falla')) {
        if (horasFalla === null) horasFalla = valor
      } else if (horasTotales === null) {
        horasTotales = valor
      }
    }
  }
  if (horasTotales === null) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: 'No encuentro «NÚMERO DE HORAS» en la cabecera del CONSOLIDADO.',
      donde: `${archivo} · hoja «CONSOLIDADO»`,
    })
  }
  if (horasFalla === null) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: 'No encuentro «NÚMERO DE HORAS DE FALLAS MÁXIMAS PERMITIDAS»: no se puede marcar riesgo académico.',
      donde: `${archivo} · hoja «CONSOLIDADO»`,
      sugerencia: 'Sin ese tope, los participantes de este curso nunca aparecerán «en riesgo».',
    })
  }

  // ── fila «Mes:» con forward-fill (§4.2 y §10: celdas combinadas)
  let filaMes = -1
  for (let r = Math.max(0, filaHdr - 6); r < filaHdr; r++) {
    for (let c = 0; c <= Math.min(colIni, ancho - 1); c++) {
      if (norm(celda(m, r, c)).startsWith('mes')) {
        filaMes = r
        break
      }
    }
    if (filaMes >= 0) break
  }
  if (filaMes < 0) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: 'La hoja CONSOLIDADO no tiene la fila «Mes:»: los encabezados tipo «24 T» no se pueden fechar.',
      donde: `${archivo} · hoja «CONSOLIDADO»`,
      sugerencia: 'Agrega una fila «Mes:» sobre los encabezados, con el nombre del mes al inicio de cada bloque.',
    })
  }

  const mesPorColumna = new Map<number, number | null>()
  if (filaMes >= 0) {
    let ultimo: number | null = null
    for (let c = colIni; c <= colFin; c++) {
      const mes = mesANumero(celda(m, filaMes, c))
      if (mes !== null) ultimo = mes // forward-fill sobre celdas combinadas o vacías
      mesPorColumna.set(c, ultimo)
    }
  }

  const anios = Array.from(new Set(aniosCronograma)).sort((a, b) => a - b)
  const aniosCandidatos = anios.length ? anios : [ANIO_POR_DEFECTO]

  /** Año que hace calzar (mes, día) con alguna fecha del cronograma. */
  function elegirAnio(mes: number, dia: number): number {
    for (const a of aniosCandidatos) {
      const iso = armarISO(a, mes, dia)
      if (iso && fechasCronograma.has(iso)) return a
    }
    return aniosCandidatos[0]
  }

  // ── columnas de sesión
  const columnas: ColumnaSesion[] = []
  const sinFecha: string[] = []
  const jornadaDesconocida: string[] = []

  for (let c = colIni; c <= colFin; c++) {
    const crudo = celda(m, filaHdr, c)
    if (esVacia(crudo)) continue // columna separadora

    const etiqueta = crudo instanceof Date ? (parseFecha(crudo) ?? '') : String(crudo).trim()
    let fecha: ISODate | null = null
    let jornada: 'Mañana' | 'Tarde' | null = null

    if (crudo instanceof Date) {
      fecha = parseFecha(crudo) // formato 1: fecha completa
    } else {
      const texto = String(crudo).trim()
      const mm = texto.match(RE_DIA_JORNADA)
      if (mm) {
        // formato 2: día del mes + jornada
        const dia = Number(mm[1])
        const letra = (mm[2] ?? '').toLowerCase()
        if (letra === 't') jornada = 'Tarde'
        else if (letra === 'm') jornada = 'Mañana'
        else if (letra) {
          jornadaDesconocida.push(texto)
        }
        const mes = mesPorColumna.get(c) ?? null
        if (mes && dia >= 1 && dia <= 31) fecha = armarISO(elegirAnio(mes, dia), mes, dia)
      } else {
        fecha = parseFecha(crudo)
      }
    }

    if (fecha === null) sinFecha.push(etiqueta || `(columna ${c + 1})`)
    columnas.push({ col: c, fecha, jornada, etiqueta, tabulada: false, usada: false })
  }

  if (jornadaDesconocida.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `Encabezado ${jornadaDesconocida.map((x) => `«${x}»`).join(', ')} con jornada no reconocida (usa T o M).`,
      donde: `${archivo} · hoja «CONSOLIDADO» · fila ${filaHdr + 1}`,
      sugerencia: 'La letra indica la jornada: T = tarde, M = mañana. Sin ella, la columna sólo se cruza por fecha.',
    })
  }
  if (sinFecha.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `${sinFecha.length} columna(s) de sesión sin fecha reconstruible (${sinFecha.slice(0, 8).map((x) => `«${x}»`).join(', ')}): esas sesiones quedarán sin columna.`,
      donde: `${archivo} · hoja «CONSOLIDADO» · fila ${filaHdr + 1}`,
      sugerencia: 'El encabezado debe ser una fecha completa o el día con la jornada («24 T»), con la fila «Mes:» arriba.',
    })
  }

  // ── participantes
  const participantes: FilaParticipante[] = []
  let vaciasSeguidas = 0
  for (let r = filaHdr + 1; r < m.length; r++) {
    if (vaciasSeguidas >= 60) break

    const nombre = colNombre >= 0 ? limpiarTexto(celda(m, r, colNombre)) : ''
    const documento = colDoc >= 0 ? limpiarDocumento(celda(m, r, colDoc)) : ''

    const celdas = new Map<number, Celda>()
    for (const col of columnas) {
      const v = celda(m, r, col.col)
      if (esVacia(v)) continue
      celdas.set(col.col, v)
    }

    if (!nombre || (!documento && celdas.size === 0)) {
      vaciasSeguidas++
      continue
    }
    if (LEYENDA.some((k) => norm(nombre).startsWith(k))) {
      vaciasSeguidas++
      continue
    }
    vaciasSeguidas = 0

    for (const c of celdas.keys()) {
      const col = columnas.find((x) => x.col === c)
      if (col) col.tabulada = true
    }

    participantes.push({
      fila: r,
      nombre,
      documento,
      empresa: colEmpresa >= 0 ? limpiarTexto(celda(m, r, colEmpresa)) : '',
      sigma: colSigma >= 0 ? parseNum(celda(m, r, colSigma)) : null,
      celdas,
    })
  }

  if (participantes.length === 0) {
    incidencias.push({
      severidad: 'error',
      mensaje: 'La hoja CONSOLIDADO no tiene ninguna fila de participante legible.',
      donde: `${archivo} · hoja «CONSOLIDADO» · debajo de la fila ${filaHdr + 1}`,
      sugerencia: 'Cada participante necesita al menos nombre y documento de identidad.',
    })
    return { ...vacio, columnas, horas_totales: horasTotales, horas_falla_max: horasFalla }
  }

  const sinDoc = participantes.filter((p) => !p.documento)
  if (sinDoc.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `${sinDoc.length} participante(s) sin documento legible (${sinDoc.slice(0, 3).map((p) => p.nombre).join('; ')}).`,
      donde: `${archivo} · hoja «CONSOLIDADO» · columna «DOCUMENTO DE IDENTIDAD»`,
    })
  }

  return {
    columnas,
    participantes,
    horas_totales: horasTotales,
    horas_falla_max: horasFalla,
    incidencias,
    ok: true,
  }
}

/** Detecta si un libro parece un listado de participantes (vs. un cronograma). */
export function pareceListado(libro: XLSX.WorkBook): boolean {
  return libro.SheetNames.some((n) => {
    const x = norm(n)
    return x === 'consolidado' || x === 'formas de pago' || x === 'listado de asistencia'
  })
}

/** Detecta si un libro parece un cronograma (alguna hoja con Sesión + Fecha). */
export function pareceCronograma(libro: XLSX.WorkBook): boolean {
  for (const nombre of libro.SheetNames) {
    const m: Matriz = hojaAMatriz(libro.Sheets[nombre])
    const fila = m[0]
    if (!fila) continue
    const hs = fila.map((h) => norm(h))
    if (hs.some((h) => h.startsWith('sesion')) && hs.some((h) => h.startsWith('fecha'))) return true
  }
  return false
}
