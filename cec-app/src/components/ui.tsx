/**
 * Piezas de interfaz compartidas, calcadas del sistema de los mockups:
 * tarjetas blancas de esquinas redondeadas, píldoras, KPIs y barras planas.
 */

import type { ReactNode } from 'react'
import type { EstadoSeguimiento, EstadoPrograma } from '../lib/etl/types'

/* ─────────────────────────────── tarjetas ─────────────────────────────── */

export function Card({
  titulo, hint, acciones, children, className = '', id,
}: {
  titulo?: string
  hint?: string
  acciones?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section className={`card ${className}`} aria-labelledby={id ? `${id}-t` : undefined}>
      {(titulo || acciones) && (
        <header className="flex items-start justify-between gap-3 mb-3">
          <div>
            {titulo && <h2 id={id ? `${id}-t` : undefined} className="card-title">{titulo}</h2>}
            {hint && <p className="card-hint">{hint}</p>}
          </div>
          {acciones}
        </header>
      )}
      {children}
    </section>
  )
}

export function Kpi({
  etiqueta, valor, sub, tono = 'neutro',
}: {
  etiqueta: string
  valor: ReactNode
  sub?: string
  tono?: 'neutro' | 'cyan' | 'pink'
}) {
  const color =
    tono === 'cyan' ? 'text-[var(--cyan-ink)]' : tono === 'pink' ? 'text-pink' : 'text-heading'
  return (
    <div className="kpi">
      <div className="kpi-lab">{etiqueta}</div>
      <div className={`kpi-num ${color}`}>{valor}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

/* ─────────────────────────────── píldoras ─────────────────────────────── */

const CLASE_ESTADO: Record<EstadoSeguimiento, string> = {
  'Tabulada': 'pill-tab',
  'Pendiente de tabular': 'pill-pend',
  'Futura no exigible': 'pill-fut',
}

const CORTO_ESTADO: Record<EstadoSeguimiento, string> = {
  'Tabulada': 'Tabulada',
  'Pendiente de tabular': 'Pendiente',
  'Futura no exigible': 'Futura',
}

export function PillEstado({ estado }: { estado: EstadoSeguimiento }) {
  return (
    <span className={`pill ${CLASE_ESTADO[estado]}`} title={estado}>
      {CORTO_ESTADO[estado]}
    </span>
  )
}

/**
 * Dónde está el programa en su ciclo de vida, frente a la fecha de corte.
 * Es la respuesta a «¿qué programas están en ejecución?», que hasta ahora sólo
 * se podía deducir del contador del resumen.
 */
export function PillPrograma({ estado }: { estado: EstadoPrograma }) {
  const clase = estado === 'En ejecución'
    ? 'pill-tab'
    : estado === 'Finalizado' ? 'pill-fin' : 'pill-fut'
  return <span className={`pill ${clase}`}>{estado}</span>
}

export function Pill({
  children, tono = 'fut',
}: {
  children: ReactNode
  tono?: 'tab' | 'pend' | 'fut'
}) {
  return <span className={`pill pill-${tono}`}>{children}</span>
}

/* ─────────────────────────────── gráficos ─────────────────────────────── */

/** Dona de cumplimiento, idéntica a la del mockup (SVG plano, cap redondeado). */
export function Donut({
  valor, etiqueta = 'al día', size = 180,
}: {
  valor: number | null
  etiqueta?: string
  size?: number
}) {
  const p = valor === null ? 0 : Math.max(0, Math.min(1, valor)) * 100
  const texto = valor === null ? '—' : `${(p).toFixed(1).replace('.', ',')}%`
  return (
    <svg
      width={size} height={size} viewBox="0 0 42 42"
      role="img"
      aria-label={`Cumplimiento de tabulación: ${texto}`}
      className="mx-auto block"
    >
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--mint)" strokeWidth="5.5" />
      {p > 0 && (
        <circle
          cx="21" cy="21" r="15.9" fill="none" stroke="var(--cyan)" strokeWidth="5.5"
          strokeDasharray={`${p} ${100 - p}`} strokeDashoffset="25" strokeLinecap="round"
        />
      )}
      <text
        x="21" y="20" textAnchor="middle"
        style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 8, fill: 'var(--heading)' }}
      >
        {texto}
      </text>
      <text
        x="21" y="26.5" textAnchor="middle"
        style={{ fontFamily: 'Geist Mono', fontSize: 2.6, fill: 'var(--muted)', letterSpacing: '.05em' }}
      >
        {etiqueta.toUpperCase()}
      </text>
    </svg>
  )
}

export function Leyenda() {
  const items = [
    ['var(--cyan)', 'tabuladas'],
    ['var(--pink)', 'pendientes'],
    ['var(--gray)', 'futuras'],
  ] as const
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted mt-1">
      {items.map(([c, t]) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <i className="inline-block w-2.5 h-2.5 rounded-[3px]" style={{ background: c }} aria-hidden />
          {t}
        </span>
      ))}
    </div>
  )
}

/* ──────────────────────────────── varios ──────────────────────────────── */

export function EstadoVacio({
  titulo, mensaje, accion,
}: {
  titulo: string
  mensaje: string
  accion?: ReactNode
}) {
  return (
    <div className="card text-center py-12">
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-3 grid place-items-center text-2xl"
        style={{ background: 'var(--mint)', color: 'var(--cyan-ink)' }}
        aria-hidden
      >
        ◷
      </div>
      <h2 className="card-title">{titulo}</h2>
      <p className="card-hint max-w-md mx-auto mt-2">{mensaje}</p>
      {accion && <div className="mt-5 flex justify-center gap-2">{accion}</div>}
    </div>
  )
}

export function PageHead({
  eyebrow, titulo, acento, acentoColor = 'var(--cyan)', children,
}: {
  eyebrow: string
  titulo: string
  acento: string
  acentoColor?: string
  children?: ReactNode
}) {
  return (
    <div className="pt-8 pb-5 sm:pt-9 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="display text-heading mt-2 text-[clamp(30px,7vw,52px)]">
          {titulo}{' '}
          <span className="serif-it" style={{ color: acentoColor }}>{acento}</span>
        </h1>
      </div>
      {children && (
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto [&>*]:flex-1 [&>*]:min-w-[142px] sm:[&>*]:flex-none sm:[&>*]:min-w-0">
          {children}
        </div>
      )}
    </div>
  )
}

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="field-label">{label}</span>
      {children}
    </div>
  )
}
