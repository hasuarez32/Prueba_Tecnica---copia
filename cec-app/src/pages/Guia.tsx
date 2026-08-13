/**
 * Página 6 — Guía de datos.
 *
 * Explica qué significa cada variable del modelo y de dónde sale. Es la
 * respuesta a la pregunta que siempre aparece cuando alguien hereda un tablero:
 * «¿y este número de dónde salió?».
 *
 * El contenido vive en `lib/diccionario.ts`; aquí sólo se presenta y se filtra.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, PageHead } from '../components/ui'
import { useApp } from '../store/AppStore'
import {
  CALIDAD, CONCEPTOS, FUENTES, PAGINAS_DOC, TABLAS, type CampoDoc,
} from '../lib/diccionario'
import { norm } from '../lib/etl/normalize'
import { fechaLarga, numero, pct } from '../lib/format'

const SECCIONES = [
  { id: 'paginas', titulo: 'Las páginas' },
  { id: 'conceptos', titulo: 'Conceptos clave' },
  { id: 'diccionario', titulo: 'Diccionario de datos' },
  { id: 'fuentes', titulo: 'De dónde sale cada dato' },
  { id: 'calidad', titulo: 'Calidad de datos' },
]

export function Guia() {
  const { derivada, fechaCorte } = useApp()
  const [busqueda, setBusqueda] = useState('')

  const q = norm(busqueda)

  /** Filtra los campos del diccionario por cualquier palabra que contengan. */
  const tablasFiltradas = useMemo(() => {
    if (!q) return TABLAS
    return TABLAS
      .map((t) => ({
        ...t,
        campos: t.campos.filter((c) =>
          norm(`${c.campo} ${c.descripcion} ${c.origen} ${c.nota ?? ''} ${c.ejemplo ?? ''}`).includes(q)),
      }))
      .filter((t) => t.campos.length > 0 || norm(t.nombre).includes(q))
  }, [q])

  const totalCampos = TABLAS.reduce((a, t) => a + t.campos.length, 0)
  const encontrados = tablasFiltradas.reduce((a, t) => a + t.campos.length, 0)

  return (
    <div className="wrap pb-16">
      <PageHead
        eyebrow="Documentación · modelo de datos"
        titulo="Guía de"
        acento="datos"
      >
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Buscar variable</span>
          <input
            type="search"
            className="control w-[220px]"
            placeholder="tabulada, tope, jornada…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-describedby="busqueda-ayuda"
          />
        </label>
      </PageHead>

      <p id="busqueda-ayuda" className="text-[13.5px] text-body max-w-[70ch] -mt-1 mb-5">
        Todo lo que ves en el panel sale de dos Excel por curso. Esta página explica
        qué significa cada variable, cómo se calcula y qué decisiones se tomaron cuando
        los archivos no venían perfectos.
        {q && (
          <span className="block mt-2 text-muted">
            {encontrados === 0
              ? `Ninguna variable coincide con «${busqueda}».`
              : `${encontrados} de ${totalCampos} variables coinciden con «${busqueda}».`}
          </span>
        )}
      </p>

      {/* Índice */}
      <nav aria-label="Secciones de la guía" className="mb-6">
        <ul className="list-none p-0 m-0 flex flex-wrap gap-2">
          {SECCIONES.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="control no-underline text-[13px] px-3.5 h-9 inline-flex"
              >
                {s.titulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ─────────────────────────── las páginas ─────────────────────────── */}
      <section id="paginas" className="scroll-mt-24 mb-8">
        <h2 className="display text-[26px] text-heading mb-1">Las páginas</h2>
        <p className="card-hint mb-4 max-w-[70ch]">
          Cada una responde una pregunta distinta sobre los mismos datos.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {PAGINAS_DOC.map((p) => (
            <Card key={p.id}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="card-title">{p.nombre}</h3>
                <Link to={p.ruta.replace('#', '')} className="font-mono text-[11.5px] text-[var(--cyan-ink)]">
                  {p.ruta}
                </Link>
              </div>
              <p className="text-[13.5px] font-medium text-heading mt-2 mb-1">{p.pregunta}</p>
              <p className="text-[13px] text-body">{p.descripcion}</p>
              <dl className="mt-3 flex flex-col gap-2.5">
                {p.elementos.map((e) => (
                  <div key={e.titulo}>
                    <dt className="text-[13px] font-semibold text-heading">{e.titulo}</dt>
                    <dd className="text-[12.5px] text-muted m-0">{e.detalle}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      </section>

      {/* ────────────────────────── conceptos clave ────────────────────────── */}
      <section id="conceptos" className="scroll-mt-24 mb-8">
        <h2 className="display text-[26px] text-heading mb-1">Conceptos clave</h2>
        <p className="card-hint mb-4 max-w-[70ch]">
          Siete reglas que gobiernan todos los números. Si algo del panel sorprende,
          la explicación casi siempre está aquí.
        </p>

        <div className="flex flex-col gap-4">
          {CONCEPTOS.map((c) => (
            <Card key={c.id}>
              <h3 className="card-title">{c.titulo}</h3>
              <p className="text-[13px] text-[var(--cyan-ink)] font-medium mt-1">{c.resumen}</p>

              {c.formula && (
                <p
                  className="font-mono text-[13px] my-3 px-3.5 py-2.5 rounded-soft border border-line inline-block"
                  style={{ background: 'var(--card-2)', color: 'var(--heading)' }}
                >
                  {c.formula}
                </p>
              )}

              <div className="flex flex-col gap-2 mt-2 max-w-[78ch]">
                {c.cuerpo.map((p, i) => (
                  <p key={i} className="text-[13.5px] text-body">{p}</p>
                ))}
              </div>

              {c.tabla && (
                <div className="scroll-x mt-3">
                  <table>
                    <thead>
                      <tr>
                        {c.tabla.encabezados.map((h) => (
                          <th key={h} scope="col" className="th">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.tabla.filas.map((f, i) => (
                        <tr key={i}>
                          {f.map((celda, j) => (
                            <td key={j} className={`td ${j === 0 ? 'font-medium text-heading' : ''}`}>
                              {celda}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* ───────────────────────── diccionario de datos ───────────────────── */}
      <section id="diccionario" className="scroll-mt-24 mb-8">
        <h2 className="display text-[26px] text-heading mb-1">Diccionario de datos</h2>
        <p className="card-hint mb-4 max-w-[70ch]">
          {totalCampos} variables repartidas en cinco tablas. El modelo es el mismo que
          alimenta el tablero de Power BI, así que los nombres coinciden con los de
          <code className="font-mono text-[12px]"> base_consolidada.xlsx</code>.
        </p>

        {tablasFiltradas.length === 0 ? (
          <Card>
            <p className="text-[13.5px] text-body">
              Prueba con otro término: «tabulada», «tope», «intensidad», «jornada» o
              «documento».
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {tablasFiltradas.map((t) => (
              <Card key={t.id} id={t.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="card-title">{t.nombre}</h3>
                  <span className="font-mono text-[11.5px] text-muted">
                    {t.campos.length} variable{t.campos.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--cyan-ink)] font-medium mt-1">{t.grano}</p>
                <p className="text-[13px] text-body mt-1 max-w-[78ch]">{t.proposito}</p>

                <div className="scroll-x mt-3">
                  <table>
                    <caption className="sr-only">Variables de la tabla {t.nombre}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="th">Variable</th>
                        <th scope="col" className="th">Tipo</th>
                        <th scope="col" className="th">Qué es</th>
                        <th scope="col" className="th">De dónde sale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.campos.map((c) => (
                        <FilaCampo key={c.campo} campo={c} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ────────────────────── de dónde sale cada dato ────────────────────── */}
      <section id="fuentes" className="scroll-mt-24 mb-8">
        <h2 className="display text-[26px] text-heading mb-1">De dónde sale cada dato</h2>
        <p className="card-hint mb-4 max-w-[70ch]">
          Dos archivos Excel por curso, tres hojas útiles. Así se leen.
        </p>

        <div className="flex flex-col gap-4">
          {FUENTES.map((f) => (
            <Card key={f.id}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="card-title font-mono text-[15px]">{f.archivo}</h3>
                <span className="text-[12.5px] text-muted">hoja «{f.hoja}»</span>
              </div>
              <p className="text-[13px] text-[var(--cyan-ink)] font-medium mt-1.5">{f.aporta}</p>
              <p className="text-[13px] text-body mt-2 max-w-[78ch]">{f.detalle}</p>

              <div className="scroll-x mt-3">
                <table>
                  <thead>
                    <tr>
                      <th scope="col" className="th">En el Excel</th>
                      <th scope="col" className="th">Se convierte en</th>
                      <th scope="col" className="th">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.columnas.map(([excel, destino, nota]) => (
                      <tr key={excel}>
                        <td className="td font-mono text-[12.5px] text-heading">{excel}</td>
                        <td className="td">{destino}</td>
                        <td className="td text-muted text-[12.5px]">{nota || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ───────────────────────── calidad de datos ───────────────────────── */}
      <section id="calidad" className="scroll-mt-24 mb-8">
        <h2 className="display text-[26px] text-heading mb-1">Calidad de datos</h2>
        <p className="card-hint mb-4 max-w-[70ch]">
          Los archivos reales traen inconsistencias. El criterio es no corregirlas en
          silencio: se conservan tal como están y se marcan, para que quien conoce el
          curso decida qué hacer.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {CALIDAD.map((g) => (
            <Card key={g.severidad}>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: g.severidad === 'error' ? 'var(--pink)' : 'var(--gray)' }}
                  aria-hidden
                />
                <h3 className="card-title">{g.titulo}</h3>
              </div>
              <p className="text-[13px] text-body mt-2">{g.descripcion}</p>
              <ul className="list-none p-0 mt-3 flex flex-col gap-2">
                {g.casos.map((c) => (
                  <li key={c} className="text-[12.5px] text-body flex gap-2">
                    <span className="text-muted shrink-0" aria-hidden>·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* ───────────────────────── estado de esta base ───────────────────── */}
      <Card titulo="Esta base, ahora mismo" hint={`Al corte del ${fechaLarga(fechaCorte)}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-1">
          {[
            ['Programas', numero(derivada.totales.n_programas)],
            ['En ejecución', numero(derivada.totales.n_en_ejecucion)],
            ['Sesiones', numero(derivada.totales.n_sesiones)],
            ['Realizadas', numero(derivada.totales.n_realizadas)],
            ['Tabuladas', numero(derivada.totales.n_tabuladas)],
            ['Pendientes', numero(derivada.totales.n_pendientes)],
            ['Cumplimiento', pct(derivada.totales.pct_cumplimiento)],
            ['Participantes', numero(derivada.totales.n_participantes)],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="kpi-lab">{k}</div>
              <div className="font-display font-bold text-[22px] text-heading mt-1">{v}</div>
            </div>
          ))}
        </div>
        <p className="card-hint mt-4">
          Los registros de asistencia sólo existen para sesiones tabuladas: hoy son{' '}
          {numero(derivada.asistencia.length)} filas de participante × sesión.
        </p>
      </Card>
    </div>
  )
}

function FilaCampo({ campo }: { campo: CampoDoc }) {
  return (
    <tr>
      <td className="td align-top">
        <span className="font-mono text-[12.5px] font-semibold text-heading whitespace-nowrap">
          {campo.campo}
        </span>
      </td>
      <td className="td align-top">
        <span className="text-[12px] text-muted whitespace-nowrap">{campo.tipo}</span>
      </td>
      <td className="td align-top max-w-[38ch]">
        <span className="block">{campo.descripcion}</span>
        {campo.ejemplo && (
          <span className="block font-mono text-[11.5px] text-muted mt-1">
            ej. {campo.ejemplo}
          </span>
        )}
        {campo.nota && (
          <span
            className="block text-[12px] mt-1.5 pl-2 border-l-2"
            style={{ borderColor: 'var(--cyan)', color: 'var(--muted)' }}
          >
            {campo.nota}
          </span>
        )}
      </td>
      <td className="td align-top text-muted text-[12.5px] max-w-[30ch]">{campo.origen}</td>
    </tr>
  )
}
