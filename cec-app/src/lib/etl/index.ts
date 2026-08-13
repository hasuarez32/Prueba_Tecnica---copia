/**
 * Punto de entrada del ETL. Todo lo que la app necesita para pasar de un par de
 * archivos `.xlsx` a la base consolidada en memoria.
 */

import type { CursoImportado, Incidencia, ResultadoImportacion, BaseConsolidada } from './types'
import { leerLibro } from './sheet'
import { construirCurso, type EntradaCurso } from './build'
import { pareceCronograma, pareceListado } from './consolidado'
import { MESES_CORTO } from './normalize'
import type * as XLSX from 'xlsx'

export * from './types'
export * from './normalize'
export * from './derive'
export { leerLibro, hojaAMatriz, buscarHoja } from './sheet'
export { construirCurso } from './build'
export { pareceCronograma, pareceListado } from './consolidado'

export interface ArchivoEntrada {
  nombre: string
  datos: ArrayBuffer | Uint8Array
}

/** Extensiones que cuentan como evidencia fotográfica. */
const RE_IMAGEN = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/i

function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${MESES_CORTO[Number(m)]}`
}

/**
 * Clasifica los archivos subidos (cuál es el cronograma y cuál el listado) y
 * construye el curso. Nunca lanza: los fallos salen como incidencias.
 */
export function importarArchivos(
  archivos: ArchivoEntrada[],
  nombreSugerido?: string,
): ResultadoImportacion {
  const incidencias: Incidencia[] = []

  if (archivos.length === 0) {
    return {
      ok: false,
      curso: null,
      resumen: null,
      incidencias: [{
        severidad: 'error',
        mensaje: 'No se recibió ningún archivo.',
        sugerencia: 'Arrastra el cronograma y el listado de participantes del curso (.xlsx).',
      }],
    }
  }

  let cronograma: { libro: XLSX.WorkBook; archivo: string } | null = null
  let listado: { libro: XLSX.WorkBook; archivo: string } | null = null
  const sinClasificar: string[] = []
  let evidencias = 0

  for (const f of archivos) {
    // Si arrastran la carpeta entera vienen también las fotos: no son un error,
    // son la evidencia fotográfica del programa.
    if (RE_IMAGEN.test(f.nombre)) {
      evidencias++
      continue
    }
    if (!/\.xlsx?$/i.test(f.nombre) && !/\.xlsm$/i.test(f.nombre)) {
      incidencias.push({
        severidad: 'error',
        mensaje: `«${f.nombre}» no es un Excel.`,
        donde: f.nombre,
        sugerencia: 'Sólo se aceptan archivos .xlsx o .xls con las hojas del CEC.',
      })
      continue
    }

    let libro: XLSX.WorkBook
    try {
      libro = leerLibro(f.datos)
    } catch (e) {
      incidencias.push({
        severidad: 'error',
        mensaje: `No se pudo abrir «${f.nombre}»: el archivo está dañado o no es un Excel válido.`,
        donde: f.nombre,
        sugerencia: 'Vuelve a exportarlo desde Excel y súbelo de nuevo.',
      })
      continue
    }

    // El nombre orienta, pero manda el contenido.
    const porNombre = /^cronograma/i.test(f.nombre.trim())
    if ((porNombre || pareceCronograma(libro)) && !cronograma && !pareceListado(libro)) {
      cronograma = { libro, archivo: f.nombre }
    } else if (pareceListado(libro) && !listado) {
      listado = { libro, archivo: f.nombre }
    } else if (pareceCronograma(libro) && !cronograma) {
      cronograma = { libro, archivo: f.nombre }
    } else {
      sinClasificar.push(f.nombre)
    }
  }

  // Si no se reconoció ninguno de los dos archivos clave, el problema es
  // bloqueante y hay que decirlo como error: ignorarlo sería fallar en silencio.
  const nadaReconocido = !cronograma && !listado
  for (const nombre of sinClasificar) {
    incidencias.push({
      severidad: nadaReconocido ? 'error' : 'aviso',
      mensaje: `No reconozco «${nombre}»: no parece un cronograma ni un listado de participantes del CEC. Puede estar dañado o ser otro documento.`,
      donde: nombre,
      sugerencia: 'El cronograma necesita una hoja con las columnas «Sesión» y «Fecha»; el listado, una hoja «CONSOLIDADO».',
    })
  }

  const nombre =
    nombreSugerido?.trim() ||
    (listado?.archivo ?? cronograma?.archivo ?? 'Curso')
      .replace(/\.[^.]+$/, '')
      .replace(/^(GUECFT\d+_)?listado\s*de\s*participantes[_\s-]*/i, '')
      .replace(/^cronograma[_\s-]*/i, '')
      .replace(/[_]+/g, ' ')
      .trim()

  const entrada: EntradaCurso = { nombre, cronograma, listado, evidencias }
  const { curso, incidencias: incBuild } = construirCurso(entrada)
  const todas = [...incidencias, ...incBuild]
  const hayErrores = todas.some((i) => i.severidad === 'error')

  if (!curso || hayErrores) {
    return { ok: false, curso: null, incidencias: todas, resumen: null }
  }

  const fechas = curso.sesiones.map((s) => s.fecha).sort()
  return {
    ok: true,
    curso,
    incidencias: todas,
    resumen: {
      archivo_cronograma: cronograma?.archivo ?? null,
      archivo_listado: listado?.archivo ?? null,
      n_sesiones: curso.sesiones.length,
      rango: fechas.length ? `${fechaCorta(fechas[0])} → ${fechaCorta(fechas[fechas.length - 1])}` : '—',
      n_participantes: curso.participantes.length,
      programa: curso.programa.programa,
    },
  }
}

export function baseVacia(): BaseConsolidada {
  return { version: 1, generado_en: new Date().toISOString(), cursos: [] }
}

/** Agrega o reemplaza un curso (mismo `programa_id`) y devuelve una base nueva. */
export function upsertCurso(base: BaseConsolidada, curso: CursoImportado): BaseConsolidada {
  const cursos = base.cursos.filter((c) => c.programa.programa_id !== curso.programa.programa_id)
  cursos.push(curso)
  cursos.sort((a, b) => a.programa.programa.localeCompare(b.programa.programa))
  return { version: 1, generado_en: new Date().toISOString(), cursos }
}

/**
 * Deduplica cursos por `programa_id`.
 *
 * La estructura del CEC organiza las carpetas por mes y, dentro de cada mes,
 * por los **programas vigentes**: un diplomado de julio a septiembre aparece en
 * las tres carpetas. Sin deduplicar, sus sesiones y participantes se contarían
 * una vez por mes.
 *
 * De las copias se conserva la que tenga más sesiones tabuladas —la asistencia
 * más al día, que suele ser la del mes más reciente—; a igualdad, la que traiga
 * más sesiones. Las descartadas se reportan para que no desaparezcan en silencio.
 */
export function consolidarCursos(cursos: CursoImportado[]): {
  cursos: CursoImportado[]
  duplicados: Array<{ programa_id: string; programa: string; conservado: string; descartados: string[] }>
} {
  const porId = new Map<string, CursoImportado[]>()
  for (const c of cursos) {
    const lista = porId.get(c.programa.programa_id)
    if (lista) lista.push(c)
    else porId.set(c.programa.programa_id, [c])
  }

  const salida: CursoImportado[] = []
  const duplicados: Array<{ programa_id: string; programa: string; conservado: string; descartados: string[] }> = []

  for (const [id, copias] of porId) {
    if (copias.length === 1) {
      salida.push(copias[0])
      continue
    }
    const ordenadas = [...copias].sort((a, b) => {
      const ta = a.sesiones.filter((s) => s.tabulada).length
      const tb = b.sesiones.filter((s) => s.tabulada).length
      if (ta !== tb) return tb - ta
      if (a.sesiones.length !== b.sesiones.length) return b.sesiones.length - a.sesiones.length
      return a.programa.origen.localeCompare(b.programa.origen)
    })
    const elegida = ordenadas[0]
    salida.push(elegida)
    duplicados.push({
      programa_id: id,
      programa: elegida.programa.programa,
      conservado: elegida.programa.origen,
      descartados: ordenadas.slice(1).map((c) => c.programa.origen),
    })
  }

  salida.sort((a, b) => a.programa.programa.localeCompare(b.programa.programa))
  return { cursos: salida, duplicados }
}

export function quitarCurso(base: BaseConsolidada, programaId: string): BaseConsolidada {
  return {
    version: 1,
    generado_en: new Date().toISOString(),
    cursos: base.cursos.filter((c) => c.programa.programa_id !== programaId),
  }
}
