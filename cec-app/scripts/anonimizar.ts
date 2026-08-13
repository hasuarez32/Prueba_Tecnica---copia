/**
 * Anonimización de la base para publicarla en un sitio abierto.
 *
 * Los Excel del CEC traen datos personales reales: nombres completos, cédulas,
 * y los docentes que dictan cada sesión. Publicar eso en un repositorio público
 * lo deja indexable y permanente en el historial de git, así que el `seed.json`
 * que acompaña al sitio se genera con identidades sintéticas.
 *
 * Dos propiedades importantes:
 *
 *  - **Sólo se sustituyen etiquetas de identidad.** Fechas, horarios, horas de
 *    inasistencia, estados de tabulación y topes quedan intactos, así que todos
 *    los indicadores del panel siguen dando exactamente lo mismo.
 *  - **Es determinista.** La misma persona real produce siempre la misma
 *    identidad falsa, en todos los cursos y en todas las corridas: el JSON no
 *    cambia entre ejecuciones y el participante se ve consistente entre páginas.
 *
 * No es reversible ni pretende serlo: no se guarda el mapeo a ninguna parte.
 */

import type { BaseConsolidada, CursoImportado } from '../src/lib/etl/types'

const NOMBRES = [
  'Camila', 'Andrés', 'Valentina', 'Santiago', 'Daniela', 'Mateo', 'Isabella',
  'Sebastián', 'Sofía', 'Nicolás', 'Juliana', 'Felipe', 'Mariana', 'Tomás',
  'Gabriela', 'Emilio', 'Carolina', 'Julián', 'Natalia', 'Samuel', 'Paula',
  'Diego', 'Laura', 'Martín', 'Adriana', 'Esteban', 'Lucía', 'Alejandro',
  'Manuela', 'Ricardo', 'Verónica', 'Ignacio', 'Renata', 'Óscar', 'Elena',
  'Rodrigo', 'Beatriz', 'Iván', 'Clara', 'Damián',
]

const APELLIDOS = [
  'Restrepo', 'Ospina', 'Cardona', 'Vélez', 'Mejía', 'Zapata', 'Arango',
  'Betancur', 'Quintero', 'Salazar', 'Montoya', 'Gaviria', 'Echeverri',
  'Londoño', 'Jaramillo', 'Escobar', 'Duque', 'Henao', 'Agudelo', 'Bedoya',
  'Carvajal', 'Palacio', 'Grisales', 'Ocampo', 'Serna', 'Marulanda', 'Toro',
  'Uribe', 'Vergara', 'Castaño',
]

/** Hash estable (FNV-1a de 32 bits). No es criptográfico: sólo reparte. */
function hash(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Asigna identidades falsas únicas y estables. */
class Identidades {
  private nombres = new Map<string, string>()
  private documentos = new Map<string, string>()
  private usados = new Set<string>()

  nombre(real: string): string {
    const clave = real.trim().toLowerCase()
    if (!clave) return ''
    const previo = this.nombres.get(clave)
    if (previo) return previo

    // Se parte del hash y se avanza hasta encontrar una combinación libre:
    // determinista y sin colisiones.
    const h = hash(clave)
    let candidato = ''
    for (let intento = 0; intento < NOMBRES.length * APELLIDOS.length; intento++) {
      const n = NOMBRES[(h + intento) % NOMBRES.length]
      const a = APELLIDOS[(Math.floor(h / NOMBRES.length) + intento * 7) % APELLIDOS.length]
      candidato = `${n} ${a}`
      if (!this.usados.has(candidato)) break
    }
    this.usados.add(candidato)
    this.nombres.set(clave, candidato)
    return candidato
  }

  /** Documento sintético: empieza por 9 y es correlativo, para que se note
   *  que no es una cédula real y nadie lo confunda con un dato verdadero. */
  documento(real: string): string {
    if (!real) return ''
    const previo = this.documentos.get(real)
    if (previo) return previo
    const nuevo = String(900000000 + this.documentos.size + 1)
    this.documentos.set(real, nuevo)
    return nuevo
  }
}

export interface ResumenAnonimizacion {
  participantes: number
  docentes: number
  responsables: number
}

export function anonimizar(base: BaseConsolidada): {
  base: BaseConsolidada
  resumen: ResumenAnonimizacion
} {
  const ids = new Identidades()
  const docentes = new Set<string>()
  const responsables = new Set<string>()
  const personas = new Set<string>()

  const cursos: CursoImportado[] = base.cursos.map((curso) => {
    const sesiones = curso.sesiones.map((s) => {
      if (s.docente) docentes.add(s.docente)
      return { ...s, docente: s.docente ? ids.nombre(s.docente) : '' }
    })

    const asistencia = curso.asistencia.map((a) => {
      if (a.documento) personas.add(a.documento)
      return {
        ...a,
        nombre: ids.nombre(a.nombre),
        documento: ids.documento(a.documento),
        // El id_registro incluye el documento: hay que rehacerlo.
        id_registro: `${a.id_sesion}|${ids.documento(a.documento) || 'SD'}`,
      }
    })

    const participantes = curso.participantes.map((p) => {
      if (p.documento) personas.add(p.documento)
      return { ...p, nombre: ids.nombre(p.nombre), documento: ids.documento(p.documento) }
    })

    for (const campo of ['coordinador', 'experto_facilitador'] as const) {
      if (curso.programa[campo]) responsables.add(curso.programa[campo])
    }

    return {
      ...curso,
      sesiones,
      asistencia,
      participantes,
      programa: {
        ...curso.programa,
        coordinador: curso.programa.coordinador ? ids.nombre(curso.programa.coordinador) : '',
        experto_facilitador: curso.programa.experto_facilitador
          ? ids.nombre(curso.programa.experto_facilitador)
          : '',
      },
      // Las incidencias pueden citar el nombre de un participante en el mensaje
      // (por ejemplo al comparar el Σ del archivo con el recalculado).
      incidencias: curso.incidencias.map((i) => ({
        ...i,
        mensaje: censurarNombres(i.mensaje, ids),
      })),
    }
  })

  return {
    base: { ...base, cursos },
    resumen: {
      participantes: personas.size,
      docentes: docentes.size,
      responsables: responsables.size,
    },
  }
}

/** Sustituye los nombres citados entre comillas angulares dentro de un mensaje. */
function censurarNombres(mensaje: string, ids: Identidades): string {
  return mensaje.replace(/«([^»]+)»/g, (completo, dentro: string) => {
    // Sólo parece un nombre propio si son 2+ palabras alfabéticas.
    const palabras = dentro.trim().split(/\s+/)
    const esNombre = palabras.length >= 2 &&
      palabras.every((p) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ.']+$/.test(p))
    return esNombre ? `«${ids.nombre(dentro)}»` : completo
  })
}
