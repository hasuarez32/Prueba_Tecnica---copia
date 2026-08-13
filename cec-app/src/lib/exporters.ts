/**
 * Exportación: JSON de la base y Excel con el mismo esquema estrella de
 * `base_consolidada.xlsx` (§8 de ESPECIFICACION_BASE_CONSOLIDADA.md).
 */

import * as XLSX from 'xlsx'
import type { BaseConsolidada, BaseDerivada } from './etl/types'

export function descargar(nombre: string, contenido: Blob): void {
  const url = URL.createObjectURL(contenido)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function exportarJSON(base: BaseConsolidada, nombre = 'base_cec.json'): void {
  descargar(nombre, new Blob([JSON.stringify(base, null, 2)], { type: 'application/json' }))
}

/** Valida la forma de un JSON importado antes de aceptarlo. */
export function leerJSON(texto: string): { base: BaseConsolidada | null; error: string | null } {
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    return { base: null, error: 'El archivo no es un JSON válido.' }
  }
  const b = datos as Partial<BaseConsolidada>
  if (!b || typeof b !== 'object' || !Array.isArray(b.cursos)) {
    return { base: null, error: 'El JSON no tiene la forma esperada: falta la lista «cursos».' }
  }
  for (const c of b.cursos) {
    if (!c?.programa?.programa_id || !Array.isArray(c.sesiones)) {
      return { base: null, error: 'Alguno de los cursos del JSON no trae «programa» o «sesiones».' }
    }
  }
  return {
    base: { version: 1, generado_en: b.generado_en ?? new Date().toISOString(), cursos: b.cursos },
    error: null,
  }
}

const HOJAS: Record<string, string[]> = {
  fct_sesiones: [
    'id_sesion', 'programa_id', 'programa', 'num_sesion', 'modulo', 'fecha', 'anio', 'mes',
    'mes_nombre', 'dia_semana', 'dia_semana_num', 'semana_iso', 'anio_semana', 'jornada',
    'hora_inicio', 'hora_fin', 'intensidad_horaria', 'modalidad', 'salon', 'docente',
    'estado_sesion', 'asistencia_tabulada', 'estado_seguimiento', 'n_participantes',
    'n_asistentes', 'n_inasistentes', 'observaciones',
  ],
  dim_programas: [
    'programa_id', 'programa', 'nombre_oficial', 'nrc', 'cod_banner', 'codigo_contable',
    'coordinador', 'experto_facilitador', 'entidad_convenio', 'modalidad', 'valor_programa',
    'n_participantes', 'fecha_inicio', 'fecha_fin', 'n_sesiones', 'horas_totales',
    'horas_falla_max', 'n_sesiones_realizadas', 'n_sesiones_tabuladas', 'n_sesiones_pendientes',
    'pct_cumplimiento_tabulacion', 'estado_programa',
  ],
  dim_calendario: [
    'fecha', 'anio', 'mes', 'mes_nombre', 'dia', 'dia_semana', 'dia_semana_num', 'semana_iso',
    'anio_semana', 'es_fin_de_semana',
  ],
  fct_asistencia: [
    'id_registro', 'programa_id', 'id_sesion', 'fecha', 'documento', 'nombre', 'empresa',
    'horas_inasistencia', 'asistio', 'tabulada',
  ],
  dim_participantes: [
    'programa_id', 'documento', 'nombre', 'empresa', 'total_inasistencia', 'horas_falla_max',
    'en_riesgo',
  ],
}

function aFilas(datos: Record<string, unknown>[], columnas: string[]): unknown[][] {
  return [columnas, ...datos.map((d) => columnas.map((c) => {
    const v = d[c]
    if (v === undefined || v === null) return null
    if (Array.isArray(v)) return v.join('; ')
    return v as unknown
  }))]
}

/** Excel con una hoja por tabla, una sola fila de encabezados y sin combinar. */
export function exportarExcel(d: BaseDerivada, nombre = 'base_consolidada_web.xlsx'): void {
  const libro = XLSX.utils.book_new()

  const fuentes: Record<string, Record<string, unknown>[]> = {
    fct_sesiones: d.sesiones.map((s) => ({ ...s, observaciones: s.observaciones.join('; ') })),
    dim_programas: d.programas as unknown as Record<string, unknown>[],
    dim_calendario: d.calendario as unknown as Record<string, unknown>[],
    fct_asistencia: d.asistencia as unknown as Record<string, unknown>[],
    dim_participantes: d.participantes as unknown as Record<string, unknown>[],
  }

  for (const [hoja, columnas] of Object.entries(HOJAS)) {
    const ws = XLSX.utils.aoa_to_sheet(aFilas(fuentes[hoja], columnas))
    ws['!cols'] = columnas.map((c) => ({ wch: Math.max(12, Math.min(38, c.length + 6)) }))
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(libro, ws, hoja)
  }

  const params = XLSX.utils.aoa_to_sheet([
    ['parametro', 'valor', 'descripcion'],
    ['fecha_corte', d.fecha_corte, 'Fecha de corte usada para los estados (editable).'],
    ['fecha_generacion', new Date().toISOString().slice(0, 19).replace('T', ' '),
      'Momento en que se exportó desde la app web.'],
  ])
  params['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(libro, params, 'Parametros')

  const buffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array' })
  descargar(nombre, new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
}

/** CSV de una tabla cualquiera, para las exportaciones puntuales de cada página. */
export function exportarCSV(
  filas: Record<string, unknown>[],
  columnas: string[],
  nombre: string,
): void {
  const escapar = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = Array.isArray(v) ? v.join('; ') : String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lineas = [
    columnas.join(';'),
    ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(';')),
  ]
  // BOM para que Excel en español abra los acentos bien.
  descargar(nombre, new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
}
