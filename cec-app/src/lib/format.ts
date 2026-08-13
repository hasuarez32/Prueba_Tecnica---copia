/** Formateo consistente en toda la app (español de Colombia). */

import { MESES_CORTO } from './etl/normalize'
import { isoADate } from './etl/derive'

/** `2026-08-11` → `11/08/2026` */
export function fechaLarga(iso: string): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** `2026-08-11` → `11/08` */
export function fechaCorta(iso: string): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** `2026-08-11` → `11 ago` */
export function fechaDiaMes(iso: string): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MESES_CORTO[Number(m)]}`
}

/** Rango legible de una semana: `10 – 16 ago` */
export function rangoSemana(lunes: string, domingo: string): string {
  const [, m1, d1] = lunes.split('-')
  const [, m2, d2] = domingo.split('-')
  if (m1 === m2) return `${Number(d1)} – ${Number(d2)} ${MESES_CORTO[Number(m2)]}`
  return `${Number(d1)} ${MESES_CORTO[Number(m1)]} – ${Number(d2)} ${MESES_CORTO[Number(m2)]}`
}

/** Porcentaje con coma decimal: `0.746` → `74,6%` */
export function pct(v: number | null | undefined, decimales = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(decimales).replace('.', ',')}%`
}

export function numero(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('es-CO').format(v)
}

export function moneda(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(v)
}

/** Horario `08:00–13:00`, con guion largo como en los mockups. */
export function horario(inicio: string, fin: string): string {
  if (!inicio && !fin) return '—'
  if (!fin) return inicio
  return `${inicio}–${fin}`
}

/** Iniciales para el avatar del detalle académico. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '··'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * Los nombres del CONSOLIDADO vienen como «APELLIDO APELLIDO NOMBRE NOMBRE» y
 * en mayúsculas. Para leerlos en tablas se muestran capitalizados.
 */
export function nombrePropio(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p.length <= 2 && /^(de|la|del|los|y)$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

/** «hace 3 días» para la lista de acción. */
export function atraso(dias: number): string {
  if (dias <= 0) return '—'
  if (dias === 1) return '1 día'
  return `${dias} días`
}

export function esFinDeSemana(iso: string): boolean {
  const d = isoADate(iso).getDay()
  return d === 0 || d === 6
}
