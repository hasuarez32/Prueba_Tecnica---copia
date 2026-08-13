/**
 * Lectura de archivos del usuario.
 *
 * `Blob.arrayBuffer()` es lo normal hoy, pero no existe en Safari anterior a 14
 * ni en algunos entornos embebidos, así que se cae a `FileReader`. Sin este
 * respaldo, arrastrar un Excel fallaría en silencio justo en los navegadores
 * más viejos, que es donde menos se puede depurar.
 */

export function leerArchivoComoBuffer(archivo: Blob): Promise<ArrayBuffer> {
  if (typeof archivo.arrayBuffer === 'function') return archivo.arrayBuffer()

  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('Este navegador no permite leer archivos locales.'))
      return
    }
    const lector = new FileReader()
    lector.onload = () => {
      const r = lector.result
      if (r instanceof ArrayBuffer) resolve(r)
      else reject(new Error('El archivo no se pudo leer como binario.'))
    }
    lector.onerror = () => reject(lector.error ?? new Error('Error al leer el archivo.'))
    lector.readAsArrayBuffer(archivo)
  })
}

export function leerArchivoComoTexto(archivo: Blob): Promise<string> {
  if (typeof archivo.text === 'function') return archivo.text()

  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('Este navegador no permite leer archivos locales.'))
      return
    }
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result ?? ''))
    lector.onerror = () => reject(lector.error ?? new Error('Error al leer el archivo.'))
    lector.readAsText(archivo, 'utf-8')
  })
}
