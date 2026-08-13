/**
 * Modelo de datos — puerto TypeScript del esquema de
 * ESPECIFICACION_BASE_CONSOLIDADA.md §8.
 *
 * Separación importante frente al script de Python: aquí la **fecha de corte
 * es un control en vivo**, así que el modelo se parte en dos capas.
 *
 *  - Capa persistida (`CursoImportado`): lo que se lee del Excel y NO depende
 *    del tiempo (fechas, horas, si la columna del CONSOLIDADO tiene datos…).
 *  - Capa derivada (`Sesion`, `Programa`…): los estados que se recalculan
 *    contra la fecha de corte en cada render (`derivar()` en derive.ts).
 */

/** Fecha en formato `YYYY-MM-DD`. Se usa texto para evitar por completo los
 *  desfases de zona horaria al comparar y ordenar. */
export type ISODate = string

/** Hora en formato `HH:MM` (24 h). */
export type HoraTexto = string

export type Modalidad =
  | 'Presencial'
  | 'Virtual'
  | 'Remoto'
  | 'Híbrido'
  | 'Trabajo Independiente'
  | 'Práctica'

export type Jornada = 'Mañana' | 'Tarde'

export type EstadoSesion = 'Realizada' | 'Hoy' | 'Futura'

export type EstadoSeguimiento = 'Tabulada' | 'Pendiente de tabular' | 'Futura no exigible'

export type AsistenciaTabulada = 'Sí' | 'No' | 'N/A'

export type EstadoPrograma = 'Por iniciar' | 'En ejecución' | 'Finalizado'

export type SeveridadIncidencia = 'error' | 'aviso'

/**
 * Hallazgo de validación. `error` bloquea la importación; `aviso` la deja pasar
 * (§6: "distinguir errores de avisos"). Siempre dice qué, dónde y por qué.
 */
export interface Incidencia {
  severidad: SeveridadIncidencia
  /** Qué pasó, en una frase. */
  mensaje: string
  /** Dónde: archivo, hoja, columna o celda. */
  donde?: string
  /** Qué hacer al respecto. */
  sugerencia?: string
}

/** Sesión tal como sale del Excel, sin estados dependientes del corte. */
export interface SesionBase {
  id_sesion: string
  programa_id: string
  programa: string
  num_sesion: number | null
  modulo: string
  fecha: ISODate
  hora_inicio: HoraTexto
  hora_fin: HoraTexto
  intensidad_horaria: number | null
  jornada: Jornada
  modalidad: Modalidad | ''
  salon: string
  docente: string
  /** La columna del CONSOLIDADO que le corresponde tiene al menos un valor. */
  tabulada: boolean
  /** No se encontró columna para esta sesión en el CONSOLIDADO. */
  sin_columna: boolean
  n_participantes: number | null
  /** Sólo si `tabulada`: participantes con inasistencia < intensidad. */
  n_asistentes: number | null
  n_inasistentes: number | null
  observaciones: string[]
}

/** Sesión con todo lo que depende de la fecha de corte ya calculado. */
export interface Sesion extends SesionBase {
  anio: number
  mes: number
  mes_nombre: string
  dia: number
  dia_semana: string
  dia_semana_num: number
  semana_iso: number
  anio_semana: string
  estado_sesion: EstadoSesion
  estado_seguimiento: EstadoSeguimiento
  asistencia_tabulada: AsistenciaTabulada
  /** Días transcurridos desde la sesión hasta el corte. 0 si aún no ocurre. */
  dias_atraso: number
}

/** Metadatos del programa (FORMAS DE PAGO + CONSOLIDADO), sin agregados. */
export interface ProgramaBase {
  programa_id: string
  programa: string
  nombre_oficial: string
  nrc: string
  cod_banner: string
  codigo_contable: string
  coordinador: string
  experto_facilitador: string
  entidad_convenio: string
  modalidad: Modalidad | ''
  valor_programa: number | null
  n_participantes: number | null
  horas_totales: number | null
  horas_falla_max: number | null
  /** Carpeta o archivos de origen, para trazabilidad en la página Cursos. */
  origen: string
}

/** Programa con los agregados calculados contra la fecha de corte. */
export interface Programa extends ProgramaBase {
  fecha_inicio: ISODate | null
  fecha_fin: ISODate | null
  n_sesiones: number
  n_sesiones_realizadas: number
  n_sesiones_tabuladas: number
  n_sesiones_pendientes: number
  n_sesiones_futuras: number
  pct_cumplimiento_tabulacion: number | null
  estado_programa: EstadoPrograma
  n_participantes_reales: number
  n_en_riesgo: number
}

/** Un registro de asistencia: participante × sesión (sólo sesiones tabuladas). */
export interface Asistencia {
  id_registro: string
  programa_id: string
  id_sesion: string
  fecha: ISODate
  documento: string
  nombre: string
  empresa: string
  horas_inasistencia: number
  asistio: boolean
  tabulada: true
  /**
   * Columna del CONSOLIDADO de la que salió el valor. El CONSOLIDADO trae una
   * columna por día y el cronograma puede tener varias sesiones ese día, así
   * que varias filas comparten columna: sirve para deduplicar al sumar horas.
   */
  columna: number
}

export interface Participante {
  programa_id: string
  programa: string
  documento: string
  nombre: string
  empresa: string
  /** Σ de inasistencia, deduplicado por columna del CONSOLIDADO. */
  total_inasistencia: number
  horas_falla_max: number | null
  en_riesgo: boolean
}

export interface DiaCalendario {
  fecha: ISODate
  anio: number
  mes: number
  mes_nombre: string
  dia: number
  dia_semana: string
  dia_semana_num: number
  semana_iso: number
  anio_semana: string
  es_fin_de_semana: boolean
}

/** Unidad que se guarda en IndexedDB / JSON: un curso ya normalizado. */
export interface CursoImportado {
  programa: ProgramaBase
  sesiones: SesionBase[]
  asistencia: Asistencia[]
  participantes: Participante[]
  incidencias: Incidencia[]
  /** ISO timestamp de la importación. */
  importado_en: string
}

/** La base completa tal como se persiste. */
export interface BaseConsolidada {
  version: 1
  generado_en: string
  cursos: CursoImportado[]
}

/** Base con todos los estados ya calculados contra una fecha de corte. */
export interface BaseDerivada {
  fecha_corte: ISODate
  sesiones: Sesion[]
  programas: Programa[]
  asistencia: Asistencia[]
  participantes: Participante[]
  calendario: DiaCalendario[]
  totales: {
    n_programas: number
    n_en_ejecucion: number
    n_sesiones: number
    n_realizadas: number
    n_tabuladas: number
    n_pendientes: number
    n_futuras: number
    pct_cumplimiento: number | null
    n_participantes: number
    n_en_riesgo: number
    pct_asistencia: number | null
  }
}

/** Resultado de intentar importar un par de archivos. */
export interface ResultadoImportacion {
  ok: boolean
  curso: CursoImportado | null
  incidencias: Incidencia[]
  resumen: {
    archivo_cronograma: string | null
    archivo_listado: string | null
    n_sesiones: number
    rango: string
    n_participantes: number
    programa: string
  } | null
}
