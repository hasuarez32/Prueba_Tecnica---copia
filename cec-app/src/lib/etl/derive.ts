/**
 * Capa derivada: aplica la **fecha de corte** sobre la base persistida.
 *
 * Todo lo dependiente del tiempo vive aquí (§5, §6 y §7 de
 * ESPECIFICACION_BASE_CONSOLIDADA.md), de modo que mover el corte en la UI
 * recalcula estados y KPIs sin volver a leer un solo Excel.
 */

import type {
  BaseConsolidada, BaseDerivada, DiaCalendario, EstadoPrograma, EstadoSeguimiento,
  EstadoSesion, ISODate, Programa, Sesion, AsistenciaTabulada,
} from './types'
import { DIAS_NOMBRE, MESES_NOMBRE } from './normalize'

/** `YYYY-MM-DD` → `Date` local (mediodía, para inmunidad al horario de verano). */
export function isoADate(iso: ISODate): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d, 12, 0, 0, 0)
}

export function hoyISO(): ISODate {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Días calendario entre dos fechas ISO (b − a). */
export function diasEntre(a: ISODate, b: ISODate): number {
  return Math.round((isoADate(b).getTime() - isoADate(a).getTime()) / 86400000)
}

/** Día de la semana ISO: lunes = 1 … domingo = 7. */
export function diaSemanaISO(iso: ISODate): number {
  const d = isoADate(iso).getDay()
  return d === 0 ? 7 : d
}

/** Semana ISO 8601 y su año, según el algoritmo del jueves. */
export function semanaISO(iso: ISODate): { semana: number; anio: number } {
  const d = isoADate(iso)
  const jueves = new Date(d.getTime())
  jueves.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const anio = jueves.getFullYear()
  const enero4 = new Date(anio, 0, 4, 12, 0, 0, 0)
  const semana =
    1 + Math.round(((jueves.getTime() - enero4.getTime()) / 86400000 -
      3 + ((enero4.getDay() + 6) % 7)) / 7)
  return { semana, anio }
}

export function anioSemana(iso: ISODate): string {
  const { semana, anio } = semanaISO(iso)
  return `${anio}-W${String(semana).padStart(2, '0')}`
}

/** Lunes de la semana que contiene a `iso`. */
export function lunesDe(iso: ISODate): ISODate {
  const d = isoADate(iso)
  d.setDate(d.getDate() - (diaSemanaISO(iso) - 1))
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function sumarDias(iso: ISODate, n: number): ISODate {
  const d = isoADate(iso)
  d.setDate(d.getDate() + n)
  const p = (x: number) => (x < 10 ? `0${x}` : String(x))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function campoCalendario(fecha: ISODate) {
  const d = isoADate(fecha)
  const dsn = diaSemanaISO(fecha)
  const { semana } = semanaISO(fecha)
  return {
    anio: d.getFullYear(),
    mes: d.getMonth() + 1,
    mes_nombre: MESES_NOMBRE[d.getMonth() + 1],
    dia: d.getDate(),
    dia_semana: DIAS_NOMBRE[dsn],
    dia_semana_num: dsn,
    semana_iso: semana,
    anio_semana: anioSemana(fecha),
  }
}

/**
 * Regla de §5. `tabulada` no depende del corte (es un hecho del Excel); lo que
 * depende es cómo se lee una columna vacía: deuda si la clase ya pasó, o nada
 * exigible si aún no ocurre.
 */
export function estadoSeguimiento(
  tabulada: boolean,
  fecha: ISODate,
  corte: ISODate,
): EstadoSeguimiento {
  if (tabulada) return 'Tabulada'
  return fecha <= corte ? 'Pendiente de tabular' : 'Futura no exigible'
}

export function estadoSesionDe(fecha: ISODate, corte: ISODate): EstadoSesion {
  if (fecha < corte) return 'Realizada'
  if (fecha === corte) return 'Hoy'
  return 'Futura'
}

/**
 * `Sí` = tabulada, `No` = pendiente, `N/A` = futura no exigible.
 * Una sesión futura nunca debe leerse como incumplimiento (§5), por eso no
 * usa `No` aunque le falte la columna.
 */
export function asistenciaTabuladaDe(estado: EstadoSeguimiento): AsistenciaTabulada {
  if (estado === 'Tabulada') return 'Sí'
  if (estado === 'Futura no exigible') return 'N/A'
  return 'No'
}

export function estadoProgramaDe(
  inicio: ISODate | null,
  fin: ISODate | null,
  corte: ISODate,
): EstadoPrograma {
  if (!inicio || !fin) return 'Por iniciar'
  if (corte < inicio) return 'Por iniciar'
  if (corte > fin) return 'Finalizado'
  return 'En ejecución'
}

/**
 * Tabla de fechas de **años completos**.
 *
 * Power BI exige que la tabla de fechas cubra años enteros para que funcione la
 * inteligencia de tiempo (TOTALYTD, SAMEPERIODLASTYEAR…). Con el rango justo de
 * las sesiones esas funciones dan resultados raros o advertencia.
 */
export function construirCalendario(fechas: ISODate[]): DiaCalendario[] {
  if (fechas.length === 0) return []
  const ordenadas = [...fechas].sort()
  const inicio = `${ordenadas[0].slice(0, 4)}-01-01`
  const fin = `${ordenadas[ordenadas.length - 1].slice(0, 4)}-12-31`
  const dias: DiaCalendario[] = []
  let cursor = inicio
  let guarda = 0
  while (cursor <= fin && guarda < 4000) {
    const c = campoCalendario(cursor)
    dias.push({ fecha: cursor, ...c, es_fin_de_semana: c.dia_semana_num >= 6 })
    cursor = sumarDias(cursor, 1)
    guarda++
  }
  return dias
}

/** Aplica la fecha de corte a toda la base y calcula los agregados. */
export function derivar(base: BaseConsolidada, corte: ISODate): BaseDerivada {
  const sesiones: Sesion[] = []
  const programas: Programa[] = []
  const asistencia = base.cursos.flatMap((c) => c.asistencia)
  const participantes = base.cursos.flatMap((c) => c.participantes)

  for (const curso of base.cursos) {
    const propias: Sesion[] = curso.sesiones.map((s) => {
      const cal = campoCalendario(s.fecha)
      const seg = estadoSeguimiento(s.tabulada, s.fecha, corte)
      return {
        ...s,
        ...cal,
        estado_sesion: estadoSesionDe(s.fecha, corte),
        estado_seguimiento: seg,
        asistencia_tabulada: asistenciaTabuladaDe(seg),
        dias_atraso: s.fecha <= corte ? Math.max(0, diasEntre(s.fecha, corte)) : 0,
      }
    })
    propias.sort((a, b) => (a.fecha === b.fecha
      ? a.hora_inicio.localeCompare(b.hora_inicio)
      : a.fecha.localeCompare(b.fecha)))
    sesiones.push(...propias)

    const fechas = propias.map((s) => s.fecha).sort()
    const inicio = fechas[0] ?? null
    const fin = fechas[fechas.length - 1] ?? null
    const tab = propias.filter((s) => s.estado_seguimiento === 'Tabulada').length
    const pen = propias.filter((s) => s.estado_seguimiento === 'Pendiente de tabular').length
    const fut = propias.filter((s) => s.estado_seguimiento === 'Futura no exigible').length
    const realizadas = tab + pen // §5: sólo cuentan las sesiones ya dictadas

    programas.push({
      ...curso.programa,
      fecha_inicio: inicio,
      fecha_fin: fin,
      n_sesiones: propias.length,
      n_sesiones_realizadas: realizadas,
      n_sesiones_tabuladas: tab,
      n_sesiones_pendientes: pen,
      n_sesiones_futuras: fut,
      pct_cumplimiento_tabulacion: realizadas > 0 ? tab / realizadas : null,
      estado_programa: estadoProgramaDe(inicio, fin, corte),
      n_participantes_reales: curso.participantes.length,
      n_en_riesgo: curso.participantes.filter((p) => p.en_riesgo).length,
    })
  }

  sesiones.sort((a, b) => (a.fecha === b.fecha
    ? a.programa.localeCompare(b.programa)
    : a.fecha.localeCompare(b.fecha)))
  programas.sort((a, b) => b.n_sesiones - a.n_sesiones || a.programa.localeCompare(b.programa))

  const nTab = sesiones.filter((s) => s.estado_seguimiento === 'Tabulada').length
  const nPen = sesiones.filter((s) => s.estado_seguimiento === 'Pendiente de tabular').length
  const nFut = sesiones.filter((s) => s.estado_seguimiento === 'Futura no exigible').length
  const realizadas = nTab + nPen
  const asistieron = asistencia.filter((a) => a.asistio).length

  return {
    fecha_corte: corte,
    sesiones,
    programas,
    asistencia,
    participantes,
    calendario: construirCalendario(sesiones.map((s) => s.fecha)),
    totales: {
      n_programas: programas.length,
      n_en_ejecucion: programas.filter((p) => p.estado_programa === 'En ejecución').length,
      n_sesiones: sesiones.length,
      n_realizadas: realizadas,
      n_tabuladas: nTab,
      n_pendientes: nPen,
      n_futuras: nFut,
      pct_cumplimiento: realizadas > 0 ? nTab / realizadas : null,
      n_participantes: participantes.length,
      n_en_riesgo: participantes.filter((p) => p.en_riesgo).length,
      pct_asistencia: asistencia.length > 0 ? asistieron / asistencia.length : null,
    },
  }
}
