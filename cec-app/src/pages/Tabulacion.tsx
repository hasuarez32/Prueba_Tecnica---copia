/**
 * Página 3 — Control de tabulación (mockup `3_tabulacion.html`).
 * KPIs, barra de pendientes por programa y lista de acción ordenada por días
 * de atraso: lo primero que debería resolver el equipo logístico.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { Card, Kpi, PageHead, EstadoVacio } from '../components/ui'
import { fechaCorta, fechaLarga, numero, pct } from '../lib/format'
import { exportarCSV } from '../lib/exporters'

export function Tabulacion() {
  const { derivada, fechaCorte } = useApp()
  const t = derivada.totales

  const pendientes = useMemo(
    () => derivada.sesiones
      .filter((s) => s.estado_seguimiento === 'Pendiente de tabular')
      .sort((a, b) => b.dias_atraso - a.dias_atraso ||
        a.programa.localeCompare(b.programa) ||
        (a.num_sesion ?? 0) - (b.num_sesion ?? 0)),
    [derivada.sesiones],
  )

  const porPrograma = useMemo(() => {
    const filas = derivada.programas
      .map((p) => ({
        id: p.programa_id,
        nombre: p.programa,
        pendientes: p.n_sesiones_pendientes,
        cumplimiento: p.pct_cumplimiento_tabulacion,
      }))
      .sort((a, b) => b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre))
    const max = Math.max(1, ...filas.map((f) => f.pendientes))
    return filas.map((f) => ({ ...f, ancho: f.pendientes / max }))
  }, [derivada.programas])

  const maxAtraso = Math.max(1, ...pendientes.map((s) => s.dias_atraso))

  if (derivada.programas.length === 0) {
    return (
      <div className="wrap pb-16">
        <PageHead eyebrow="Cumplimiento administrativo" titulo="Control de" acento="tabulación"
          acentoColor="var(--pink)" />
        <EstadoVacio
          titulo="Nada que controlar todavía"
          mensaje="Cuando cargues cursos, aquí aparecerán las sesiones ya dictadas cuya asistencia sigue sin cargar, ordenadas por días de atraso."
          accion={<Link className="btn btn-navy no-underline" to="/cursos">Cargar un curso</Link>}
        />
      </div>
    )
  }

  return (
    <div className="wrap pb-16">
      <PageHead
        eyebrow="Cumplimiento administrativo"
        titulo="Control de"
        acento="tabulación"
        acentoColor="var(--pink)"
      >
        <div className="control" title="Fecha de corte activa">
          Corte · {fechaLarga(fechaCorte)}
        </div>
        <button
          className="btn btn-outline"
          disabled={pendientes.length === 0}
          onClick={() => exportarCSV(
            pendientes.map((s) => ({
              programa: s.programa, sesion: s.num_sesion, fecha: s.fecha,
              modulo: s.modulo, docente: s.docente, dias_atraso: s.dias_atraso,
              observaciones: s.observaciones.join('; '),
            })),
            ['programa', 'sesion', 'fecha', 'modulo', 'docente', 'dias_atraso', 'observaciones'],
            `pendientes_${fechaCorte}.csv`,
          )}
        >
          Exportar lista
        </button>
      </PageHead>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <Kpi etiqueta="Cumplimiento" valor={pct(t.pct_cumplimiento)} tono="cyan" />
        <Kpi etiqueta="Realizadas" valor={numero(t.n_realizadas)} />
        <Kpi etiqueta="Tabuladas" valor={numero(t.n_tabuladas)} tono="cyan" />
        <Kpi etiqueta="Pendientes" valor={numero(t.n_pendientes)} tono="pink" />
      </div>

      <div className="grid lg:grid-cols-[.9fr_1.6fr] gap-5">
        <Card titulo="Pendientes por programa" hint="Quién está más atrasado">
          {porPrograma.map((p) => (
            <div key={p.id} className="flex items-center gap-3 mt-3.5">
              <span className="w-[92px] sm:w-[130px] text-[13px] text-heading text-right truncate shrink-0"
                title={p.nombre}>
                {p.nombre}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="h-4 rounded-md"
                  style={{
                    width: `${Math.max(2, p.ancho * 100)}%`,
                    background: p.pendientes > 0 ? 'var(--pink)' : 'var(--gray)',
                  }}
                  role="img"
                  aria-label={`${p.nombre}: ${p.pendientes} pendientes`}
                />
              </div>
              <span className="w-5 font-semibold text-[13px] text-heading text-right shrink-0">
                {p.pendientes}
              </span>
            </div>
          ))}
        </Card>

        <Card
          titulo="Lista de acción — pendientes de tabular"
          hint="Ordenadas por días de atraso · las más urgentes arriba"
        >
          {pendientes.length === 0 ? (
            <p className="text-sm text-body py-6 text-center">
              <span className="block text-2xl mb-2" aria-hidden>✓</span>
              No hay sesiones pendientes al corte del {fechaLarga(fechaCorte)}.
              Toda la asistencia dictada está cargada.
            </p>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="th">Ses.</th>
                    <th scope="col" className="th">Programa</th>
                    <th scope="col" className="th">Fecha</th>
                    <th scope="col" className="th">Módulo / docente</th>
                    <th scope="col" className="th w-[130px]">Días de atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((s) => (
                    <tr key={s.id_sesion}>
                      <td className="td">
                        <span
                          className="inline-grid place-items-center w-[26px] h-[26px] rounded-lg text-[12px] font-semibold"
                          style={{ background: 'var(--accent-solid)', color: 'var(--accent-on)' }}
                        >
                          {s.num_sesion ?? '·'}
                        </span>
                      </td>
                      <td className="td font-medium whitespace-nowrap">{s.programa}</td>
                      <td className="td whitespace-nowrap">{fechaCorta(s.fecha)}</td>
                      <td className="td">
                        <span className="block max-w-[280px] truncate" title={s.modulo || s.docente}>
                          {s.modulo || s.docente || '—'}
                        </span>
                        {s.modulo && s.docente && (
                          <span className="block text-[12px] text-muted truncate max-w-[280px]">
                            {s.docente}
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 rounded-full"
                            style={{
                              width: `${Math.max(4, (s.dias_atraso / maxAtraso) * 64)}px`,
                              background: 'var(--pink)',
                            }}
                            aria-hidden
                          />
                          <span className="font-display font-bold text-heading text-[13px]">
                            {s.dias_atraso}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
