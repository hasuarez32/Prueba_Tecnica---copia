/**
 * Página 4 — Detalle académico (mockup `4_academico.html`).
 * Riesgo de certificación: horas de inasistencia acumuladas frente al tope de
 * cada programa. En rosa, quienes ya lo superaron.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { Card, Kpi, PageHead, Campo, EstadoVacio, Pill } from '../components/ui'
import { iniciales, nombrePropio, numero, pct } from '../lib/format'
import { exportarCSV } from '../lib/exporters'

type Orden = 'riesgo' | 'nombre' | 'programa'

export function Academico() {
  const { derivada } = useApp()
  const [programa, setPrograma] = useState('todos')
  const [orden, setOrden] = useState<Orden>('riesgo')
  const [soloRiesgo, setSoloRiesgo] = useState(false)

  const filtrados = useMemo(() => {
    let lista = derivada.participantes.filter(
      (p) => programa === 'todos' || p.programa_id === programa,
    )
    if (soloRiesgo) lista = lista.filter((p) => p.en_riesgo)
    const copia = [...lista]
    if (orden === 'riesgo') {
      copia.sort((a, b) =>
        Number(b.en_riesgo) - Number(a.en_riesgo) ||
        b.total_inasistencia - a.total_inasistencia ||
        a.nombre.localeCompare(b.nombre))
    } else if (orden === 'nombre') {
      copia.sort((a, b) => a.nombre.localeCompare(b.nombre))
    } else {
      copia.sort((a, b) => a.programa.localeCompare(b.programa) || a.nombre.localeCompare(b.nombre))
    }
    return copia
  }, [derivada.participantes, programa, orden, soloRiesgo])

  /** Asistencia sobre los registros ya tabulados del alcance filtrado. */
  const asistencia = useMemo(() => {
    const regs = derivada.asistencia.filter(
      (a) => programa === 'todos' || a.programa_id === programa,
    )
    if (regs.length === 0) return null
    return regs.filter((a) => a.asistio).length / regs.length
  }, [derivada.asistencia, programa])

  const enRiesgo = filtrados.filter((p) => p.en_riesgo).length
  const maxHoras = Math.max(1, ...filtrados.map((p) => p.total_inasistencia))

  if (derivada.programas.length === 0) {
    return (
      <div className="wrap pb-16">
        <PageHead eyebrow="Riesgo de certificación" titulo="Detalle" acento="académico" />
        <EstadoVacio
          titulo="Sin participantes que evaluar"
          mensaje="Carga un curso con su hoja CONSOLIDADO para ver la inasistencia acumulada de cada participante frente al tope de fallas permitido."
          accion={<Link className="btn btn-navy no-underline" to="/cursos">Cargar un curso</Link>}
        />
      </div>
    )
  }

  return (
    <div className="wrap pb-16">
      <PageHead eyebrow="Riesgo de certificación" titulo="Detalle" acento="académico">
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
        <Campo label="Ordenar por">
          <select
            className="control pr-8"
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            aria-label="Ordenar la tabla"
          >
            <option value="riesgo">Riesgo</option>
            <option value="nombre">Nombre</option>
            <option value="programa">Programa</option>
          </select>
        </Campo>
      </PageHead>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <Kpi etiqueta="Participantes" valor={numero(filtrados.length)} />
        <Kpi etiqueta="En riesgo" valor={numero(enRiesgo)} tono="pink" />
        <Kpi etiqueta="Asistencia" valor={pct(asistencia)} tono="cyan" />
      </div>

      <Card
        titulo="Inasistencia por participante"
        hint="Horas acumuladas frente al tope permitido de su programa · en rosa, quienes lo superaron"
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[13px] text-body cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloRiesgo}
                onChange={(e) => setSoloRiesgo(e.target.checked)}
                className="w-4 h-4 accent-[var(--pink)] cursor-pointer"
              />
              Sólo en riesgo
            </label>
            <button
              className="btn btn-outline"
              disabled={filtrados.length === 0}
              onClick={() => exportarCSV(
                filtrados.map((p) => ({
                  programa: p.programa, documento: p.documento, nombre: p.nombre,
                  empresa: p.empresa, total_inasistencia: p.total_inasistencia,
                  horas_falla_max: p.horas_falla_max, en_riesgo: p.en_riesgo ? 'Sí' : 'No',
                })),
                ['programa', 'documento', 'nombre', 'empresa', 'total_inasistencia',
                  'horas_falla_max', 'en_riesgo'],
                'participantes.csv',
              )}
            >
              Exportar
            </button>
          </div>
        }
      >
        {filtrados.length === 0 ? (
          <p className="card-hint py-4">
            {soloRiesgo
              ? 'Ningún participante supera el tope de fallas con los filtros elegidos.'
              : 'No hay participantes con los filtros elegidos.'}
          </p>
        ) : (
          <div className="scroll-x">
            <table>
              <caption className="sr-only">
                Inasistencia acumulada por participante y su tope permitido
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="th">Participante</th>
                  <th scope="col" className="th">Programa</th>
                  <th scope="col" className="th">Empresa</th>
                  <th scope="col" className="th w-[200px]">Inasistencia (h)</th>
                  <th scope="col" className="th">Tope</th>
                  <th scope="col" className="th">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={`${p.programa_id}-${p.documento || p.nombre}`}>
                    <td className="td">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="inline-grid place-items-center w-[30px] h-[30px] rounded-full text-[12px] font-semibold shrink-0"
                          style={{ background: 'var(--mint)', color: 'var(--cyan-ink)' }}
                          aria-hidden
                        >
                          {iniciales(p.nombre)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate max-w-[210px]" title={p.nombre}>
                            {nombrePropio(p.nombre)}
                          </span>
                          {p.documento && (
                            <span className="block font-mono text-[11px] text-muted">{p.documento}</span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="td whitespace-nowrap">{p.programa}</td>
                    <td className="td">{p.empresa || 'N/A'}</td>
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-3 rounded-md"
                          style={{
                            width: `${Math.max(4, (p.total_inasistencia / maxHoras) * 150)}px`,
                            background: p.en_riesgo ? 'var(--pink)' : 'var(--gray)',
                          }}
                          aria-hidden
                        />
                        <span
                          className={`font-display font-bold text-sm w-6 ${p.en_riesgo ? 'text-pink' : 'text-heading'}`}
                        >
                          {p.total_inasistencia}
                        </span>
                      </div>
                    </td>
                    <td className="td">{p.horas_falla_max ?? '—'}</td>
                    <td className="td">
                      {p.en_riesgo ? <Pill tono="pend">En riesgo</Pill> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="card-hint mt-3">
          Las horas se cuentan una sola vez por día tabulado, aunque ese día tenga varias
          sesiones: el CONSOLIDADO trae una columna por jornada, no por sesión.
        </p>
      </Card>
    </div>
  )
}
