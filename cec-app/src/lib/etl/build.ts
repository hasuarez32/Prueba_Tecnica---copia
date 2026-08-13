/**
 * Ensamblador: cronograma + CONSOLIDADO → `CursoImportado`.
 *
 * Aquí vive la regla clave de §5: emparejar cada sesión con su columna del
 * CONSOLIDADO. Ojo con un detalle que no es obvio en el .md pero sí en los
 * datos reales: el CONSOLIDADO trae **una columna por día** (o por día+jornada)
 * mientras el cronograma puede tener **varias sesiones ese mismo día**. Por eso
 * varias sesiones pueden compartir columna, y por eso el Σ de inasistencia se
 * deduplica por columna al calcular el riesgo académico.
 *
 * Nada de lo que se calcula aquí depende de la fecha de corte: eso vive en
 * `derive.ts`, porque el corte es un control en vivo de la app.
 */

import type * as XLSX from 'xlsx'
import type {
  CursoImportado, Incidencia, ISODate, SesionBase, Asistencia, Participante,
  ProgramaBase, Jornada,
} from './types'
import { leerCronograma } from './cronograma'
import { leerConsolidado, leerFormasDePago, type ColumnaSesion } from './consolidado'
import {
  identificarPrograma, normalizarModalidad, parseNum, limpiarTexto, sentenceCase,
} from './normalize'

export interface EntradaCurso {
  /** Nombre sugerido del programa (carpeta o archivo). */
  nombre: string
  cronograma: { libro: XLSX.WorkBook; archivo: string } | null
  listado: { libro: XLSX.WorkBook; archivo: string } | null
}

function jornadaDeHora(hora: string | null): Jornada {
  if (!hora) return 'Tarde'
  const h = Number(hora.slice(0, 2))
  return h < 12 ? 'Mañana' : 'Tarde'
}

/**
 * Elige la columna del CONSOLIDADO que corresponde a la sesión.
 * Prioridad: (1) jornada compatible — una columna sin jornada es comodín,
 * (2) columna con datos, (3) la de más a la izquierda.
 */
function emparejar(
  fecha: ISODate,
  jornada: Jornada,
  porFecha: Map<ISODate, ColumnaSesion[]>,
): { columna: ColumnaSesion | null; candidatas: number } {
  const candidatas = porFecha.get(fecha) ?? []
  if (candidatas.length === 0) return { columna: null, candidatas: 0 }
  const ordenadas = [...candidatas].sort((a, b) => {
    const ia = a.jornada === null || a.jornada === jornada ? 0 : 1
    const ib = b.jornada === null || b.jornada === jornada ? 0 : 1
    if (ia !== ib) return ia - ib
    const da = a.tabulada ? 0 : 1
    const db = b.tabulada ? 0 : 1
    if (da !== db) return da - db
    return a.col - b.col
  })
  return { columna: ordenadas[0], candidatas: candidatas.length }
}

export function construirCurso(entrada: EntradaCurso): {
  curso: CursoImportado | null
  incidencias: Incidencia[]
} {
  const incidencias: Incidencia[] = []
  const { id: programaId, corto } = identificarPrograma(entrada.nombre)

  // ── Fuente A
  const cron = entrada.cronograma
    ? leerCronograma(entrada.cronograma.libro, entrada.cronograma.archivo)
    : { filas: [], incidencias: [], hoja: null, encabezados: [] }
  incidencias.push(...cron.incidencias)

  if (!entrada.cronograma) {
    incidencias.push({
      severidad: 'error',
      mensaje: 'Falta el archivo de cronograma: sin él no hay sesiones que mostrar.',
      donde: entrada.nombre,
      sugerencia: 'Sube también el Excel «Cronograma_*.xlsx» del curso.',
    })
  }

  // §10: ordenar por fecha, no por número de sesión (caso Odontología).
  const conFecha = cron.filas.filter((f) => f.fecha !== null)
  const ordenOriginal = conFecha.map((f) => f.num_sesion)
  conFecha.sort((a, b) => {
    if (a.fecha! !== b.fecha!) return a.fecha! < b.fecha! ? -1 : 1
    const ha = a.hora_inicio ?? '00:00'
    const hb = b.hora_inicio ?? '00:00'
    if (ha !== hb) return ha < hb ? -1 : 1
    return (a.num_sesion ?? 0) - (b.num_sesion ?? 0)
  })
  if (ordenOriginal.join('|') !== conFecha.map((f) => f.num_sesion).join('|')) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: 'El cronograma trae sesiones fuera de orden: se reordenaron por fecha.',
      donde: entrada.cronograma?.archivo ?? entrada.nombre,
    })
  }

  const nums = conFecha.map((f) => f.num_sesion).filter((n): n is number => n !== null)
  if (nums.length) {
    const min = Math.min(...nums)
    const max = Math.max(...nums)
    const faltan: number[] = []
    const set = new Set(nums)
    for (let i = min; i <= max; i++) if (!set.has(i)) faltan.push(i)
    if (faltan.length) {
      incidencias.push({
        severidad: 'aviso',
        mensaje: `La numeración de sesiones no es correlativa: faltan los números ${faltan.slice(0, 12).join(', ')}.`,
        donde: entrada.cronograma?.archivo ?? entrada.nombre,
      })
    }
  }

  const fechasCron = new Set<ISODate>(conFecha.map((f) => f.fecha!))
  const aniosCron = Array.from(fechasCron).map((f) => Number(f.slice(0, 4)))

  // ── Fuente B
  let meta = {
    experto_facilitador: '', nombre_oficial: '', entidad_convenio: '',
    modalidad_declarada: '', valor_programa: null as number | null,
    n_participantes: null as number | null, nrc: '', cod_banner: '',
    codigo_contable: '', coordinador: '', lugar_y_fecha: '',
  }
  let cons = {
    columnas: [] as ColumnaSesion[],
    participantes: [] as ReturnType<typeof leerConsolidado>['participantes'],
    horas_totales: null as number | null,
    horas_falla_max: null as number | null,
    ok: false,
  }

  if (entrada.listado) {
    const fdp = leerFormasDePago(entrada.listado.libro, entrada.listado.archivo)
    meta = fdp.meta
    incidencias.push(...fdp.incidencias)
    const r = leerConsolidado(
      entrada.listado.libro, entrada.listado.archivo, aniosCron, fechasCron,
    )
    incidencias.push(...r.incidencias)
    cons = {
      columnas: r.columnas, participantes: r.participantes,
      horas_totales: r.horas_totales, horas_falla_max: r.horas_falla_max, ok: r.ok,
    }
  } else {
    incidencias.push({
      severidad: 'error',
      mensaje: 'Falta el archivo de listado de participantes: sin él no hay asistencia ni tabulación.',
      donde: entrada.nombre,
      sugerencia: 'Sube también el Excel «*ListadodeParticipantes*.xlsx» del curso.',
    })
  }

  // §10: typo de año en metadatos → mandan las fechas del cronograma.
  if (meta.lugar_y_fecha && aniosCron.length) {
    const declarados = new Set<number>(
      (meta.lugar_y_fecha.match(/\b(20\d{2})\b/g) ?? []).map(Number),
    )
    const validos = new Set(aniosCron)
    const raros = [...declarados].filter((a) => !validos.has(a))
    if (raros.length) {
      incidencias.push({
        severidad: 'aviso',
        mensaje: `«LUGAR Y FECHA» declara el año ${raros.join(', ')} («${meta.lugar_y_fecha}») pero el cronograma es de ${[...validos].sort().join(', ')}: mandan las fechas del cronograma.`,
        donde: `${entrada.listado?.archivo ?? entrada.nombre} · hoja «FORMAS DE PAGO»`,
      })
    }
  }

  const nParticipantesMeta = meta.n_participantes === null ? null : Math.trunc(meta.n_participantes)
  if (nParticipantesMeta !== null && cons.participantes.length &&
      nParticipantesMeta !== cons.participantes.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `«NÚMERO DE PARTICIANTES» declara ${nParticipantesMeta} pero el CONSOLIDADO lista ${cons.participantes.length} participante(s).`,
      donde: `${entrada.listado?.archivo ?? entrada.nombre} · hoja «FORMAS DE PAGO»`,
      sugerencia: 'El panel usa el conteo real del CONSOLIDADO para las tasas de asistencia.',
    })
  }

  const porFecha = new Map<ISODate, ColumnaSesion[]>()
  for (const c of cons.columnas) {
    if (c.fecha === null) continue
    const lista = porFecha.get(c.fecha)
    if (lista) lista.push(c)
    else porFecha.set(c.fecha, [c])
  }

  // ── sesiones + asistencia
  const modalidadDeclarada = normalizarModalidad(meta.modalidad_declarada)
  const sesiones: SesionBase[] = []
  const asistencia: Asistencia[] = []
  const idsVistos = new Set<string>()

  const horasInvertidas: string[] = []
  const horasCero: string[] = []
  const fechaCruzada: string[] = []
  const sinColumnaLista: string[] = []
  const multiColumna = new Set<string>()

  for (const f of conFecha) {
    const obs: string[] = []
    const fecha = f.fecha!

    if (f.fecha_era_texto) obs.push('la fecha venía como texto')
    if (f.hora_era_texto) obs.push('la hora venía como texto')
    if (!f.hora_inicio) obs.push('sin hora de inicio')
    if (!f.hora_fin) obs.push('sin hora de fin')
    if (f.hora_fin === '00:00') {
      obs.push('hora de fin en 00:00')
      horasCero.push(String(f.num_sesion ?? f.orden_archivo))
    }
    if (f.hora_inicio && f.hora_fin && f.hora_fin <= f.hora_inicio) {
      obs.push('la hora de fin es anterior o igual a la de inicio')
      horasInvertidas.push(`sesión ${f.num_sesion ?? f.orden_archivo} ${f.hora_inicio}→${f.hora_fin}`)
    }
    for (const [etq, otra] of [
      ['hora de inicio', f.fecha_de_hora_inicio],
      ['hora de fin', f.fecha_de_hora_fin],
    ] as const) {
      if (otra && otra !== fecha) {
        obs.push(`${etq} registrada en otra fecha (${otra})`)
        fechaCruzada.push(`sesión ${f.num_sesion ?? f.orden_archivo} → ${otra}`)
      }
    }
    if (f.intensidad_horaria === null) obs.push('sin intensidad horaria')

    const jornada = jornadaDeHora(f.hora_inicio)
    if (!f.hora_inicio) obs.push('jornada asumida «tarde» por falta de hora de inicio')

    const modalidadSalon = normalizarModalidad(f.salon)
    const modalidad = modalidadSalon || modalidadDeclarada
    if (f.salon && !modalidadSalon) {
      obs.push(`el salón «${f.salon}» no corresponde a una modalidad conocida`)
    }

    const { columna, candidatas } = emparejar(fecha, jornada, porFecha)
    if (candidatas > 1) {
      obs.push(`${candidatas} columnas en el CONSOLIDADO para esa fecha`)
      multiColumna.add(fecha)
    }
    if (columna) columna.usada = true

    let idSesion = `${programaId}-${
      f.num_sesion !== null ? String(f.num_sesion).padStart(2, '0') : `S${String(f.orden_archivo).padStart(3, '0')}`
    }`
    if (idsVistos.has(idSesion)) {
      let sufijo = 2
      while (idsVistos.has(`${idSesion}.${sufijo}`)) sufijo++
      incidencias.push({
        severidad: 'aviso',
        mensaje: `El número de sesión ${f.num_sesion} está repetido: se desambiguó el identificador.`,
        donde: entrada.cronograma?.archivo ?? entrada.nombre,
      })
      idSesion = `${idSesion}.${sufijo}`
    }
    idsVistos.add(idSesion)

    if (!columna) {
      obs.push('sin columna en el CONSOLIDADO')
      sinColumnaLista.push(`sesión ${f.num_sesion ?? f.orden_archivo} del ${fecha}`)
    }

    const intensidad = f.intensidad_horaria
    const tabulada = !!columna && columna.tabulada
    let nAsistentes: number | null = null
    let nInasistentes: number | null = null

    if (tabulada && columna) {
      nAsistentes = 0
      nInasistentes = 0
      for (const p of cons.participantes) {
        const v = p.celdas.get(columna.col)
        if (v === undefined) continue
        const horas = parseNum(v)
        if (horas === null) {
          obs.push(`valor no numérico en el CONSOLIDADO («${String(v).slice(0, 20)}»)`)
          continue
        }
        const asistio = intensidad ? horas < intensidad : horas === 0
        if (asistio) nAsistentes++
        else nInasistentes++
        asistencia.push({
          id_registro: `${idSesion}|${p.documento || `F${p.fila}`}`,
          programa_id: programaId,
          id_sesion: idSesion,
          fecha,
          documento: p.documento,
          nombre: p.nombre,
          empresa: p.empresa,
          horas_inasistencia: horas,
          asistio,
          tabulada: true,
          columna: columna.col,
        })
      }
    }

    sesiones.push({
      id_sesion: idSesion,
      programa_id: programaId,
      programa: corto,
      num_sesion: f.num_sesion,
      modulo: f.modulo,
      fecha,
      hora_inicio: f.hora_inicio ?? '',
      hora_fin: f.hora_fin ?? '',
      intensidad_horaria: intensidad,
      jornada,
      modalidad,
      salon: f.salon,
      docente: f.docente,
      tabulada,
      sin_columna: !columna,
      n_participantes: nParticipantesMeta,
      n_asistentes: nAsistentes,
      n_inasistentes: nInasistentes,
      observaciones: Array.from(new Set(obs)),
    })
  }

  // ── resumen de banderas de fila como incidencias del curso
  if (horasInvertidas.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `${horasInvertidas.length} sesión(es) con hora de fin anterior o igual a la de inicio: ${horasInvertidas.slice(0, 5).join('; ')}. Se conservan tal cual.`,
      donde: entrada.cronograma?.archivo ?? entrada.nombre,
    })
  }
  if (horasCero.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `${horasCero.length} sesión(es) con hora de fin en 00:00 (sesión ${horasCero.slice(0, 5).join(', ')}).`,
      donde: entrada.cronograma?.archivo ?? entrada.nombre,
    })
  }
  if (fechaCruzada.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `${fechaCruzada.length} sesión(es) con la hora fechada en un día distinto al de la sesión: ${fechaCruzada.slice(0, 5).join('; ')}.`,
      donde: entrada.cronograma?.archivo ?? entrada.nombre,
    })
  }
  if (sinColumnaLista.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `${sinColumnaLista.length} sesión(es) del cronograma sin columna en el CONSOLIDADO (${sinColumnaLista.slice(0, 6).join(', ')}): quedan como no tabuladas.`,
      donde: entrada.listado?.archivo ?? entrada.nombre,
      sugerencia: 'Agrega la columna de esas fechas en el CONSOLIDADO para poder tabular su asistencia.',
    })
  }
  if (multiColumna.size) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `Fecha(s) con más de una columna en el CONSOLIDADO (${[...multiColumna].slice(0, 6).join(', ')}): se usa la que tiene datos y jornada compatible.`,
      donde: entrada.listado?.archivo ?? entrada.nombre,
    })
  }
  const huerfanas = cons.columnas.filter((c) => !c.usada && c.fecha !== null)
  if (huerfanas.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `${huerfanas.length} columna(s) del CONSOLIDADO no corresponden a ninguna sesión del cronograma (${huerfanas.slice(0, 6).map((c) => `«${c.etiqueta}» → ${c.fecha}`).join(', ')}).`,
      donde: entrada.listado?.archivo ?? entrada.nombre,
    })
  }

  // ── participantes y riesgo académico
  const participantes: Participante[] = []
  for (const p of cons.participantes) {
    // Σ deduplicado por columna: una columna sirve a varias sesiones del mismo
    // día, sumarla por sesión inflaría el total (§ riesgo académico).
    const vistas = new Set<number>()
    let total = 0
    for (const reg of asistencia) {
      if (reg.documento !== p.documento || reg.nombre !== p.nombre) continue
      if (vistas.has(reg.columna)) continue
      vistas.add(reg.columna)
      total += reg.horas_inasistencia
    }
    if (p.sigma !== null && Math.abs(total - p.sigma) > 1e-6) {
      incidencias.push({
        severidad: 'aviso',
        mensaje: `El Σ de inasistencia del archivo (${p.sigma}) no coincide con el recalculado (${total}) para «${p.nombre}».`,
        donde: `${entrada.listado?.archivo ?? entrada.nombre} · hoja «CONSOLIDADO» · fila ${p.fila + 1}`,
      })
    }
    participantes.push({
      programa_id: programaId,
      programa: corto,
      documento: p.documento,
      nombre: p.nombre,
      empresa: p.empresa,
      total_inasistencia: total,
      horas_falla_max: cons.horas_falla_max,
      en_riesgo: cons.horas_falla_max !== null && total > cons.horas_falla_max,
    })
  }

  const docs = participantes.map((p) => p.documento).filter(Boolean)
  const repetidos = docs.filter((d, i) => docs.indexOf(d) !== i)
  if (repetidos.length) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `Documento(s) repetido(s) en el CONSOLIDADO: ${[...new Set(repetidos)].slice(0, 5).join(', ')}.`,
      donde: entrada.listado?.archivo ?? entrada.nombre,
    })
  }

  const sumaIntensidad = sesiones.reduce((a, s) => a + (s.intensidad_horaria ?? 0), 0)
  if (cons.horas_totales && Math.abs(sumaIntensidad - cons.horas_totales) > 0.5) {
    incidencias.push({
      severidad: 'aviso',
      mensaje: `La suma de intensidad horaria del cronograma (${sumaIntensidad} h) no coincide con «NÚMERO DE HORAS» del CONSOLIDADO (${cons.horas_totales} h).`,
      donde: entrada.nombre,
    })
  }

  const hayErrores = incidencias.some((i) => i.severidad === 'error')
  if (hayErrores || sesiones.length === 0) {
    return { curso: null, incidencias }
  }

  const modalidades = sesiones.map((s) => s.modalidad).filter(Boolean) as string[]
  let modalidadPrograma: ProgramaBase['modalidad'] = modalidadDeclarada
  if (modalidades.length) {
    const conteo = new Map<string, number>()
    for (const m of modalidades) conteo.set(m, (conteo.get(m) ?? 0) + 1)
    const tope = Math.max(...conteo.values())
    modalidadPrograma = (modalidades.find((m) => conteo.get(m) === tope) ??
      modalidadDeclarada) as ProgramaBase['modalidad']
  }

  const programa: ProgramaBase = {
    programa_id: programaId,
    programa: corto,
    nombre_oficial: sentenceCase(limpiarTexto(meta.nombre_oficial)),
    nrc: meta.nrc,
    cod_banner: meta.cod_banner,
    codigo_contable: meta.codigo_contable,
    coordinador: meta.coordinador,
    experto_facilitador: meta.experto_facilitador,
    entidad_convenio: meta.entidad_convenio,
    modalidad: modalidadPrograma,
    valor_programa: meta.valor_programa,
    n_participantes: nParticipantesMeta,
    horas_totales: cons.horas_totales,
    horas_falla_max: cons.horas_falla_max,
    origen: [entrada.cronograma?.archivo, entrada.listado?.archivo].filter(Boolean).join(' + '),
  }

  return {
    curso: {
      programa,
      sesiones,
      asistencia,
      participantes,
      incidencias,
      importado_en: new Date().toISOString(),
    },
    incidencias,
  }
}
