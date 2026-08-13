/**
 * Página 5 — Gestión de cursos (mockup `5_cursos.html`).
 *
 * El valor agregado de la app: cargar los Excel de un curso, normalizarlos y
 * validarlos **sin fallar en silencio** (§6). Si el formato es conocido se
 * muestra la vista previa; si algo falta o difiere, se dice qué, dónde y por
 * qué, separando errores (bloquean) de avisos (se importa igual).
 */

import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import { useApp } from '../store/AppStore'
import { Card, PageHead } from '../components/ui'
import { importarArchivos, type ArchivoEntrada } from '../lib/etl'
import type { Incidencia } from '../lib/etl/types'
import { exportarJSON, exportarExcel, leerJSON } from '../lib/exporters'
import { leerArchivoComoBuffer, leerArchivoComoTexto } from '../lib/archivos'
import { numero, fechaLarga } from '../lib/format'
import {
  CONFIG_POR_DEFECTO, commitJSON, guardarToken, leerToken, olvidarToken,
  verificarAcceso, type ConfigGitHub, type ResultadoCommit,
} from '../lib/github'

export function Cursos() {
  const {
    base, derivada, agregarCurso, eliminarCurso, reemplazarBase, restaurarSemilla, limpiarTodo,
  } = useApp()

  /**
   * Los archivos se **acumulan**: un curso son dos Excel y casi nunca se
   * arrastran juntos. Cada suelta suma a la lista en vez de reemplazarla, y
   * subir un archivo con el mismo nombre lo sustituye.
   */
  const [archivos, setArchivos] = useState<ArchivoEntrada[]>([])
  const [errorLectura, setErrorLectura] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [sobre, setSobre] = useState(false)
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'err'; texto: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)

  // La validación se rehace sola cada vez que cambia la lista de archivos.
  const resultado = useMemo(
    () => (archivos.length > 0 ? importarArchivos(archivos) : null),
    [archivos],
  )

  const agregarArchivos = useCallback(async (lista: File[]) => {
    if (lista.length === 0) return
    setOcupado(true)
    setAviso(null)
    setErrorLectura(null)
    try {
      const nuevos: ArchivoEntrada[] = []
      for (const f of lista) {
        nuevos.push({ nombre: f.name, datos: await leerArchivoComoBuffer(f) })
      }
      setArchivos((previos) => {
        const porNombre = new Map(previos.map((a) => [a.nombre, a]))
        for (const n of nuevos) porNombre.set(n.nombre, n) // mismo nombre: reemplaza
        return [...porNombre.values()]
      })
    } catch (e) {
      // Salvaguarda: ni un fallo inesperado debe dejar la pantalla muda.
      setErrorLectura(`No pude leer los archivos: ${(e as Error).message}`)
    } finally {
      setOcupado(false)
      // Permite volver a elegir el mismo archivo si el usuario lo quitó antes.
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [])

  const quitarArchivo = useCallback((nombre: string) => {
    setArchivos((previos) => previos.filter((a) => a.nombre !== nombre))
  }, [])

  const limpiarSeleccion = useCallback(() => {
    setArchivos([])
    setErrorLectura(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setSobre(false)
    void agregarArchivos(Array.from(e.dataTransfer.files))
  }, [agregarArchivos])

  const confirmar = useCallback(async () => {
    if (!resultado?.curso) return
    await agregarCurso(resultado.curso)
    setAviso({
      tono: 'ok',
      texto: `«${resultado.curso.programa.programa}» quedó guardado en este dispositivo. El panel ya lo incluye.`,
    })
    limpiarSeleccion()
  }, [resultado, agregarCurso, limpiarSeleccion])

  const importarJSON = useCallback(async (f: File) => {
    const { base: nueva, error } = leerJSON(await leerArchivoComoTexto(f))
    if (error || !nueva) {
      setAviso({ tono: 'err', texto: error ?? 'No pude leer el JSON.' })
      return
    }
    await reemplazarBase(nueva)
    setAviso({ tono: 'ok', texto: `Base restaurada: ${nueva.cursos.length} curso(s).` })
  }, [reemplazarBase])

  // «Falta el cronograma / el listado» no es un fallo mientras se están
  // arrastrando archivos: es un paso pendiente, y lo comunica la lista de
  // requisitos. Mostrarlo además en rojo asusta sin motivo.
  const errores = (resultado?.incidencias ?? []).filter(
    (i) => i.severidad === 'error' && !i.codigo,
  )
  const avisos = (resultado?.incidencias ?? []).filter((i) => i.severidad === 'aviso')
  const clasificacion = resultado?.clasificacion
  const completo = !!clasificacion?.cronograma && !!clasificacion?.listado

  return (
    <div className="wrap pb-16">
      <PageHead
        eyebrow="Datos · carga y normalización"
        titulo="Gestión de"
        acento="cursos"
        acentoColor="var(--pink)"
      >
        <button className="btn btn-outline" onClick={() => exportarJSON(base)}>
          Exportar JSON
        </button>
        <button className="btn btn-outline" onClick={() => exportarExcel(derivada)}>
          Exportar Excel
        </button>
      </PageHead>

      {aviso && (
        <div
          role="status"
          className="mb-4 rounded-soft px-4 py-3 text-sm border"
          style={{
            borderColor: aviso.tono === 'ok' ? 'rgba(47,163,107,.4)' : 'rgba(255,61,139,.45)',
            background: aviso.tono === 'ok' ? 'var(--green-soft)' : 'var(--pill-pend-bg)',
            color: aviso.tono === 'ok' ? 'var(--green-ink)' : 'var(--pill-pend-fg)',
          }}
        >
          {aviso.texto}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-5">
        <div className="flex flex-col gap-5">
          <Card titulo="Agregar curso">
            <div
              role="region"
              aria-label="Zona de carga de archivos"
              className={`rounded-soft px-5 py-8 text-center border-2 border-dashed transition-colors ${
                sobre ? 'border-[var(--cyan)]' : 'border-line-2'
              }`}
              style={{
                background: sobre
                  ? 'var(--mint)'
                  : 'repeating-linear-gradient(135deg,var(--line) 0 1px,transparent 1px 14px), var(--card)',
              }}
              onDragOver={(e) => { e.preventDefault(); setSobre(true) }}
              onDragLeave={() => setSobre(false)}
              onDrop={onDrop}
            >
              <div
                className="w-14 h-14 rounded-2xl grid place-items-center mx-auto mb-3 text-2xl"
                style={{ background: 'var(--mint)', color: 'var(--cyan-ink)' }}
                aria-hidden
              >
                ↑
              </div>
              <p className="font-display font-semibold text-[17px] text-heading m-0">
                Arrastra el cronograma y el listado
              </p>
              <p className="text-[13px] text-muted mt-1.5 mb-4">
                .xlsx · se validan y normalizan automáticamente
              </p>
              <input
                ref={inputRef}
                id="archivos"
                type="file"
                accept=".xlsx,.xls,.xlsm"
                multiple
                className="sr-only"
                onChange={(e) => void agregarArchivos(Array.from(e.target.files ?? []))}
              />
              <label htmlFor="archivos" className="btn btn-outline cursor-pointer inline-flex">
                {ocupado ? 'Leyendo…' : archivos.length ? 'Añadir otro archivo' : 'Seleccionar archivos'}
              </label>
            </div>

            {errorLectura && (
              <p
                role="alert"
                className="mt-3.5 rounded-2xl px-4 py-3 text-[13px] border"
                style={{
                  borderColor: 'rgba(255,61,139,.45)',
                  background: 'var(--pill-pend-bg)',
                  color: 'var(--pill-pend-fg)',
                }}
              >
                {errorLectura}
              </p>
            )}

            {archivos.length > 0 && clasificacion && (
              <div aria-live="polite">
                {/* Qué falta por subir. Se puede llegar en dos viajes. */}
                <ul className="list-none p-0 mt-4 mb-1 flex flex-col gap-1.5">
                  <Requisito
                    etiqueta="Cronograma"
                    archivo={clasificacion.cronograma}
                    onQuitar={quitarArchivo}
                  />
                  <Requisito
                    etiqueta="Listado de participantes"
                    archivo={clasificacion.listado}
                    onQuitar={quitarArchivo}
                  />
                  {clasificacion.evidencias.length > 0 && (
                    <li className="flex items-center gap-2.5 text-[13px]">
                      <span style={{ color: 'var(--green)' }} aria-hidden>✓</span>
                      <span className="text-muted">
                        Evidencia fotográfica ·{' '}
                        <b className="text-heading font-semibold">
                          {clasificacion.evidencias.length} archivo
                          {clasificacion.evidencias.length === 1 ? '' : 's'}
                        </b>
                      </span>
                    </li>
                  )}
                </ul>

                {!completo && (
                  <p className="card-hint mt-2">
                    Falta {!clasificacion.cronograma ? 'el cronograma' : 'el listado de participantes'}.
                    Arrástralo o búscalo con «Añadir otro archivo»; no hace falta subirlos a la vez.
                  </p>
                )}

                {completo && resultado?.ok && resultado.resumen && (
                  <BloqueValidacion
                    tono="ok"
                    titulo={resultado.resumen.programa}
                    insignia="válido"
                    meta={`${resultado.resumen.n_sesiones} sesiones · ${resultado.resumen.rango} · ${resultado.resumen.n_participantes} participantes`}
                  />
                )}

                {errores.length > 0 && (
                  <BloqueValidacion
                    tono="err"
                    titulo={clasificacion.listado ?? clasificacion.cronograma ?? 'Archivos'}
                    insignia={`${errores.length} ${errores.length === 1 ? 'problema' : 'problemas'}`}
                    items={errores}
                  />
                )}

                {avisos.length > 0 && (
                  <BloqueValidacion
                    tono="warn"
                    titulo={errores.length ? 'Además, revisa esto' : 'Se importa, con observaciones'}
                    insignia={`${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'}`}
                    items={avisos}
                  />
                )}

                <div className="flex gap-2.5 justify-end mt-4 flex-wrap">
                  <button className="btn btn-outline" onClick={limpiarSeleccion}>
                    Descartar
                  </button>
                  <button
                    className="btn btn-pink"
                    disabled={!resultado?.ok}
                    onClick={() => void confirmar()}
                    title={resultado?.ok
                      ? 'Guardar el curso en este dispositivo'
                      : completo
                        ? 'Corrige los errores para poder agregarlo'
                        : 'Sube los dos archivos del curso'}
                  >
                    Agregar curso
                  </button>
                </div>
              </div>
            )}
          </Card>

          <PanelGitHub onAviso={setAviso} />
        </div>

        <div className="flex flex-col gap-5">
          <Card
            titulo="Cursos cargados"
            acciones={
              <span className="font-mono text-[12px] text-muted">
                · {numero(derivada.programas.length)}
              </span>
            }
          >
            {derivada.programas.length === 0 ? (
              <p className="card-hint">Todavía no hay cursos en esta base.</p>
            ) : (
              <div className="scroll-x">
                <table>
                  <caption className="sr-only">
                    Cursos cargados, con su estado de tabulación y de evidencia fotográfica
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="th">Programa</th>
                      <th scope="col" className="th text-center">Ses.</th>
                      <th scope="col" className="th">Tabulación</th>
                      <th scope="col" className="th">Evidencia</th>
                      <th scope="col" className="th"><span className="sr-only">Quitar</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {derivada.programas.map((p) => (
                      <tr key={p.programa_id}>
                        <td className="td">
                          <span className="flex items-center gap-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                background: p.n_sesiones_pendientes > 0 ? 'var(--pink)' : 'var(--cyan)',
                              }}
                              aria-hidden
                            />
                            <span className="min-w-0">
                              <span className="block font-medium text-heading truncate max-w-[190px]">
                                {p.programa}
                              </span>
                              <span className="block text-[11.5px] text-muted truncate max-w-[190px]">
                                {p.nombre_oficial || p.origen || '—'}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="td text-center font-mono text-[12.5px]">{p.n_sesiones}</td>
                        <td className="td whitespace-nowrap">
                          {p.n_sesiones_pendientes > 0 ? (
                            <span className="pill pill-pend">{p.n_sesiones_pendientes} pend</span>
                          ) : (
                            <span className="pill pill-tab">al día</span>
                          )}
                        </td>
                        <td className="td whitespace-nowrap">
                          {p.n_evidencias > 0 ? (
                            <span className="pill pill-tab">
                              {p.n_evidencias} archivo{p.n_evidencias === 1 ? '' : 's'}
                            </span>
                          ) : (
                            <span className="pill pill-fut">sin cargar</span>
                          )}
                        </td>
                        <td className="td text-right">
                          <button
                            className="btn btn-outline px-2.5 py-1 text-[12px]"
                            onClick={() => {
                              if (confirm(`¿Quitar «${p.programa}» de la base? Podrás volver a subir sus Excel cuando quieras.`)) {
                                void eliminarCurso(p.programa_id)
                              }
                            }}
                            aria-label={`Quitar ${p.programa}`}
                            title="Quitar de la base"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="card-hint mt-3">
              La evidencia fotográfica se cuenta por programa: los nombres de archivo no
              permiten saber a qué sesión corresponde cada foto. Al arrastrar la carpeta
              completa, las imágenes se cuentan solas.
            </p>
          </Card>

          <Card titulo="Base de datos" hint="Todo se guarda en este navegador (IndexedDB)">
            <p className="text-[13px] text-body">
              {derivada.programas.length} cursos · {numero(derivada.totales.n_sesiones)} sesiones ·{' '}
              {numero(derivada.totales.n_participantes)} participantes ·{' '}
              {numero(derivada.programas.reduce((a, p) => a + p.n_evidencias, 0))} evidencias.
            </p>
            <p className="card-hint mt-1">
              Última actualización: {fechaLarga(base.generado_en.slice(0, 10))}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <input
                ref={jsonRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                id="json-import"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importarJSON(f)
                  e.target.value = ''
                }}
              />
              <label htmlFor="json-import" className="btn btn-outline cursor-pointer">
                Importar JSON
              </label>
              <button className="btn btn-outline" onClick={() => void restaurarSemilla()}>
                Restaurar ejemplo
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  if (confirm('¿Borrar todos los cursos guardados en este navegador?')) {
                    void limpiarTodo()
                    setAviso({ tono: 'ok', texto: 'Base vaciada.' })
                  }
                }}
              >
                Vaciar
              </button>
            </div>
          </Card>

          <IncidenciasGuardadas />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── lista de requisitos ─────────────────────────── */

/** Una fila de «lo que hace falta»: el archivo puesto, o el hueco por llenar. */
function Requisito({
  etiqueta, archivo, onQuitar,
}: {
  etiqueta: string
  archivo: string | null
  onQuitar: (nombre: string) => void
}) {
  return (
    <li className="flex items-center gap-2.5 text-[13px] min-w-0">
      <span
        aria-hidden
        style={{ color: archivo ? 'var(--green)' : 'var(--muted)' }}
      >
        {archivo ? '✓' : '○'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-muted">{etiqueta} · </span>
        {archivo ? (
          <b className="text-heading font-semibold break-all">{archivo}</b>
        ) : (
          <span style={{ color: 'var(--muted)' }}>pendiente</span>
        )}
      </span>
      {archivo && (
        <button
          type="button"
          className="btn btn-outline px-2 py-0.5 text-[11px] shrink-0"
          onClick={() => onQuitar(archivo)}
          aria-label={`Quitar ${archivo}`}
          title="Quitar este archivo"
        >
          ×
        </button>
      )}
    </li>
  )
}

/* ───────────────────────── bloques de validación ───────────────────────── */

function BloqueValidacion({
  tono, titulo, insignia, meta, items,
}: {
  tono: 'ok' | 'err' | 'warn'
  titulo: string
  insignia: string
  meta?: string
  items?: Incidencia[]
}) {
  const estilo = {
    ok: { borde: 'rgba(47,163,107,.4)', fondo: 'var(--green-soft)', icono: '✓', color: 'var(--green-ink)' },
    err: { borde: 'rgba(255,61,139,.45)', fondo: 'var(--pill-pend-bg)', icono: '!', color: 'var(--pill-pend-fg)' },
    warn: { borde: 'var(--line-2)', fondo: 'var(--card-2)', icono: '·', color: 'var(--muted)' },
  }[tono]

  return (
    <div
      className="rounded-2xl px-4 py-3.5 mt-3.5 border"
      style={{ borderColor: estilo.borde, background: estilo.fondo }}
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-lg leading-none" style={{ color: estilo.color }} aria-hidden>
          {estilo.icono}
        </span>
        <span
          className="font-semibold text-sm min-w-0 truncate"
          style={{ color: tono === 'err' ? 'var(--pill-pend-fg)' : 'var(--heading)' }}
          title={titulo}
        >
          {titulo}
        </span>
        <span
          className="ml-auto text-[11.5px] font-semibold px-2.5 py-0.5 rounded-pill whitespace-nowrap"
          style={{
            background: tono === 'ok' ? '#DBF3E7' : tono === 'err' ? '#FFDCEA' : 'var(--pill-fut-bg)',
            color: tono === 'ok' ? '#1B7A4E' : tono === 'err' ? '#C31A62' : 'var(--pill-fut-fg)',
          }}
        >
          {insignia}
        </span>
      </div>

      {meta && <p className="text-[13px] text-muted mt-1.5 ml-[30px]">{meta}</p>}

      {items && items.length > 0 && (
        <ul className="list-none mt-2.5 ml-[30px] p-0 flex flex-col gap-2.5">
          {items.map((i, k) => (
            <li key={k} className="text-[13px]" style={{ color: tono === 'err' ? '#C31A62' : 'var(--body)' }}>
              <span className="block">• {i.mensaje}</span>
              {i.donde && (
                <span className="block font-mono text-[11.5px] text-muted mt-0.5 break-words">
                  {i.donde}
                </span>
              )}
              {i.sugerencia && (
                <span className="block text-[12px] text-muted mt-0.5">↳ {i.sugerencia}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Incidencias detectadas en los cursos que ya están en la base. */
function IncidenciasGuardadas() {
  const { base } = useApp()
  const [abierto, setAbierto] = useState(false)
  const conIncidencias = base.cursos.filter((c) => c.incidencias.length > 0)
  const total = conIncidencias.reduce((a, c) => a + c.incidencias.length, 0)
  if (total === 0) return null

  return (
    <Card
      titulo="Calidad de los datos"
      hint={`${total} observación${total === 1 ? '' : 'es'} en ${conIncidencias.length} curso(s)`}
      acciones={
        <button
          className="btn btn-outline"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
        >
          {abierto ? 'Ocultar' : 'Ver'}
        </button>
      }
    >
      {abierto && (
        <div className="flex flex-col gap-4 mt-1">
          {conIncidencias.map((c) => (
            <div key={c.programa.programa_id}>
              <h3 className="font-display font-semibold text-sm text-heading">
                {c.programa.programa}
              </h3>
              <ul className="list-none p-0 mt-1.5 flex flex-col gap-1.5">
                {c.incidencias.map((i, k) => (
                  <li key={k} className="text-[12.5px] text-body flex gap-2">
                    <span
                      className="font-mono text-[10px] uppercase shrink-0 mt-0.5"
                      style={{ color: i.severidad === 'error' ? 'var(--pink)' : 'var(--muted)' }}
                    >
                      {i.severidad}
                    </span>
                    <span>{i.mensaje}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ──────────────────────── persistencia compartida ──────────────────────── */

function PanelGitHub({
  onAviso,
}: {
  onAviso: (a: { tono: 'ok' | 'err'; texto: string }) => void
}) {
  const { base } = useApp()
  const [abierto, setAbierto] = useState(false)
  const [cfg, setCfg] = useState<ConfigGitHub>(() => {
    try {
      const s = localStorage.getItem('cec:gh-cfg')
      return s ? { ...CONFIG_POR_DEFECTO, ...JSON.parse(s) } : CONFIG_POR_DEFECTO
    } catch {
      return CONFIG_POR_DEFECTO
    }
  })
  const [token, setToken] = useState(leerToken)
  const [recordar, setRecordar] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  const guardarCfg = (nuevo: ConfigGitHub) => {
    setCfg(nuevo)
    try {
      localStorage.setItem('cec:gh-cfg', JSON.stringify(nuevo))
    } catch {
      /* sin almacenamiento: la configuración dura la sesión */
    }
  }

  /**
   * La respuesta se guarda aquí y se pinta dentro del panel. Antes iba al aviso
   * global, que vive al principio de la página: quien está abajo configurando el
   * token no lo veía y parecía que el botón no hacía nada.
   */
  const [respuesta, setRespuesta] = useState<ResultadoCommit | null>(null)

  const probar = async () => {
    setTrabajando(true)
    setRespuesta(null)
    const r = await verificarAcceso(cfg, token)
    setTrabajando(false)
    setRespuesta(r)
  }

  const publicar = async () => {
    if (!confirm(`Se hará un commit de la base (${base.cursos.length} cursos) en ${cfg.repo} · ${cfg.rama}. ¿Continuar?`)) return
    setTrabajando(true)
    setRespuesta(null)
    guardarToken(token, recordar)
    const r = await commitJSON(
      cfg, token, JSON.stringify(base),
      `datos: actualiza la base consolidada del CEC (${base.cursos.length} cursos)`,
    )
    setTrabajando(false)
    setRespuesta(r)
    // El resultado de publicar sí interesa aunque el usuario suba la página.
    onAviso({ tono: r.ok ? 'ok' : 'err', texto: r.mensaje })
  }

  return (
    <Card
      titulo="Publicar para el equipo"
      hint="Opcional · commit del JSON al repositorio vía la API de GitHub"
      acciones={
        <button
          className="btn btn-outline"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
        >
          {abierto ? 'Ocultar' : 'Configurar'}
        </button>
      }
    >
      {abierto && (
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-[12.5px] text-muted">
            Guardar es local por dispositivo. Para que el resto del equipo vea los mismos
            datos, publica el JSON en el repositorio: el despliegue de GitHub Pages lo
            recoge y el sitio queda actualizado para todos.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Repositorio</span>
              <input
                className="control"
                placeholder="usuario/repositorio"
                value={cfg.repo}
                onChange={(e) => guardarCfg({ ...cfg, repo: e.target.value.trim() })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Rama</span>
              <input
                className="control"
                value={cfg.rama}
                onChange={(e) => guardarCfg({ ...cfg, rama: e.target.value.trim() })}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="field-label">Ruta del archivo</span>
            <input
              className="control font-mono text-[12.5px]"
              value={cfg.ruta}
              onChange={(e) => guardarCfg({ ...cfg, ruta: e.target.value.trim() })}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="field-label">Token de acceso</span>
            <input
              className="control font-mono text-[12.5px]"
              type="password"
              placeholder="github_pat_…"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
            />
          </label>

          <label className="flex items-center gap-2 text-[12.5px] text-body cursor-pointer">
            <input
              type="checkbox"
              checked={recordar}
              onChange={(e) => setRecordar(e.target.checked)}
              className="w-4 h-4 accent-[var(--cyan)]"
            />
            Recordar el token en este navegador
          </label>
          <p className="text-[11.5px] text-muted">
            Sin marcar, el token vive sólo hasta que cierres la pestaña. Necesita permiso
            «Contents: read and write» sobre el repositorio y no se envía a ningún sitio
            distinto de api.github.com.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-outline"
              onClick={() => void probar()}
              disabled={trabajando || !token || !cfg.repo}
            >
              Probar conexión
            </button>
            <button
              className="btn btn-navy"
              onClick={() => void publicar()}
              disabled={trabajando || !token || !cfg.repo}
            >
              {trabajando ? 'Publicando…' : 'Publicar base'}
            </button>
            {leerToken() && (
              <button
                className="btn btn-outline"
                onClick={() => {
                  olvidarToken()
                  setToken('')
                  setRespuesta({ ok: true, mensaje: 'Token olvidado en este navegador.' })
                }}
              >
                Olvidar token
              </button>
            )}
          </div>

          {trabajando && (
            <p className="text-[13px] text-muted" role="status">Contactando a GitHub…</p>
          )}

          {respuesta && !trabajando && (
            <div
              role="status"
              className="rounded-2xl px-4 py-3 text-[13px] border"
              style={{
                borderColor: respuesta.ok ? 'rgba(47,163,107,.45)' : 'rgba(255,61,139,.45)',
                background: respuesta.ok ? 'var(--green-soft)' : 'var(--pill-pend-bg)',
                color: respuesta.ok ? 'var(--green-ink)' : 'var(--pill-pend-fg)',
              }}
            >
              <span className="mr-1.5" aria-hidden>{respuesta.ok ? '✓' : '!'}</span>
              {respuesta.mensaje}
              {respuesta.url && (
                <>
                  {' '}
                  <a
                    href={respuesta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                    style={{ color: 'inherit' }}
                  >
                    Ver el commit
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
