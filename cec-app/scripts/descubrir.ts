/**
 * Descubrimiento de carpetas de programa.
 *
 * El enunciado describe la estructura real del CEC organizada **por mes y
 * dentro de cada mes por programa** (`JULIO 2026/<programa>/Equipo Logístico/…`),
 * mientras que la copia de trabajo viene aplanada (`<programa>/Equipo Logístico/…`).
 * En vez de asumir una profundidad fija, se busca en profundidad la carpeta
 * `Listado de Clases` y se toma como programa la que contiene a `Equipo Logístico`.
 *
 * Así funciona igual con las dos estructuras, y con cualquier nivel intermedio
 * que aparezca después (por ejemplo, un año encima del mes).
 */

import fs from 'node:fs'
import path from 'node:path'

export interface CarpetaPrograma {
  /** Nombre del programa: la carpeta que contiene a «Equipo Logístico». */
  nombre: string
  /** Ruta absoluta de «Listado de Clases». */
  dir: string
  /** Ruta relativa desde la raíz, útil para el log (incluye el mes si existe). */
  relativa: string
  /** Archivos de la carpeta «Evidencia Fotográfica» hermana, si existe. */
  evidencias: number
}

const RE_IMAGEN = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/i

/** Cuenta las fotos de «Equipo Logístico/Evidencia Fotográfica». */
function contarEvidencias(dirClases: string): number {
  const equipo = path.dirname(dirClases)
  let total = 0
  try {
    for (const e of fs.readdirSync(equipo, { withFileTypes: true })) {
      if (!e.isDirectory() || !norm(e.name).startsWith('evidencia')) continue
      for (const f of fs.readdirSync(path.join(equipo, e.name))) {
        if (RE_IMAGEN.test(f)) total++
      }
    }
  } catch {
    return 0 // sin carpeta de evidencias o sin permisos
  }
  return total
}

const PROFUNDIDAD_MAXIMA = 5

/** Normaliza para comparar nombres de carpeta sin depender de tildes ni caja. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

const IGNORAR = new Set([
  'node_modules', 'dist', '.git', 'evidencia fotografica', 'participantes',
])

export function descubrirProgramas(raiz: string): CarpetaPrograma[] {
  const encontradas: CarpetaPrograma[] = []

  function recorrer(dir: string, profundidad: number): void {
    if (profundidad > PROFUNDIDAD_MAXIMA) return
    let entradas: fs.Dirent[]
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return // carpeta sin permisos o eliminada a mitad del recorrido
    }

    for (const e of entradas) {
      if (!e.isDirectory()) continue
      const n = norm(e.name)
      if (n.startsWith('.') || IGNORAR.has(n)) continue

      const completa = path.join(dir, e.name)

      if (n === 'listado de clases') {
        // El programa es el abuelo: <programa>/Equipo Logístico/Listado de Clases
        const programa = path.basename(path.dirname(path.dirname(completa)))
        encontradas.push({
          nombre: programa,
          dir: completa,
          relativa: path.relative(raiz, completa),
          evidencias: contarEvidencias(completa),
        })
        continue // no hace falta bajar más por esta rama
      }

      recorrer(completa, profundidad + 1)
    }
  }

  recorrer(raiz, 0)

  // Orden estable para que la salida sea reproducible.
  encontradas.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.dir.localeCompare(b.dir))
  return encontradas
}

/** Los `.xlsx` de una carpeta de clases, ignorando los temporales de Excel. */
export function excelDe(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$'))
    .sort()
}
