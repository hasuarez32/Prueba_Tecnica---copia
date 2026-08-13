/**
 * Página 2 — Seguimiento semanal (mockup `2_semanal.html`).
 *
 * Cubre §5 y §6 del enunciado:
 *
 *  - Distingue **programa en ejecución** (su cronograma abarca la semana) de
 *    **programa con clase esa semana** (tiene al menos una sesión). Un programa
 *    puede estar activo y aun así descansar la semana elegida, y esa diferencia
 *    tiene que verse.
 *  - Permite contar, por día, cuántas sesiones hay que atender y cuántos
 *    programas tienen actividad.
 *
 * La matriz tiene dos modos: una semana concreta muestra días; «todas las
 * semanas» cambia las columnas a semanas, única forma de que el mapa de calor
 * siga siendo legible en un rango de meses.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { Card, PageHead, Campo, PillEstado, EstadoVacio, Kpi } from '../components/ui'
import { SelectorBuscable, type OpcionSelector } from '../components/SelectorBuscable'
import { lunesDe, sumarDias, diaSemanaISO } from '../lib/etl/derive'
import { DIAS_CORTO, DIAS_NOMBRE } from '../lib/etl/normalize'
import { fechaCorta, rangoSemana, horario, numero, atraso } from '../lib/format'
import { exportarCSV } from '../lib/exporters'

const TODAS = 'todas'
const TODOS = 'todos'

type Metrica = 'sesiones' | 'horas'

export function Semanal() {
  const { derivada, fechaCorte } = useApp()

  const semanas = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const s of derivada.sesiones) {
      const l = lunesDe(s.fecha)
      cuenta.set(l, (cuenta.get(l) ?? 0) + 1)
    }
    return [...cuenta.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [derivada.sesiones])

  // Por defecto, la semana del corte si tiene clases; si no, la siguiente.
  const [semana, setSemana] = useState<string>(() => {
    const objetivo = lunesDe(fechaCorte)
    const claves = semanas.map(([l]) => l)
    if (claves.includes(objetivo)) return objetivo
    return claves.find((s) => s >= objetivo) ?? claves[claves.length - 1] ?? TODAS
  })
  const [programa, setPrograma] = useState(TODOS)
  const [metrica, setMetrica] = useState<Metrica>('sesiones')

  const todas = semana === TODAS
  const claves = semanas.map(([l]) => l)
  const semanaActiva = todas || claves.includes(semana) ? semana : (claves[0] ?? TODAS)

  const opcionesSemana = useMemo<OpcionSelector[]>(() => [
    { valor: TODAS, etiqueta: 'Todas las semanas', sub: `${derivada.sesiones.length} clases` },
    ...semanas.map(([lunes, n]) => ({
      valor: lunes,
      etiqueta: rangoSemana(lunes, sumarDias(lunes, 6)),
      sub: `${n} clase${n === 1 ? '' : 's'}`,
      alias: `${lunes} ${sumarDias(lunes, 6)}`,
    })),
  ], [semanas, derivada.sesiones.length])

  const opcionesPrograma = useMemo<OpcionSelector[]>(() => [
    { valor: TODOS, etiqueta: 'Todos los programas', sub: `${derivada.programas.length}` },
    ...derivada.programas.map((p) => ({
      valor: p.programa_id,
      etiqueta: p.programa,
      sub: `${p.n_sesiones} ses`,
      alias: `${p.programa_id} ${p.nombre_oficial} ${p.coordinador}`,
    })),
  ], [derivada.programas])

  const dias = useMemo(
    () => (todas ? [] : Array.from({ length: 7 }, (_, i) => sumarDias(semanaActiva, i))),
    [todas, semanaActiva],
  )

  const enRango = useMemo(() => derivada.sesiones.filter((s) => {
    if (programa !== TODOS && s.programa_id !== programa) return false
    if (todas) return true
    return s.fecha >= dias[0] && s.fecha <= dias[6]
  }), [derivada.sesiones, programa, todas, dias])

  /**
   * §5 — Los dos conceptos que el enunciado pide diferenciar.
   *
   * «En ejecución» se evalúa contra el período analizado: si se mira una semana
   * concreta, el cronograma del programa tiene que solaparla. Con «todas las
   * semanas» el período es todo el rango, así que se usa el estado del programa
   * frente a la fecha de corte, que es lo que muestra el resumen global.
   */
  const programas = useMemo(() => {
    const alcance = derivada.programas.filter(
      (p) => programa === TODOS || p.programa_id === programa,
    )
    const enEjecucion = todas
      ? alcance.filter((p) => p.estado_programa === 'En ejecución')
      : alcance.filter((p) =>
        p.fecha_inicio && p.fecha_fin &&
        p.fecha_inicio <= dias[6] && p.fecha_fin >= dias[0])

    const conClase = new Set(enRango.map((s) => s.programa_id))
    return {
      enEjecucion,
      conClase: alcance.filter((p) => conClase.has(p.programa_id)),
      // Activos pero sin clase esta semana: el caso que el enunciado subraya.
      enPausa: enEjecucion.filter((p) => !conClase.has(p.programa_id)),
    }
  }, [derivada.programas, programa, todas, dias, enRango])

  /** Columnas del mapa de calor: días de la semana, o semanas si están todas. */
  const columnas = useMemo(() => {
    if (todas) {
      const conClases = new Set(enRango.map((s) => lunesDe(s.fecha)))
      return [...conClases].sort().map((l) => ({
        clave: l,
        titulo: rangoSemana(l, sumarDias(l, 6)),
        sub: '',
      }))
    }
    return dias
      .filter((d) => enRango.some((s) => s.fecha === d))
      .map((d) => ({ clave: d, titulo: DIAS_CORTO[diaSemanaISO(d)], sub: fechaCorta(d) }))
  }, [todas, dias, enRango])

  const claveDe = (fecha: string) => (todas ? lunesDe(fecha) : fecha)

  /** Matriz programa × columna: sesiones y horas acumuladas en cada cruce. */
  const matriz = useMemo(() => {
    const porPrograma = new Map<string, {
      nombre: string
      celdas: Map<string, { horas: number; n: number }>
    }>()
    for (const s of enRango) {
      const fila = porPrograma.get(s.programa_id) ?? { nombre: s.programa, celdas: new Map() }
      const k = claveDe(s.fecha)
      const c = fila.celdas.get(k) ?? { horas: 0, n: 0 }
      c.horas += s.intensidad_horaria ?? 0
      c.n += 1
      fila.celdas.set(k, c)
      porPrograma.set(s.programa_id, fila)
    }
    const filas = [...porPrograma.entries()].map(([id, v]) => ({ id, ...v }))
    filas.sort((a, b) => a.nombre.localeCompare(b.nombre))
    const max = Math.max(1, ...filas.flatMap((f) =>
      [...f.celdas.values()].map((c) => (metrica === 'horas' ? c.horas : c.n))))
    return { filas, max }
  }, [enRango, todas, metrica])

  /** §6 — Por día: cuántas sesiones hay que atender y cuántos programas mueven. */
  const totales = useMemo(() => {
    const m = new Map<string, { sesiones: number; horas: number; programas: Set<string> }>()
    for (const s of enRango) {
      const k = claveDe(s.fecha)
      const t = m.get(k) ?? { sesiones: 0, horas: 0, programas: new Set<string>() }
      t.sesiones += 1
      t.horas += s.intensidad_horaria ?? 0
      t.programas.add(s.programa_id)
      m.set(k, t)
    }
    return m
  }, [enRango, todas])

  const listado = useMemo(
    () => [...enRango].sort((a, b) =>
      b.fecha.localeCompare(a.fecha) || a.hora_inicio.localeCompare(b.hora_inicio)),
    [enRango],
  )

  const horasTotales = enRango.reduce((a, s) => a + (s.intensidad_horaria ?? 0), 0)

  if (derivada.programas.length === 0) {
    return (
      <div className="wrap pb-16">
        <PageHead eyebrow="Planeación de la semana" titulo="Seguimiento" acento="semanal"
          acentoColor="var(--pink)" />
        <EstadoVacio
          titulo="No hay clases que planear"
          mensaje="Carga al menos un curso para ver la distribución de clases por día y la lista de la semana."
          accion={<Link className="btn btn-navy no-underline" to="/cursos">Cargar un curso</Link>}
        />
      </div>
    )
  }

  const etiquetaAmbito = todas
    ? 'todo el periodo'
    : rangoSemana(semanaActiva, sumarDias(semanaActiva, 6))

  return (
    <div className="wrap pb-16">
      <PageHead
        eyebrow="Planeación de la semana"
        titulo="Seguimiento"
        acento="semanal"
        acentoColor="var(--pink)"
      >
        <Campo label="Semana">
          <SelectorBuscable
            etiqueta="Elegir semana"
            valor={semanaActiva}
            opciones={opcionesSemana}
            onChange={setSemana}
            placeholder="Buscar semana (ej. ago)…"
            ancho={200}
          />
        </Campo>
        <Campo label="Programa">
          <SelectorBuscable
            etiqueta="Filtrar por programa"
            valor={programa}
            opciones={opcionesPrograma}
            onChange={setPrograma}
            placeholder="Buscar programa…"
            ancho={215}
          />
        </Campo>
      </PageHead>

      {/* §5 — los dos conceptos, uno al lado del otro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi
          etiqueta="En ejecución"
          valor={numero(programas.enEjecucion.length)}
          sub={todas ? 'al corte activo' : 'activos esta semana'}
        />
        <Kpi
          etiqueta="Con clase"
          valor={numero(programas.conClase.length)}
          sub={`de ${programas.enEjecucion.length} en ejecución`}
          tono="cyan"
        />
        <Kpi etiqueta="Sesiones" valor={numero(enRango.length)} sub="por atender" />
        <Kpi etiqueta="Horas" valor={numero(horasTotales)} sub="de clase" />
      </div>

      {programas.enPausa.length > 0 && (
        <p className="text-[13px] text-body mb-5 rounded-soft px-4 py-2.5 border border-line"
          style={{ background: 'var(--card)' }}>
          <b className="text-heading font-semibold">
            {programas.enPausa.length} programa{programas.enPausa.length === 1 ? '' : 's'}
          </b>{' '}
          en ejecución sin clase en {etiquetaAmbito}:{' '}
          <span className="text-muted">
            {programas.enPausa.map((p) => p.programa).join(' · ')}
          </span>
        </p>
      )}

      <Card
        titulo={todas ? 'Carga por semana' : 'Carga por día'}
        hint={
          metrica === 'sesiones'
            ? `Sesiones que hay que atender cada ${todas ? 'semana' : 'día'}.`
            : `Horas de clase programadas cada ${todas ? 'semana' : 'día'}.`
        }
        className="mb-5"
        acciones={
          <div
            className="flex gap-1 p-[3px] rounded-pill border border-line shrink-0"
            style={{ background: 'var(--card-2)' }}
            role="group"
            aria-label="Métrica de la matriz"
          >
            {([['sesiones', 'Sesiones'], ['horas', 'Horas']] as const).map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMetrica(v)}
                aria-pressed={metrica === v}
                className="px-3 py-1 rounded-pill text-[12.5px] font-medium border-0 cursor-pointer"
                style={metrica === v
                  ? { background: 'var(--accent-solid)', color: 'var(--accent-on)' }
                  : { background: 'transparent', color: 'var(--heading)' }}
              >
                {t}
              </button>
            ))}
          </div>
        }
      >
        {columnas.length === 0 ? (
          <p className="card-hint">
            {programa === TODOS
              ? 'Esta semana no tiene clases programadas.'
              : 'Ese programa no tiene clases en el rango elegido.'}
          </p>
        ) : (
          <div className="scroll-x">
            <table>
              <caption className="sr-only">
                {metrica === 'sesiones' ? 'Sesiones' : 'Horas de clase'} por programa y
                {todas ? ' semana' : ' día'}, {etiquetaAmbito}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="th text-left sticky left-0" style={{ background: 'var(--card)' }}>
                    Programa
                  </th>
                  {columnas.map((c) => (
                    <th key={c.clave} scope="col" className="th text-center">
                      {todas ? (
                        <span className="whitespace-nowrap normal-case tracking-normal font-sans text-[11px]">
                          {c.titulo}
                        </span>
                      ) : (
                        <>
                          <abbr
                            title={`${DIAS_NOMBRE[diaSemanaISO(c.clave)]} ${fechaCorta(c.clave)}`}
                            className="no-underline"
                          >
                            {c.titulo}
                          </abbr>
                          <span className="block font-sans text-[10px] opacity-70 normal-case tracking-normal">
                            {c.sub}
                          </span>
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matriz.filas.map((f) => (
                  <tr key={f.id}>
                    <td
                      className="td text-[13.5px] font-medium whitespace-nowrap border-b-0 pl-0 sticky left-0"
                      style={{ background: 'var(--card)' }}
                    >
                      {f.nombre}
                    </td>
                    {columnas.map((c) => {
                      const celda = f.celdas.get(c.clave)
                      const valor = celda ? (metrica === 'horas' ? celda.horas : celda.n) : 0
                      const intensidad = celda ? Math.max(0.16, valor / matriz.max) : 0
                      return (
                        <td key={c.clave} className="p-0 text-center border-b-0">
                          <div
                            className="m-[3px] h-[34px] min-w-[38px] rounded-lg flex items-center justify-center text-sm font-semibold"
                            style={{
                              background: celda
                                ? `color-mix(in srgb, var(--cyan) ${intensidad * 100}%, transparent)`
                                : 'transparent',
                              color: celda && intensidad > 0.55 ? 'var(--pill-tab-fg)' : 'var(--heading)',
                            }}
                            title={celda
                              ? `${f.nombre} · ${celda.n} sesión(es), ${celda.horas} h`
                              : undefined}
                          >
                            {celda ? valor : ''}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              {/* §6 — el conteo que pide el enunciado, por día */}
              <tfoot>
                <tr>
                  <th
                    scope="row"
                    className="font-display font-bold text-heading text-left pt-2 border-t border-line pl-0 sticky left-0"
                    style={{ background: 'var(--card)' }}
                  >
                    Sesiones
                  </th>
                  {columnas.map((c) => (
                    <td
                      key={c.clave}
                      className="font-display font-bold text-heading text-center pt-2 border-t border-line"
                    >
                      {totales.get(c.clave)?.sesiones ?? 0}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="text-[12.5px] text-muted text-left pb-1 pl-0 sticky left-0 font-medium"
                    style={{ background: 'var(--card)' }}
                  >
                    Programas
                  </th>
                  {columnas.map((c) => (
                    <td key={c.clave} className="text-[12.5px] text-muted text-center pb-1">
                      {totales.get(c.clave)?.programas.size ?? 0}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="text-[12.5px] text-muted text-left pl-0 sticky left-0 font-medium"
                    style={{ background: 'var(--card)' }}
                  >
                    Horas
                  </th>
                  {columnas.map((c) => (
                    <td key={c.clave} className="text-[12.5px] text-muted text-center">
                      {totales.get(c.clave)?.horas ?? 0}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card
        titulo={todas ? 'Todas las clases' : 'Clases de la semana'}
        hint="De la más reciente a la más antigua"
        acciones={
          <button
            className="btn btn-outline"
            onClick={() => exportarCSV(
              listado.map((s) => ({
                programa: s.programa, sesion: s.num_sesion, fecha: s.fecha, dia: s.dia_semana,
                horario: horario(s.hora_inicio, s.hora_fin), modalidad: s.modalidad,
                docente: s.docente, estado: s.estado_seguimiento,
                dias_atraso: s.estado_seguimiento === 'Pendiente de tabular' ? s.dias_atraso : '',
              })),
              ['programa', 'sesion', 'fecha', 'dia', 'horario', 'modalidad', 'docente',
                'estado', 'dias_atraso'],
              `clases_${todas ? 'todas' : semanaActiva}.csv`,
            )}
            disabled={listado.length === 0}
          >
            Exportar
          </button>
        }
      >
        {listado.length === 0 ? (
          <p className="card-hint">No hay clases con los filtros elegidos.</p>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="th">Programa</th>
                  <th scope="col" className="th">Fecha</th>
                  <th scope="col" className="th">Día</th>
                  <th scope="col" className="th">Horario</th>
                  <th scope="col" className="th">Modalidad</th>
                  <th scope="col" className="th">Docente</th>
                  <th scope="col" className="th">Estado</th>
                  <th scope="col" className="th">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {listado.map((s) => (
                  <tr key={s.id_sesion}>
                    <td className="td font-medium">{s.programa}</td>
                    <td className="td whitespace-nowrap">{fechaCorta(s.fecha)}</td>
                    <td className="td">{s.dia_semana}</td>
                    <td className="td whitespace-nowrap font-mono text-[12.5px]">
                      {horario(s.hora_inicio, s.hora_fin)}
                    </td>
                    <td className="td">{s.modalidad || '—'}</td>
                    <td className="td">{s.docente || '—'}</td>
                    <td className="td"><PillEstado estado={s.estado_seguimiento} /></td>
                    <td className="td">
                      {s.estado_seguimiento === 'Pendiente de tabular' ? (
                        <span className="font-display font-bold text-pink">{atraso(s.dias_atraso)}</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
