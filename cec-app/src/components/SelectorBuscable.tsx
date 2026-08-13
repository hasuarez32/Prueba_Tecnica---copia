/**
 * Selector con búsqueda (patrón combobox de la WAI-ARIA).
 *
 * Un `<select>` nativo deja de servir cuando la lista es larga —22 semanas, por
 * ejemplo—: hay que recorrerla a ojo. Este permite escribir para filtrar,
 * moverse con las flechas y confirmar con Enter, sin perder el aspecto de
 * píldora del resto de la interfaz.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { norm } from '../lib/etl/normalize'

export interface OpcionSelector {
  valor: string
  etiqueta: string
  /** Texto secundario a la derecha (por ejemplo, «12 clases»). */
  sub?: string
  /** Términos extra por los que se puede encontrar la opción. */
  alias?: string
}

export function SelectorBuscable({
  etiqueta, valor, opciones, onChange, placeholder = 'Buscar…', ancho = 190,
}: {
  etiqueta: string
  valor: string
  opciones: OpcionSelector[]
  onChange: (valor: string) => void
  placeholder?: string
  ancho?: number
}) {
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [activo, setActivo] = useState(0)
  const contenedor = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  const id = useId()

  const seleccionada = opciones.find((o) => o.valor === valor)

  const filtradas = useMemo(() => {
    const q = norm(consulta)
    if (!q) return opciones
    return opciones.filter((o) => norm(`${o.etiqueta} ${o.alias ?? ''}`).includes(q))
  }, [opciones, consulta])

  // Al abrir, el foco va al campo de búsqueda y la lista se posiciona en la
  // opción actual: así se puede confirmar con Enter sin tocar nada.
  useEffect(() => {
    if (!abierto) return
    setConsulta('')
    const i = opciones.findIndex((o) => o.valor === valor)
    setActivo(i < 0 ? 0 : i)
    campo.current?.focus()
  }, [abierto, opciones, valor])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const opcion = lista.current?.querySelector('[data-activo="true"]')
    // `scrollIntoView` no existe en todos los entornos (jsdom, por ejemplo):
    // que la lista no siga al cursor no debe tumbar el componente.
    opcion?.scrollIntoView?.({ block: 'nearest' })
  }, [activo, abierto])

  const elegir = (v: string) => {
    onChange(v)
    setAbierto(false)
  }

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((i) => Math.min(i + 1, filtradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActivo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActivo(filtradas.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const o = filtradas[activo]
      if (o) elegir(o.valor)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setAbierto(false)
    }
  }

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        className="control justify-between w-full"
        style={{ width: ancho }}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={etiqueta}
        id={`${id}-boton`}
      >
        <span className="truncate">{seleccionada?.etiqueta ?? '—'}</span>
        <span className="text-muted shrink-0" aria-hidden>▾</span>
      </button>

      {abierto && (
        <div
          className="absolute right-0 z-40 mt-1.5 rounded-soft border border-line-2 overflow-hidden"
          style={{
            background: 'var(--card)',
            width: Math.max(ancho, 240),
            boxShadow: '0 12px 32px rgba(11,19,48,.14)',
          }}
        >
          <div className="p-2 border-b border-line">
            <input
              ref={campo}
              type="text"
              role="combobox"
              aria-expanded={abierto}
              aria-controls={`${id}-lista`}
              aria-autocomplete="list"
              aria-activedescendant={filtradas[activo] ? `${id}-op-${activo}` : undefined}
              className="w-full h-9 px-3 rounded-pill border border-line-2 bg-transparent text-[13.5px] text-heading outline-none"
              placeholder={placeholder}
              value={consulta}
              onChange={(e) => { setConsulta(e.target.value); setActivo(0) }}
              onKeyDown={teclas}
            />
          </div>

          <ul
            ref={lista}
            id={`${id}-lista`}
            role="listbox"
            aria-label={etiqueta}
            className="list-none m-0 p-1 max-h-[264px] overflow-y-auto"
          >
            {filtradas.length === 0 && (
              <li className="px-3 py-2 text-[13px] text-muted">Sin resultados</li>
            )}
            {/* La opción es el propio <li>: el patrón de combobox pide que el
                foco se quede en el campo de texto, así que las opciones no
                deben ser controles enfocables ni contenerlos. */}
            {filtradas.map((o, i) => {
              const esActual = o.valor === valor
              return (
                <li
                  key={o.valor}
                  id={`${id}-op-${i}`}
                  role="option"
                  aria-selected={esActual}
                  data-activo={i === activo}
                  className="px-3 py-2 rounded-lg text-[13.5px] flex items-center gap-2 cursor-pointer"
                  style={{
                    background: i === activo ? 'var(--mint)' : 'transparent',
                    color: 'var(--heading)',
                    fontWeight: esActual ? 600 : 400,
                  }}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(o.valor)}
                >
                  <span className="w-3 shrink-0" style={{ color: 'var(--cyan-ink)' }} aria-hidden>
                    {esActual ? '✓' : ''}
                  </span>
                  <span className="flex-1 truncate">{o.etiqueta}</span>
                  {o.sub && (
                    <span className="font-mono text-[11px] text-muted shrink-0">{o.sub}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
