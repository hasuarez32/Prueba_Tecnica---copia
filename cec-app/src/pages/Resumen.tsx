/**
 * Página 1 — Resumen global (mockup `1_resumen.html`).
 * Filtros, cuatro KPI, barras de estado por programa y dona de cumplimiento.
 */

import { useMemo, useState } from 'react'
import { useApp } from '../store/AppStore'
import {
  Card, Donut, Kpi, Leyenda, PageHead, Campo, EstadoVacio, PillPrograma, PillEstado,
} from '../components/ui'
import { GraficoProgramas, type FilaPrograma } from '../components/GraficoProgramas'
import { pct, numero, rangoSemana, fechaDiaMes } from '../lib/format'
import type { EstadoPrograma } from '../lib/etl/types'
import { lunesDe, sumarDias } from '../lib/etl/derive'
import { exportarExcel, exportarCSV } from '../lib/exporters'
import { Link } from 'react-router-dom'

export function Resumen() {
  const { derivada, fechaCorte } = useApp()
  const [programa, setPrograma] = useState('todos')
  const [semana, setSemana] = useState('todas')
  const t = derivada.totales

  const semanas = useMemo(() => {
    const set = new Set(derivada.sesiones.map((s) => lunesDe(s.fecha)))
    return [...set].sort()
  }, [derivada.sesiones])

  const sesionesFiltradas = useMemo(() => derivada.sesiones.filter((s) => {
    if (programa !== 'todos' && s.programa_id !== programa) return false
    if (semana !== 'todas' && lunesDe(s.fecha) !== semana) return false
    return true
  }), [derivada.sesiones, programa, semana])

  /** Los KPI y las barras respetan los filtros; sin filtro son los totales. */
  const vista = useMemo(() => {
    const tab = sesionesFiltradas.filter((s) => s.estado_seguimiento === 'Tabulada').length
    const pen = sesionesFiltradas.filter((s) => s.estado_seguimiento === 'Pendiente de tabular').length
    const fut = sesionesFiltradas.filter((s) => s.estado_seguimiento === 'Futura no exigible').length
    const realizadas = tab + pen
    const ids = new Set(sesionesFiltradas.map((s) => s.programa_id))
    const progs = derivada.programas.filter((p) => ids.has(p.programa_id))
    const enRiesgo = derivada.participantes
      .filter((p) => programa === 'todos' || p.programa_id === programa)
      .filter((p) => p.en_riesgo).length
    return {
      tab, pen, fut, realizadas,
      cumplimiento: realizadas > 0 ? tab / realizadas : null,
      enEjecucion: progs.filter((p) => p.estado_programa === 'En ejecución').length,
      nProgramas: progs.length,
      enRiesgo,
    }
  }, [sesionesFiltradas, derivada.programas, derivada.participantes, programa])

  /**
   * Los programas del alcance actual, con su estado frente a la fecha de corte.
   * Se ordenan por estado —primero los activos, que son los que hay que
   * atender— y dentro de cada grupo por fecha de inicio.
   */
  const programas = useMemo(() => {
    const ids = new Set(sesionesFiltradas.map((s) => s.programa_id))
    const orden: Record<EstadoPrograma, number> = {
      'En ejecución': 0, 'Por iniciar': 1, 'Finalizado': 2,
    }
    return derivada.programas
      .filter((p) => ids.has(p.programa_id))
      .slice()
      .sort((a, b) =>
        orden[a.estado_programa] - orden[b.estado_programa] ||
        (a.fecha_inicio ?? '').localeCompare(b.fecha_inicio ?? ''))
  }, [derivada.programas, sesionesFiltradas])

  const porEstado = useMemo(() => ({
    'En ejecución': programas.filter((p) => p.estado_programa === 'En ejecución').length,
    'Por iniciar': programas.filter((p) => p.estado_programa === 'Por iniciar').length,
    'Finalizado': programas.filter((p) => p.estado_programa === 'Finalizado').length,
  }), [programas])

  /** Una barra por programa, ordenadas de más a menos sesiones. */
  const barras = useMemo<FilaPrograma[]>(() => {
    const porPrograma = new Map<string, { nombre: string; tab: number; pen: number; fut: number }>()
    for (const s of sesionesFiltradas) {
      const e = porPrograma.get(s.programa_id) ??
        { nombre: s.programa, tab: 0, pen: 0, fut: 0 }
      if (s.estado_seguimiento === 'Tabulada') e.tab++
      else if (s.estado_seguimiento === 'Pendiente de tabular') e.pen++
      else e.fut++
      porPrograma.set(s.programa_id, e)
    }
    const filas = [...porPrograma.entries()].map(([id, v]) => ({
      id, ...v, total: v.tab + v.pen + v.fut,
    }))
    filas.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))
    return filas
  }, [sesionesFiltradas])

  if (derivada.programas.length === 0) {
    return (
      <div className="wrap pb-16">
        <PageHead eyebrow="Panel operativo · CEC" titulo="Resumen" acento="global" />
        <EstadoVacio
          titulo="Todavía no hay cursos cargados"
          mensaje="Sube el cronograma y el listado de participantes de un curso para ver aquí su estado de tabulación, la carga semanal y el riesgo académico."
          accion={<Link className="btn btn-navy no-underline" to="/cursos">Cargar un curso</Link>}
        />
      </div>
    )
  }

  return (
    <div className="wrap pb-16">
      <PageHead eyebrow="Panel operativo · CEC" titulo="Resumen" acento="global">
        <Campo label="Programa">
          <select
            className="control pr-8"
            value={programa}
            onChange={(e) => setPrograma(e.target.value)}
            aria-label="Filtrar por programa"
          >
            <option value="todos">Todos</option>
            {derivada.programas.map((p) => (
              <option key={p.programa_id} value={p.programa_id}>{p.programa}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Semana">
          <select
            className="control pr-8"
            value={semana}
            onChange={(e) => setSemana(e.target.value)}
            aria-label="Filtrar por semana"
          >
            <option value="todas">Todas</option>
            {semanas.map((l) => (
              <option key={l} value={l}>{rangoSemana(l, sumarDias(l, 6))}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Exportar">
          <button className="btn btn-outline font-mono" onClick={() => exportarExcel(derivada)}>
            Excel
          </button>
        </Campo>
      </PageHead>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi
          etiqueta="En ejecución"
          valor={numero(porEstado['En ejecución'])}
          sub={[
            porEstado['Por iniciar'] ? `${porEstado['Por iniciar']} por iniciar` : '',
            porEstado['Finalizado'] ? `${porEstado['Finalizado']} finalizado${porEstado['Finalizado'] === 1 ? '' : 's'}` : '',
          ].filter(Boolean).join(' · ') || `de ${vista.nProgramas} programas`}
        />
        <Kpi
          etiqueta="Cumplimiento"
          valor={pct(vista.cumplimiento)}
          sub="tabulación al día"
          tono="cyan"
        />
        <Kpi
          etiqueta="Pendientes"
          valor={numero(vista.pen)}
          sub="sesiones por tabular"
          tono="pink"
        />
        <Kpi
          etiqueta="En riesgo"
          valor={numero(vista.enRiesgo)}
          sub="participantes"
        />
      </div>

      <div className="grid lg:grid-cols-[1.55fr_.95fr] gap-5">
        <Card titulo="Estado por programa" id="estado">
          <Leyenda />
          <GraficoProgramas filas={barras} />
        </Card>

        <Card titulo="Cumplimiento de tabulación" id="cumpl">
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <Donut valor={vista.cumplimiento} />
          </div>
          <dl className="mt-2">
            {[
              ['Sesiones realizadas', numero(vista.realizadas), 'text-heading'],
              ['Tabuladas', numero(vista.tab), 'text-[var(--cyan-ink)]'],
              ['Pendientes de tabular', numero(vista.pen), 'text-pink'],
              ['Futuras (no exigibles)', numero(vista.fut), 'text-heading'],
            ].map(([k, v, c], i) => (
              <div
                key={k}
                className={`flex justify-between py-[11px] text-sm ${i > 0 ? 'border-t border-dashed border-line-2' : ''}`}
              >
                <dt className="text-body">{k}</dt>
                <dd className={`font-display font-bold ${c}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="card-hint mt-2">
            Al corte del {fechaDiaMes(fechaCorte)}. Las sesiones futuras no entran en el
            cálculo: no se puede exigir tabular una clase que aún no ocurre.
          </p>
        </Card>
      </div>

      <Card
        titulo="Programas"
        hint="En qué punto está cada uno según su cronograma y la fecha de corte"
        className="mt-5"
        acciones={
          <button
            className="btn btn-outline"
            disabled={programas.length === 0}
            onClick={() => exportarCSV(
              programas.map((p) => ({
                programa: p.programa, estado: p.estado_programa,
                fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin,
                n_sesiones: p.n_sesiones, n_sesiones_tabuladas: p.n_sesiones_tabuladas,
                n_sesiones_pendientes: p.n_sesiones_pendientes,
                pct_cumplimiento: p.pct_cumplimiento_tabulacion,
                coordinador: p.coordinador,
              })),
              ['programa', 'estado', 'fecha_inicio', 'fecha_fin', 'n_sesiones',
                'n_sesiones_tabuladas', 'n_sesiones_pendientes', 'pct_cumplimiento',
                'coordinador'],
              `programas_${fechaCorte}.csv`,
            )}
          >
            Exportar
          </button>
        }
      >
        {programas.length === 0 ? (
          <p className="card-hint">No hay programas con los filtros elegidos.</p>
        ) : (
          <div className="scroll-x">
            <table>
              <caption className="sr-only">
                Estado de cada programa al corte del {fechaDiaMes(fechaCorte)}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="th">Programa</th>
                  <th scope="col" className="th">Estado</th>
                  <th scope="col" className="th">Periodo</th>
                  <th scope="col" className="th text-center">Sesiones</th>
                  <th scope="col" className="th">Tabulación</th>
                  <th scope="col" className="th text-right">Cumplim.</th>
                  <th scope="col" className="th">Coordinación</th>
                </tr>
              </thead>
              <tbody>
                {programas.map((p) => (
                  <tr key={p.programa_id}>
                    <td className="td">
                      <span className="block font-medium text-heading">{p.programa}</span>
                      <span className="block text-[11.5px] text-muted truncate max-w-[220px]">
                        {p.nombre_oficial || '—'}
                      </span>
                    </td>
                    <td className="td"><PillPrograma estado={p.estado_programa} /></td>
                    <td className="td whitespace-nowrap font-mono text-[12.5px]">
                      {p.fecha_inicio ? fechaDiaMes(p.fecha_inicio) : '—'}
                      <span className="text-muted"> – </span>
                      {p.fecha_fin ? fechaDiaMes(p.fecha_fin) : '—'}
                    </td>
                    <td className="td text-center">{p.n_sesiones}</td>
                    <td className="td whitespace-nowrap">
                      {p.n_sesiones_pendientes > 0
                        ? <PillEstado estado="Pendiente de tabular" />
                        : p.n_sesiones_realizadas > 0
                          ? <PillEstado estado="Tabulada" />
                          : <span className="text-muted text-[12.5px]">sin dictar</span>}
                    </td>
                    <td className="td text-right font-display font-bold">
                      {pct(p.pct_cumplimiento_tabulacion, 0)}
                    </td>
                    <td className="td text-[12.5px]">{p.coordinador || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="card-hint mt-3">
          «En ejecución» significa que la fecha de corte cae entre la primera y la última
          sesión del cronograma. Cambiar el corte cambia el estado: un programa que hoy
          está activo aparecerá como finalizado si mueves la fecha más allá de su cierre.
        </p>
      </Card>

      <p className="sr-only" role="status">
        {`Cumplimiento ${pct(vista.cumplimiento)}, ${vista.pen} sesiones pendientes de tabular,`}
        {` ${vista.enRiesgo} participantes en riesgo. Total de sesiones ${t.n_sesiones}.`}
      </p>
    </div>
  )
}
