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

  for (const f of archivos) {
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

  const entrada: EntradaCurso = { nombre, cronograma, listado }
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

export function quitarCurso(base: BaseConsolidada, programaId: string): BaseConsolidada {
  return {
    version: 1,
    generado_en: new Date().toISOString(),
    cursos: base.cursos.filter((c) => c.programa.programa_id !== programaId),
  }
}
