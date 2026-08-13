/**
 * Barra de navegación en píldora, común a todas las páginas, con la fecha de
 * corte accesible de forma global (§7).
 *
 * En móvil la píldora de páginas se desplaza horizontalmente en vez de
 * apilarse: mantiene el gesto de "una sola fila" del mockup en pantallas chicas.
 */

import { NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { fechaLarga } from '../lib/format'

const PAGINAS = [
  { a: '/', t: 'Resumen' },
  { a: '/semanal', t: 'Semanal' },
  { a: '/tabulacion', t: 'Tabulación' },
  { a: '/academico', t: 'Académico' },
  { a: '/cursos', t: 'Cursos' },
  { a: '/guia', t: 'Guía' },
]

export function NavBar() {
  const { fechaCorte, setFechaCorte, tema, alternarTema } = useApp()
  const navegar = useNavigate()

  return (
    <div
      className="sticky top-0 z-30 border-b border-line"
      style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(14px)' }}
    >
      <div className="wrap flex items-center justify-between gap-3 h-[64px] sm:h-[68px]">
        <button
          className="flex items-center gap-2.5 font-display font-bold text-[18px] sm:text-[20px] tracking-[-0.02em] text-heading bg-transparent border-0 cursor-pointer p-0"
          onClick={() => navegar('/')}
          aria-label="Ir al resumen"
        >
          <span
            className="w-[30px] h-[30px] rounded-[9px] grid place-items-center relative text-[15px] shrink-0"
            style={{
              background: 'var(--accent-solid)',
              color: 'var(--accent-on)',
              boxShadow: '0 0 0 4px rgba(63,207,207,.25)',
            }}
            aria-hidden
          >
            C
            <i
              className="absolute -right-[3px] -bottom-[3px] w-[9px] h-[9px] rounded-full"
              style={{ background: 'var(--pink)' }}
            />
          </span>
          <span className="hidden xs:inline sm:inline">CEC · Operación</span>
        </button>

        <nav
          aria-label="Secciones"
          className="scroll-x order-3 w-full sm:order-none sm:w-auto pb-2 sm:pb-0"
        >
          <div
            className="flex gap-1 p-[5px] rounded-pill border border-line w-max mx-auto"
            style={{ background: 'var(--card)' }}
          >
            {PAGINAS.map((p) => (
              <NavLink
                key={p.a}
                to={p.a}
                end={p.a === '/'}
                className={({ isActive }) =>
                  `px-[13px] sm:px-[15px] py-2 rounded-pill text-[13px] sm:text-[13.5px] font-medium whitespace-nowrap no-underline transition-colors ${
                    isActive ? '' : 'text-heading hover:bg-[var(--mint)]'
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { background: 'var(--accent-solid)', color: 'var(--accent-on)' }
                    : undefined
                }
              >
                {p.t}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="corte-global">Fecha de corte</label>
          <div className="control gap-2 px-3" title={`Fecha de corte: ${fechaLarga(fechaCorte)}`}>
            <span style={{ color: 'var(--pink)' }} aria-hidden>◗</span>
            <input
              id="corte-global"
              type="date"
              value={fechaCorte}
              onChange={(e) => e.target.value && setFechaCorte(e.target.value)}
              className="bg-transparent border-0 text-inherit font-medium text-[13.5px] outline-none w-[122px] cursor-pointer"
              style={{ colorScheme: tema === 'oscuro' ? 'dark' : 'light' }}
            />
          </div>

          <button
            className="btn btn-outline px-3"
            onClick={alternarTema}
            aria-label={tema === 'claro' ? 'Activar tema oscuro' : 'Activar tema claro'}
            title={tema === 'claro' ? 'Tema oscuro' : 'Tema claro'}
          >
            <span aria-hidden>{tema === 'claro' ? '◐' : '◑'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
