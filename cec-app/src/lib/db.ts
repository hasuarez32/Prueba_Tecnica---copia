/**
 * Persistencia local en IndexedDB (§6).
 *
 * Un solo almacén clave→valor: la base consolidada completa y las preferencias.
 * Si IndexedDB no está disponible (modo privado de algunos navegadores), se cae
 * a `localStorage` para no perder el trabajo del usuario.
 */

import type { BaseConsolidada } from './etl/types'

const DB_NOMBRE = 'cec-operacion'
const DB_VERSION = 1
const ALMACEN = 'kv'

const CLAVE_BASE = 'base'
const CLAVE_PREFS = 'preferencias'

export interface Preferencias {
  fecha_corte?: string
  tema?: 'claro' | 'oscuro'
  github?: { repo: string; rama: string; ruta: string }
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir IndexedDB'))
  })
}

async function poner(clave: string, valor: unknown): Promise<void> {
  try {
    const db = await abrir()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ALMACEN, 'readwrite')
      tx.objectStore(ALMACEN).put(valor, clave)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    try {
      localStorage.setItem(`cec:${clave}`, JSON.stringify(valor))
    } catch {
      /* sin persistencia disponible: la app sigue funcionando en memoria */
    }
  }
}

async function sacar<T>(clave: string): Promise<T | null> {
  try {
    const db = await abrir()
    const valor = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(ALMACEN, 'readonly')
      const req = tx.objectStore(ALMACEN).get(clave)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
    db.close()
    if (valor !== undefined) return valor
  } catch {
    /* cae a localStorage */
  }
  try {
    const s = localStorage.getItem(`cec:${clave}`)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}

export const guardarBase = (base: BaseConsolidada) => poner(CLAVE_BASE, base)
export const cargarBase = () => sacar<BaseConsolidada>(CLAVE_BASE)
export const guardarPreferencias = (p: Preferencias) => poner(CLAVE_PREFS, p)
export const cargarPreferencias = () => sacar<Preferencias>(CLAVE_PREFS)

export async function borrarBase(): Promise<void> {
  await poner(CLAVE_BASE, null)
  try {
    localStorage.removeItem(`cec:${CLAVE_BASE}`)
  } catch {
    /* nada que limpiar */
  }
}
