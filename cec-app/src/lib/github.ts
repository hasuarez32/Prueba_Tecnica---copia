/**
 * Persistencia compartida opcional: commit del JSON consolidado al repositorio
 * vía la API de GitHub (§6).
 *
 * La lectura del sitio es pública; para escribir hace falta un token que el
 * usuario configura. El token vive sólo en este navegador (`sessionStorage` por
 * defecto, para que no quede en disco) y nunca sale hacia otro destino que
 * `api.github.com`.
 */

const API = 'https://api.github.com'
const CLAVE_TOKEN = 'cec:gh-token'

export interface ConfigGitHub {
  /** `usuario/repositorio` */
  repo: string
  rama: string
  /** Ruta del JSON dentro del repo. */
  ruta: string
}

export const CONFIG_POR_DEFECTO: ConfigGitHub = {
  repo: '',
  rama: 'main',
  ruta: 'cec-app/public/data/seed.json',
}

/** El token se guarda en sessionStorage: se borra al cerrar la pestaña. */
export function guardarToken(token: string, recordar: boolean): void {
  try {
    if (recordar) localStorage.setItem(CLAVE_TOKEN, token)
    else sessionStorage.setItem(CLAVE_TOKEN, token)
  } catch {
    /* sin almacenamiento: el token vive sólo en memoria durante la sesión */
  }
}

export function leerToken(): string {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN) ?? localStorage.getItem(CLAVE_TOKEN) ?? ''
  } catch {
    return ''
  }
}

export function olvidarToken(): void {
  try {
    sessionStorage.removeItem(CLAVE_TOKEN)
    localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    /* nada que limpiar */
  }
}

function cabeceras(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/** UTF-8 → base64, que es lo que espera la API de contenidos. */
function aBase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto)
  let binario = ''
  const trozo = 0x8000
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + trozo))
  }
  return btoa(binario)
}

async function mensajeDeError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string }
    return j.message ?? res.statusText
  } catch {
    return res.statusText
  }
}

/** SHA del archivo si ya existe (la API lo exige para sobrescribir). */
async function shaExistente(cfg: ConfigGitHub, token: string): Promise<string | null> {
  const url = `${API}/repos/${cfg.repo}/contents/${encodeURI(cfg.ruta)}?ref=${encodeURIComponent(cfg.rama)}`
  const res = await fetch(url, { headers: cabeceras(token) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`No pude leer el archivo en el repo: ${await mensajeDeError(res)}`)
  const j = (await res.json()) as { sha?: string }
  return j.sha ?? null
}

export interface ResultadoCommit {
  ok: boolean
  mensaje: string
  url?: string
}

/** Verifica que el token sirve y que hay permiso de escritura en el repo. */
export async function verificarAcceso(cfg: ConfigGitHub, token: string): Promise<ResultadoCommit> {
  if (!cfg.repo.includes('/')) {
    return { ok: false, mensaje: 'El repositorio debe tener el formato usuario/repositorio.' }
  }
  try {
    const res = await fetch(`${API}/repos/${cfg.repo}`, { headers: cabeceras(token) })
    if (res.status === 401) return { ok: false, mensaje: 'El token no es válido o expiró.' }
    if (res.status === 404) {
      return { ok: false, mensaje: `No encuentro el repositorio ${cfg.repo} (o el token no tiene acceso).` }
    }
    if (!res.ok) return { ok: false, mensaje: await mensajeDeError(res) }
    const j = (await res.json()) as { permissions?: { push?: boolean }; full_name?: string }
    if (!j.permissions?.push) {
      return { ok: false, mensaje: `El token no tiene permiso de escritura en ${cfg.repo}. Necesita el alcance «Contents: read and write».` }
    }
    return { ok: true, mensaje: `Conectado a ${j.full_name} con permiso de escritura.` }
  } catch (e) {
    return { ok: false, mensaje: `No pude contactar a GitHub: ${(e as Error).message}` }
  }
}

/** Sube el JSON consolidado como un commit. */
export async function commitJSON(
  cfg: ConfigGitHub,
  token: string,
  contenido: string,
  mensajeCommit: string,
): Promise<ResultadoCommit> {
  if (!token) {
    return { ok: false, mensaje: 'Configura primero un token de GitHub con permiso de escritura.' }
  }
  if (!cfg.repo.includes('/')) {
    return { ok: false, mensaje: 'El repositorio debe tener el formato usuario/repositorio.' }
  }
  try {
    const sha = await shaExistente(cfg, token)
    const res = await fetch(`${API}/repos/${cfg.repo}/contents/${encodeURI(cfg.ruta)}`, {
      method: 'PUT',
      headers: { ...cabeceras(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: mensajeCommit,
        content: aBase64(contenido),
        branch: cfg.rama,
        ...(sha ? { sha } : {}),
      }),
    })
    if (!res.ok) return { ok: false, mensaje: await mensajeDeError(res) }
    const j = (await res.json()) as { commit?: { html_url?: string; sha?: string } }
    return {
      ok: true,
      mensaje: `Base publicada en ${cfg.repo} (${cfg.rama}). El sitio se actualiza cuando termine el despliegue.`,
      url: j.commit?.html_url,
    }
  } catch (e) {
    return { ok: false, mensaje: `No pude publicar: ${(e as Error).message}` }
  }
}
