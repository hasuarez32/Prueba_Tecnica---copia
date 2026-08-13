/**
 * Barras apiladas «estado por programa» del resumen.
 *
 * Reproduce la geometría del mockup —el ancho total de cada barra es
 * proporcional al número de sesiones del programa, y dentro se apilan
 * tabuladas / pendientes / futuras— pero con Recharts, para ganar tooltip
 * accesible y redimensionado automático sin perder el aspecto plano.
 */

import {
  Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps,
} from 'recharts'

export interface FilaPrograma {
  id: string
  nombre: string
  tab: number
  pen: number
  fut: number
  total: number
}

const COLORES = {
  tab: 'var(--cyan)',
  pen: 'var(--pink)',
  fut: 'var(--gray)',
} as const

function Etiqueta({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as FilaPrograma
  const filas: Array<[string, number, string]> = [
    ['Tabuladas', d.tab, COLORES.tab],
    ['Pendientes', d.pen, COLORES.pen],
    ['Futuras', d.fut, COLORES.fut],
  ]
  return (
    <div
      className="rounded-soft border border-line px-3 py-2 text-[12.5px]"
      style={{ background: 'var(--card)', color: 'var(--body)' }}
    >
      <p className="font-semibold text-heading m-0 mb-1">{String(label)}</p>
      {filas.map(([t, n, c]) => (
        <p key={t} className="m-0 flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: c }} />
          {t}: <b className="text-heading">{n}</b>
        </p>
      ))}
      <p className="m-0 mt-1 pt-1 border-t border-line text-muted">
        {d.total} sesiones en total
      </p>
    </div>
  )
}

export function GraficoProgramas({ filas }: { filas: FilaPrograma[] }) {
  if (filas.length === 0) {
    return <p className="card-hint mt-4">No hay sesiones con los filtros elegidos.</p>
  }

  const alto = Math.max(140, filas.length * 34 + 16)
  const maximo = Math.max(...filas.map((f) => f.total))

  return (
    <div className="mt-3" style={{ width: '100%', height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={filas}
          layout="vertical"
          margin={{ top: 0, right: 34, bottom: 0, left: 0 }}
          barCategoryGap="22%"
        >
          <XAxis type="number" domain={[0, maximo]} hide />
          <YAxis
            type="category"
            dataKey="nombre"
            width={112}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--heading)', fontSize: 12.5, fontFamily: 'Geist' }}
          />
          <Tooltip content={<Etiqueta />} cursor={{ fill: 'var(--line)' }} />
          <Bar dataKey="tab" stackId="s" fill={COLORES.tab} radius={[4, 0, 0, 4]} isAnimationActive={false} />
          <Bar dataKey="pen" stackId="s" fill={COLORES.pen} isAnimationActive={false} />
          <Bar
            dataKey="fut"
            stackId="s"
            fill={COLORES.fut}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            {/* El total va al final del apilado: el borde derecho del último
                segmento coincide con la suma, incluso si ese segmento es 0. */}
            <LabelList
              dataKey="total"
              position="right"
              offset={8}
              fill="var(--heading)"
              fontSize={13}
              fontWeight={600}
              fontFamily="Geist"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Alternativa textual del gráfico para lectores de pantalla. */}
      <table className="sr-only">
        <caption>Sesiones por programa y estado de tabulación</caption>
        <thead>
          <tr><th>Programa</th><th>Tabuladas</th><th>Pendientes</th><th>Futuras</th><th>Total</th></tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <th scope="row">{f.nombre}</th>
              <td>{f.tab}</td><td>{f.pen}</td><td>{f.fut}</td><td>{f.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
