/**
 * Genera `public/data/seed.json` a partir de las 8 carpetas de programa.
 *
 * Usa exactamente el mismo ETL que corre en el navegador, así que la semilla
 * no puede desviarse de lo que produciría una carga manual de los archivos.
 *
 *   npm run seed                  · con los datos reales, para uso local
 *   npm run seed -- --anonimizar  · con identidades sintéticas, para publicar
 *
 * La versión anonimizada conserva todos los números —fechas, horas de
 * inasistencia, estados— y sólo sustituye nombres y documentos, así que los
 * indicadores del panel no cambian.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { importarArchivos, type ArchivoEntrada } from '../src/lib/etl/index'
import { derivar } from '../src/lib/etl/derive'
import type { BaseConsolidada, CursoImportado } from '../src/lib/etl/types'
import { anonimizar } from './anonimizar'
import { descubrirProgramas, excelDe } from './descubrir'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(AQUI, '..')
const RAIZ = path.resolve(APP, '..')
const SALIDA = path.join(APP, 'public', 'data', 'seed.json')
const CORTE_REF = '2026-08-11'
const ANONIMO = process.argv.includes('--anonimizar')

function archivosDe(dir: string): ArchivoEntrada[] {
  return excelDe(dir).map((f) => ({
    nombre: f,
    datos: new Uint8Array(fs.readFileSync(path.join(dir, f))),
  }))
}

const encontradas = descubrirProgramas(RAIZ)
if (encontradas.length === 0) {
  console.error(`No encontré carpetas de programa en ${RAIZ}`)
  process.exit(1)
}

console.log(`Carpeta raíz: ${RAIZ}`)
console.log(`Programas detectados: ${encontradas.length}\n`)

const cursos: CursoImportado[] = []
let errores = 0

for (const { nombre, dir, relativa } of encontradas) {
  const r = importarArchivos(archivosDe(dir), nombre)
  const nErr = r.incidencias.filter((i) => i.severidad === 'error').length
  const nAvi = r.incidencias.filter((i) => i.severidad === 'aviso').length
  if (r.curso) {
    cursos.push(r.curso)
    console.log(
      `  [OK]    ${r.curso.programa.programa.padEnd(24)} ` +
      `${String(r.curso.sesiones.length).padStart(3)} sesiones, ` +
      `${String(r.curso.participantes.length).padStart(3)} participantes, ${nAvi} avisos`,
    )
  } else {
    errores++
    console.log(`  [FALLA] ${nombre}  (${relativa})`)
    for (const i of r.incidencias.filter((x) => x.severidad === 'error')) {
      console.log(`          · ${i.mensaje}${i.donde ? ` (${i.donde})` : ''}`)
    }
  }
  if (nErr && r.curso) errores++
}

cursos.sort((a, b) => a.programa.programa.localeCompare(b.programa.programa))

let base: BaseConsolidada = {
  version: 1,
  // Fijo y determinista: así el JSON no cambia entre corridas y el diff de git
  // sólo se mueve cuando cambian los datos de verdad.
  generado_en: `${CORTE_REF}T00:00:00.000Z`,
  cursos: cursos.map((c) => ({ ...c, importado_en: `${CORTE_REF}T00:00:00.000Z` })),
}

if (ANONIMO) {
  const { base: anonima, resumen } = anonimizar(base)
  base = anonima
  console.log(
    `
Anonimizado: ${resumen.participantes} participantes, ` +
    `${resumen.docentes} docentes y ${resumen.responsables} responsables ` +
    'recibieron identidades sintéticas.',
  )
}

fs.mkdirSync(path.dirname(SALIDA), { recursive: true })
fs.writeFileSync(SALIDA, JSON.stringify(base), 'utf8')

const d = derivar(base, CORTE_REF)
const kb = (fs.statSync(SALIDA).size / 1024).toFixed(0)

console.log(`\nResumen con fecha de corte ${CORTE_REF}:`)
console.log(`  sesiones      ${d.totales.n_sesiones}`)
console.log(`  tabuladas     ${d.totales.n_tabuladas}`)
console.log(`  pendientes    ${d.totales.n_pendientes}`)
console.log(`  futuras       ${d.totales.n_futuras}`)
console.log(`  cumplimiento  ${((d.totales.pct_cumplimiento ?? 0) * 100).toFixed(1)}%`)
console.log(`  en ejecución  ${d.totales.n_en_ejecucion} de ${d.totales.n_programas}`)
console.log(`  participantes ${d.totales.n_participantes} (${d.totales.n_en_riesgo} en riesgo)`)
console.log(`\n→ ${path.relative(APP, SALIDA)} (${kb} KB)`)

if (errores) {
  console.error(`\n${errores} programa(s) con errores.`)
  process.exit(1)
}
