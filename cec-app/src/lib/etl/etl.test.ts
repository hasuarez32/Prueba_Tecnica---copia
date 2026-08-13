/**
 * Pruebas del ETL contra las 8 carpetas de programa reales.
 *
 * Los números esperados salen de `base_consolidada.xlsx`, la salida de
 * referencia del script de Python (§9 de ESPECIFICACION_APP_WEB.md).
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { importarArchivos, type ArchivoEntrada } from './index'
import { derivar, semanaISO, lunesDe, diasEntre, estadoSeguimiento } from './derive'
import {
  parseFecha, parseHora, parseNum, limpiarDocumento, normalizarModalidad, norm, mesANumero,
} from './normalize'
import type { BaseConsolidada, CursoImportado } from './types'
import { descubrirProgramas, excelDe } from '../../../scripts/descubrir'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
const CORTE = '2026-08-11'

/** Busca en profundidad, así funciona con la estructura plana y con la del
 *  enunciado (`JULIO 2026/<programa>/Equipo Logístico/…`). */
function carpetasDePrograma(): Array<{ nombre: string; dir: string }> {
  return descubrirProgramas(RAIZ)
}

function leerCarpeta(dir: string): ArchivoEntrada[] {
  return excelDe(dir).map((f) => ({
    nombre: f,
    datos: new Uint8Array(fs.readFileSync(path.join(dir, f))),
  }))
}

/**
 * Los Excel de ejemplo traen datos personales reales, así que no viajan en el
 * repositorio. Cuando no están (CI, o un clon limpio), estas pruebas se saltan
 * en vez de fallar: en la máquina de quien tiene los archivos sí corren.
 */
const HAY_EXCEL = carpetasDePrograma().length > 0
const conExcel = describe.skipIf(!HAY_EXCEL)

let baseCache: BaseConsolidada | null = null

function baseCompleta(): BaseConsolidada {
  if (baseCache) return baseCache
  const cursos: CursoImportado[] = []
  for (const { nombre, dir } of carpetasDePrograma()) {
    const r = importarArchivos(leerCarpeta(dir), nombre)
    if (r.curso) cursos.push(r.curso)
  }
  cursos.sort((a, b) => a.programa.programa.localeCompare(b.programa.programa))
  baseCache = { version: 1, generado_en: new Date().toISOString(), cursos }
  return baseCache
}

describe('primitivas de normalización', () => {
  it('normaliza texto quitando tildes y puntuación de borde', () => {
    expect(norm('  Sesión: ')).toBe('sesion')
    expect(norm('DOCUMENTO DE IDENTIDAD')).toBe('documento de identidad')
    expect(norm(null)).toBe('')
  })

  it('interpreta fechas en cualquier representación', () => {
    expect(parseFecha(new Date(2026, 6, 25))).toBe('2026-07-25')
    expect(parseFecha('2026-07-25')).toBe('2026-07-25')
    expect(parseFecha('24/07/2026')).toBe('2026-07-24')
    expect(parseFecha('14 de julio del 2026')).toBe('2026-07-14')
    expect(parseFecha(46228)).toBe('2026-07-25') // serial de Excel
    expect(parseFecha('')).toBeNull()
    expect(parseFecha('no es fecha')).toBeNull()
  })

  it('interpreta horas como texto, Date y fracción de día', () => {
    expect(parseHora(new Date(2026, 6, 25, 8, 0))).toBe('08:00')
    expect(parseHora('8:00 a.m.')).toBe('08:00')
    expect(parseHora('6:30 p.m.')).toBe('18:30')
    expect(parseHora('18:00')).toBe('18:00')
    expect(parseHora(0.5)).toBe('12:00')
    expect(parseHora('nada')).toBeNull()
  })

  it('interpreta números con separadores latinos', () => {
    expect(parseNum(1400000)).toBe(1400000)
    expect(parseNum('$ 1.400.000')).toBe(1400000)
    expect(parseNum('1,5')).toBe(1.5)
    expect(parseNum('')).toBeNull()
  })

  it('toma el primer número del documento (§10)', () => {
    expect(limpiarDocumento('12345 /67890')).toBe('12345')
    expect(limpiarDocumento(1099887766)).toBe('1099887766')
    expect(limpiarDocumento('1.122.334.455')).toBe('1122334455')
    expect(limpiarDocumento(0)).toBe('')
    expect(limpiarDocumento(null)).toBe('')
  })

  it('normaliza la modalidad al set fijo (§7)', () => {
    expect(normalizarModalidad('PRESENCIAL-VIRTUAL')).toBe('Híbrido')
    expect(normalizarModalidad('PRESENCIAL-HOSPITAL UNIVERSIDAD DEL NORTE')).toBe('Práctica')
    expect(normalizarModalidad('Trabajo Independiente')).toBe('Trabajo Independiente')
    expect(normalizarModalidad('REMOTO')).toBe('Remoto')
    expect(normalizarModalidad('Blended')).toBe('Híbrido')
    expect(normalizarModalidad('')).toBe('')
  })

  it('reconoce nombres de mes y descarta los que no lo son', () => {
    expect(mesANumero('JULIO')).toBe(7)
    expect(mesANumero('Septiembre')).toBe(9)
    expect(mesANumero('MES')).toBeNull() // caso Integración Sensorial
  })
})

describe('fechas derivadas', () => {
  it('calcula la semana ISO', () => {
    expect(semanaISO('2026-08-11').semana).toBe(33)
    expect(lunesDe('2026-08-11')).toBe('2026-08-10')
    expect(diasEntre('2026-07-31', '2026-08-11')).toBe(11)
  })

  it('aplica la regla de tabulación de §5', () => {
    expect(estadoSeguimiento(true, '2026-09-30', CORTE)).toBe('Tabulada')
    expect(estadoSeguimiento(false, '2026-07-31', CORTE)).toBe('Pendiente de tabular')
    expect(estadoSeguimiento(false, '2026-08-15', CORTE)).toBe('Futura no exigible')
    // el día del corte cuenta como realizado
    expect(estadoSeguimiento(false, CORTE, CORTE)).toBe('Pendiente de tabular')
  })
})

conExcel('importación de las 8 carpetas de ejemplo', () => {
  it('encuentra las 8 carpetas de programa', () => {
    expect(carpetasDePrograma()).toHaveLength(8)
  })

  it('importa los 8 cursos sin errores bloqueantes', () => {
    const base = baseCompleta()
    expect(base.cursos).toHaveLength(8)
    for (const c of base.cursos) {
      const errores = c.incidencias.filter((i) => i.severidad === 'error')
      expect(errores, `${c.programa.programa}: ${errores.map((e) => e.mensaje).join(' | ')}`)
        .toHaveLength(0)
    }
  })

  it('reproduce los totales de base_consolidada.xlsx con corte 11/08/2026', () => {
    const d = derivar(baseCompleta(), CORTE)
    expect(d.totales.n_sesiones).toBe(130)
    expect(d.totales.n_tabuladas).toBe(44)
    expect(d.totales.n_pendientes).toBe(15)
    expect(d.totales.n_futuras).toBe(71)
    expect(d.totales.n_realizadas).toBe(59)
    expect(d.totales.n_participantes).toBe(108)
    expect(d.totales.n_en_riesgo).toBe(3)
    expect(d.totales.n_en_ejecucion).toBe(6)
    expect(d.totales.n_programas).toBe(8)
    // 44/59 = 74,6 %
    expect((d.totales.pct_cumplimiento! * 100).toFixed(1)).toBe('74.6')
    // 676/746 = 90,6 %
    expect((d.totales.pct_asistencia! * 100).toFixed(1)).toBe('90.6')
    expect(d.asistencia).toHaveLength(746)
  })

  it('reparte sesiones y estados por programa igual que la base', () => {
    const d = derivar(baseCompleta(), CORTE)
    const esperado: Record<string, [number, number, number, number]> = {
      // programa_id: [sesiones, tabuladas, pendientes, futuras]
      BIENESTAR: [4, 3, 0, 1],
      BOOTCAMP: [4, 2, 2, 0],
      HERIDAS: [37, 11, 5, 21],
      ECOGRAFIA: [22, 6, 1, 15],
      ODONTOLOGIA: [17, 0, 2, 15],
      NORMATIVIDAD: [30, 10, 3, 17],
      PROJECT: [12, 12, 0, 0],
      SENSORIAL: [4, 0, 2, 2],
    }
    for (const [id, [n, tab, pen, fut]] of Object.entries(esperado)) {
      const p = d.programas.find((x) => x.programa_id === id)
      expect(p, `falta el programa ${id}`).toBeDefined()
      expect([p!.n_sesiones, p!.n_sesiones_tabuladas, p!.n_sesiones_pendientes, p!.n_sesiones_futuras],
        `${id} no cuadra`).toEqual([n, tab, pen, fut])
    }
  })

  it('marca como pendientes el 31/07 y el 08/08 de Heridas (§9)', () => {
    const d = derivar(baseCompleta(), CORTE)
    const heridas = d.sesiones.filter((s) => s.programa_id === 'HERIDAS')

    const del31 = heridas.filter((s) => s.fecha === '2026-07-31')
    expect(del31).toHaveLength(4)
    for (const s of del31) expect(s.estado_seguimiento).toBe('Pendiente de tabular')

    const del08 = heridas.filter((s) => s.fecha === '2026-08-08')
    expect(del08).toHaveLength(1)
    expect(del08[0].estado_seguimiento).toBe('Pendiente de tabular')

    // control: los días vecinos sí están tabulados
    for (const f of ['2026-07-30', '2026-08-01', '2026-08-06']) {
      const ses = heridas.filter((s) => s.fecha === f)
      expect(ses.length).toBeGreaterThan(0)
      for (const s of ses) expect(s.estado_seguimiento).toBe('Tabulada')
    }
  })

  it('deja Bienestar con 3 tabuladas y el 15/08 futuro (§9)', () => {
    const d = derivar(baseCompleta(), CORTE)
    const b = d.sesiones.filter((s) => s.programa_id === 'BIENESTAR')
    expect(b).toHaveLength(4)
    expect(b.filter((s) => s.estado_seguimiento === 'Tabulada')).toHaveLength(3)
    const ultima = b.find((s) => s.fecha === '2026-08-15')!
    expect(ultima.estado_seguimiento).toBe('Futura no exigible')
    expect(ultima.asistencia_tabulada).toBe('N/A')
  })

  it('identifica a los 3 participantes en riesgo', () => {
    const d = derivar(baseCompleta(), CORTE)
    const riesgo = d.participantes.filter((p) => p.en_riesgo)
      .map((p) => [p.programa_id, p.total_inasistencia, p.horas_falla_max])
      .sort()
    expect(riesgo).toEqual([
      ['BOOTCAMP', 6, 5],
      ['PROJECT', 36, 9],
      ['PROJECT', 36, 9],
    ])
  })

  it('recalcula el Σ de inasistencia sin duplicar por sesiones del mismo día', () => {
    // Heridas tiene 4 sesiones el 24/07 que comparten una sola columna del
    // CONSOLIDADO: sumar por sesión multiplicaría las horas por cuatro.
    const base = baseCompleta()
    const heridas = base.cursos.find((c) => c.programa.programa_id === 'HERIDAS')!
    const conFalla = heridas.participantes.filter((p) => p.total_inasistencia > 0)
    expect(conFalla.length).toBeGreaterThan(0)
    for (const p of heridas.participantes) {
      expect(p.total_inasistencia).toBeLessThanOrEqual(heridas.programa.horas_totales ?? 999)
    }
    // ningún participante de Heridas supera el tope de 20 h
    expect(heridas.participantes.filter((p) => p.en_riesgo)).toHaveLength(0)
  })

  it('normaliza las modalidades al set permitido', () => {
    const d = derivar(baseCompleta(), CORTE)
    const permitidas = new Set([
      'Presencial', 'Virtual', 'Remoto', 'Híbrido', 'Trabajo Independiente', 'Práctica', '',
    ])
    for (const s of d.sesiones) expect(permitidas.has(s.modalidad)).toBe(true)
  })

  it('mantiene identificadores únicos y claves foráneas íntegras', () => {
    const d = derivar(baseCompleta(), CORTE)
    const ids = d.sesiones.map((s) => s.id_sesion)
    expect(new Set(ids).size).toBe(ids.length)
    const registros = d.asistencia.map((a) => a.id_registro)
    expect(new Set(registros).size).toBe(registros.length)
    const setIds = new Set(ids)
    for (const a of d.asistencia) expect(setIds.has(a.id_sesion)).toBe(true)
    // sólo hay asistencia de sesiones tabuladas
    const tabuladas = new Set(
      d.sesiones.filter((s) => s.estado_seguimiento === 'Tabulada').map((s) => s.id_sesion),
    )
    for (const a of d.asistencia) expect(tabuladas.has(a.id_sesion)).toBe(true)
  })

  it('conserva las incidencias de calidad de datos del checklist §10', () => {
    const base = baseCompleta()
    const texto = (id: string) =>
      base.cursos.find((c) => c.programa.programa_id === id)!
        .incidencias.map((i) => i.mensaje).join(' || ')

    expect(texto('HERIDAS')).toMatch(/2025/)              // typo de año
    expect(texto('HERIDAS')).toMatch(/hora de fin anterior/)
    expect(texto('ODONTOLOGIA')).toMatch(/fuera de orden/) // sesiones desordenadas
    expect(texto('NORMATIVIDAD')).toMatch(/00:00/)         // hora de fin en cero
    expect(texto('NORMATIVIDAD')).toMatch(/sin columna en el CONSOLIDADO/)
    expect(texto('SENSORIAL')).toMatch(/sin fecha reconstruible/)
    expect(texto('BOOTCAMP')).toMatch(/Salón/)             // columna ausente
  })
})

conExcel('la fecha de corte recalcula los estados', () => {
  it('mueve sesiones entre futuras y pendientes sin tocar las tabuladas', () => {
    const base = baseCompleta()
    const temprano = derivar(base, '2026-07-01')
    const tardio = derivar(base, '2026-12-31')

    // El hecho "tiene datos en el CONSOLIDADO" no depende del corte.
    expect(temprano.totales.n_tabuladas).toBe(44)
    expect(tardio.totales.n_tabuladas).toBe(44)

    expect(temprano.totales.n_pendientes).toBe(0)
    expect(temprano.totales.n_futuras).toBe(86)
    expect(tardio.totales.n_pendientes).toBe(86)
    expect(tardio.totales.n_futuras).toBe(0)

    expect(temprano.totales.pct_cumplimiento).toBe(1)
    expect((tardio.totales.pct_cumplimiento! * 100).toFixed(1)).toBe('33.8')
  })

  it('cambia el estado de los programas según el corte', () => {
    const base = baseCompleta()
    // El programa más temprano arranca el 09/07, así que antes de esa fecha
    // todos están «Por iniciar».
    const antes = derivar(base, '2026-07-01')
    expect(antes.totales.n_en_ejecucion).toBe(0)
    expect(antes.programas.every((p) => p.estado_programa === 'Por iniciar')).toBe(true)

    // Al 15/07 ya arrancaron Project (09/07), Bootcamp (11/07) y Normatividad (14/07).
    expect(derivar(base, '2026-07-15').totales.n_en_ejecucion).toBe(3)
    expect(derivar(base, '2026-08-11').totales.n_en_ejecucion).toBe(6)

    const despues = derivar(base, '2027-01-01')
    expect(despues.totales.n_en_ejecucion).toBe(0)
    expect(despues.programas.every((p) => p.estado_programa === 'Finalizado')).toBe(true)
  })

  it('nunca cuenta una sesión futura como incumplimiento (§5)', () => {
    for (const corte of ['2026-07-01', '2026-08-11', '2026-09-15', '2026-12-31']) {
      const d = derivar(baseCompleta(), corte)
      for (const s of d.sesiones) {
        if (s.fecha > corte) expect(s.estado_seguimiento).not.toBe('Pendiente de tabular')
      }
      expect(d.totales.n_tabuladas + d.totales.n_pendientes).toBe(d.totales.n_realizadas)
    }
  })
})

conExcel('validación de archivos inválidos', () => {
  it('reporta la hoja CONSOLIDADO ausente sin romperse', () => {
    const { dir } = carpetasDePrograma().find((c) => /heridas/i.test(c.nombre))!
    const archivos = leerCarpeta(dir)
    // sólo el cronograma: el listado nunca llega
    const soloCronograma = archivos.filter((a) => /^cronograma/i.test(a.nombre))
    const r = importarArchivos(soloCronograma, 'Heridas sin listado')
    expect(r.ok).toBe(false)
    expect(r.curso).toBeNull()
    const errores = r.incidencias.filter((i) => i.severidad === 'error')
    expect(errores.length).toBeGreaterThan(0)
    expect(errores.some((e) => /listado de participantes/i.test(e.mensaje))).toBe(true)
    for (const e of errores) expect(e.sugerencia ?? '').not.toBe('')
  })

  it('reporta un archivo que no es Excel', () => {
    const r = importarArchivos([
      { nombre: 'notas.txt', datos: new TextEncoder().encode('hola') },
    ])
    expect(r.ok).toBe(false)
    expect(r.incidencias.some((i) => i.severidad === 'error' && /no es un Excel/.test(i.mensaje))).toBe(true)
  })

  it('reporta un .xlsx corrupto sin lanzar excepción', () => {
    const r = importarArchivos([
      { nombre: 'roto.xlsx', datos: new TextEncoder().encode('esto no es un zip') },
    ])
    expect(r.ok).toBe(false)
    expect(r.curso).toBeNull()
    const errores = r.incidencias.filter((i) => i.severidad === 'error')
    expect(errores.length).toBeGreaterThan(0)
    expect(errores.some((e) => /no reconozco|dañado|no se pudo abrir/i.test(e.mensaje))).toBe(true)
    expect(errores[0].donde).toBe('roto.xlsx')
  })

  it('no acepta una lista vacía de archivos', () => {
    const r = importarArchivos([])
    expect(r.ok).toBe(false)
    expect(r.incidencias[0].severidad).toBe('error')
  })

  it('importa un curso completo y devuelve la vista previa', () => {
    const { nombre, dir } = carpetasDePrograma().find((c) => /Bienestar/i.test(c.nombre))!
    const r = importarArchivos(leerCarpeta(dir), nombre)
    expect(r.ok).toBe(true)
    expect(r.resumen).not.toBeNull()
    expect(r.resumen!.n_sesiones).toBe(4)
    expect(r.resumen!.n_participantes).toBe(9)
    expect(r.resumen!.rango).toBe('25/jul → 15/ago')
  })
})
