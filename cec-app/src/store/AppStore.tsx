/**
 * Estado global de la app: la base consolidada, la fecha de corte y el tema.
 *
 * La base se guarda cruda (sin estados temporales) y `derivada` se recalcula
 * con `useMemo` cada vez que cambia la base o el corte: por eso mover la fecha
 * actualiza todas las páginas al instante sin releer un solo Excel.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import type { BaseConsolidada, BaseDerivada, CursoImportado } from '../lib/etl/types'
import { derivar, hoyISO } from '../lib/etl/derive'
import { baseVacia, upsertCurso, quitarCurso } from '../lib/etl'
import {
  cargarBase, guardarBase, cargarPreferencias, guardarPreferencias, borrarBase,
} from '../lib/db'

export type Tema = 'claro' | 'oscuro'
export type OrigenDatos = 'cargando' | 'local' | 'semilla' | 'vacia'

interface Estado {
  base: BaseConsolidada
  derivada: BaseDerivada
  fechaCorte: string
  origen: OrigenDatos
  tema: Tema
  setFechaCorte: (f: string) => void
  alternarTema: () => void
  agregarCurso: (curso: CursoImportado) => Promise<void>
  eliminarCurso: (programaId: string) => Promise<void>
  reemplazarBase: (base: BaseConsolidada) => Promise<void>
  restaurarSemilla: () => Promise<void>
  limpiarTodo: () => Promise<void>
}

const Ctx = createContext<Estado | null>(null)

/** Ruta de la semilla, relativa a la base del sitio (funciona en Pages). */
function urlSemilla(): string {
  return new URL('data/seed.json', document.baseURI).toString()
}

export function AppStore({ children }: { children: ReactNode }) {
  const [base, setBase] = useState<BaseConsolidada>(baseVacia)
  const [fechaCorte, setFechaCorteRaw] = useState<string>(hoyISO)
  const [origen, setOrigen] = useState<OrigenDatos>('cargando')
  const [tema, setTema] = useState<Tema>(() =>
    document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro')

  // Carga inicial: primero lo guardado en el dispositivo; si no hay, la semilla
  // que viene publicada con el sitio.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const prefs = await cargarPreferencias()
      if (vivo && prefs?.fecha_corte) setFechaCorteRaw(prefs.fecha_corte)

      const guardada = await cargarBase()
      if (vivo && guardada && guardada.cursos?.length) {
        setBase(guardada)
        setOrigen('local')
        return
      }
      try {
        const res = await fetch(urlSemilla(), { cache: 'no-cache' })
        if (!res.ok) throw new Error(String(res.status))
        const datos = (await res.json()) as BaseConsolidada
        if (!vivo) return
        if (Array.isArray(datos?.cursos) && datos.cursos.length) {
          setBase(datos)
          setOrigen('semilla')
          return
        }
        setOrigen('vacia')
      } catch {
        if (vivo) setOrigen('vacia')
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
    try {
      localStorage.setItem('cec:tema', tema)
    } catch {
      /* sin almacenamiento: el tema dura lo que la sesión */
    }
  }, [tema])

  const setFechaCorte = useCallback((f: string) => {
    setFechaCorteRaw(f)
    void guardarPreferencias({ fecha_corte: f, tema })
  }, [tema])

  const alternarTema = useCallback(() => {
    setTema((t) => (t === 'claro' ? 'oscuro' : 'claro'))
  }, [])

  const persistir = useCallback(async (nueva: BaseConsolidada) => {
    setBase(nueva)
    setOrigen(nueva.cursos.length ? 'local' : 'vacia')
    await guardarBase(nueva)
  }, [])

  const agregarCurso = useCallback(async (curso: CursoImportado) => {
    await persistir(upsertCurso(base, curso))
  }, [base, persistir])

  const eliminarCurso = useCallback(async (programaId: string) => {
    await persistir(quitarCurso(base, programaId))
  }, [base, persistir])

  const reemplazarBase = useCallback(async (nueva: BaseConsolidada) => {
    await persistir(nueva)
  }, [persistir])

  const restaurarSemilla = useCallback(async () => {
    const res = await fetch(urlSemilla(), { cache: 'no-cache' })
    const datos = (await res.json()) as BaseConsolidada
    await persistir(datos)
    setOrigen('semilla')
  }, [persistir])

  const limpiarTodo = useCallback(async () => {
    await borrarBase()
    setBase(baseVacia())
    setOrigen('vacia')
  }, [])

  const derivada = useMemo(() => derivar(base, fechaCorte), [base, fechaCorte])

  const valor = useMemo<Estado>(() => ({
    base, derivada, fechaCorte, origen, tema,
    setFechaCorte, alternarTema, agregarCurso, eliminarCurso, reemplazarBase,
    restaurarSemilla, limpiarTodo,
  }), [
    base, derivada, fechaCorte, origen, tema, setFechaCorte, alternarTema,
    agregarCurso, eliminarCurso, reemplazarBase, restaurarSemilla, limpiarTodo,
  ])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useApp(): Estado {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppStore>')
  return ctx
}
