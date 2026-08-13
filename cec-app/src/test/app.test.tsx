/**
 * @vitest-environment jsdom
 *
 * Pruebas de interfaz: verifican que las páginas **muestran** los números de
 * la base de referencia, que mover la fecha de corte recalcula todo, y que un
 * archivo inválido produce un error concreto en pantalla en vez de romperse.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, cleanup, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

import App from '../App'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(AQUI, '../..')
const RAIZ = path.resolve(APP, '..')
const CORTE = '2026-08-11'

/** Los Excel de ejemplo no viajan en el repositorio (datos personales). */
const HAY_EXCEL = fs.existsSync(
  path.join(RAIZ, 'Bienestar integral y felicidad', 'Equipo Logístico', 'Listado de Clases'),
)

let semilla: string

beforeAll(() => {
  // Fixture propio, NO `public/data/seed.json`. Ese archivo cambia cuando el
  // equipo publica sus propios cursos, y estas pruebas verifican números fijos
  // (130 sesiones, 74,6 %…): si dependieran de él, publicar datos distintos
  // rompería el CI y bloquearía el despliegue del sitio.
  semilla = fs.readFileSync(path.join(APP, 'src', 'test', 'fixtures', 'seed-ejemplo.json'), 'utf8')
})

beforeEach(() => {
  localStorage.clear()
  // jsdom conserva el hash entre pruebas: sin esto cada una arrancaría en la
  // página donde terminó la anterior.
  window.location.hash = '#/'
  document.documentElement.classList.remove('dark')
  // La app arranca con la fecha de corte guardada en preferencias.
  localStorage.setItem('cec:preferencias', JSON.stringify({ fecha_corte: CORTE }))
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
    if (String(url).includes('seed.json')) {
      return new Response(semilla, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('no encontrado', { status: 404 })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Renderiza la app y espera a que la semilla esté cargada. */
async function montar() {
  const utils = render(<App />)
  await screen.findByText('Estado por programa', {}, { timeout: 5000 })
  return utils
}

/** Valor de un KPI, localizado por su etiqueta. */
function kpi(etiqueta: string): string {
  const lab = screen.getAllByText(etiqueta)[0]
  const caja = lab.closest('.kpi')
  if (!caja) throw new Error(`No encontré la tarjeta del KPI «${etiqueta}»`)
  return caja.querySelector('.kpi-num')?.textContent?.trim() ?? ''
}

async function irA(nombre: string) {
  const nav = screen.getByRole('navigation', { name: 'Secciones' })
  await userEvent.click(within(nav).getByRole('link', { name: nombre }))
}

describe('Resumen', () => {
  it('muestra los totales de la base con corte 11/08/2026', async () => {
    await montar()
    expect(kpi('En ejecución')).toBe('6')
    expect(kpi('Cumplimiento')).toBe('74,6%')
    expect(kpi('Pendientes')).toBe('15')
    expect(kpi('En riesgo')).toBe('3')
  })

  it('detalla realizadas, tabuladas, pendientes y futuras', async () => {
    await montar()
    const tarjeta = screen.getByText('Cumplimiento de tabulación').closest('.card') as HTMLElement
    const valor = (etiqueta: string) =>
      within(tarjeta).getByText(etiqueta).parentElement?.querySelector('dd')?.textContent?.trim()
    expect(valor('Sesiones realizadas')).toBe('59')
    expect(valor('Tabuladas')).toBe('44')
    expect(valor('Pendientes de tabular')).toBe('15')
    expect(valor('Futuras (no exigibles)')).toBe('71')
  })

  it('lista los 8 programas con su total de sesiones', async () => {
    await montar()
    const tabla = screen.getByRole('table', { name: /Sesiones por programa/i })
    const filas = within(tabla).getAllByRole('row').slice(1) // sin encabezado
    expect(filas).toHaveLength(8)
    const heridas = filas.find((f) => f.textContent?.includes('Cuidado de Heridas'))!
    const celdas = within(heridas).getAllByRole('cell').map((c) => c.textContent)
    expect(celdas).toEqual(['11', '5', '21', '37']) // tab, pen, fut, total
  })

  it('filtra por programa y recalcula los KPI', async () => {
    await montar()
    await userEvent.selectOptions(
      screen.getByLabelText('Filtrar por programa'), 'HERIDAS',
    )
    await waitFor(() => expect(kpi('Pendientes')).toBe('5'))
    expect(kpi('Cumplimiento')).toBe('68,8%') // 11/16
    expect(kpi('En riesgo')).toBe('0')
  })
})

describe('la fecha de corte recalcula todas las páginas', () => {
  it('al mover el corte al 31/12/2026 cambian los estados', async () => {
    await montar()
    expect(kpi('Pendientes')).toBe('15')

    // En jsdom un <input type="date"> no acepta tecleo carácter a carácter:
    // los valores intermedios son inválidos y nunca dispara change.
    fireEvent.change(screen.getByLabelText('Fecha de corte'), { target: { value: '2026-12-31' } })

    await waitFor(() => expect(kpi('Pendientes')).toBe('86'))
    expect(kpi('Cumplimiento')).toBe('33,8%') // 44/130
    expect(kpi('En ejecución')).toBe('0')     // todos finalizados
  })

  it('antes del primer curso no hay nada exigible', async () => {
    await montar()
    fireEvent.change(screen.getByLabelText('Fecha de corte'), { target: { value: '2026-07-01' } })

    await waitFor(() => expect(kpi('Pendientes')).toBe('0'))
    expect(kpi('Cumplimiento')).toBe('100,0%')
    expect(kpi('En ejecución')).toBe('0') // ninguno ha empezado
  })
})

describe('Control de tabulación', () => {
  it('ordena la lista de acción por días de atraso', async () => {
    await montar()
    await irA('Tabulación')

    await screen.findByText('Lista de acción — pendientes de tabular')
    expect(kpi('Tabuladas')).toBe('44')
    expect(kpi('Realizadas')).toBe('59')

    const tabla = screen.getByRole('table')
    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas).toHaveLength(15)

    // La más atrasada primero: Bootcamp del 18/07, 24 días antes del corte.
    const primera = within(filas[0]).getAllByRole('cell').map((c) => c.textContent)
    expect(primera[1]).toContain('Bootcamp')
    expect(primera[2]).toContain('18/07')
    expect(primera[4]).toContain('24')

    // El atraso nunca aumenta hacia abajo.
    const atrasos = filas.map((f) => {
      const celdas = within(f).getAllByRole('cell')
      return Number(celdas[celdas.length - 1].textContent?.replace(/\D/g, ''))
    })
    expect([...atrasos].sort((a, b) => b - a)).toEqual(atrasos)
  })

  it('incluye las sesiones de Heridas del 31/07 y del 08/08', async () => {
    await montar()
    await irA('Tabulación')
    await screen.findByText('Lista de acción — pendientes de tabular')

    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const heridas = filas.filter((f) => f.textContent?.includes('Cuidado de Heridas'))
    expect(heridas).toHaveLength(5)
    expect(heridas.filter((f) => f.textContent?.includes('31/07'))).toHaveLength(4)
    expect(heridas.filter((f) => f.textContent?.includes('08/08'))).toHaveLength(1)
  })
})

describe('Detalle académico', () => {
  it('muestra participantes, riesgo y asistencia', async () => {
    await montar()
    await irA('Académico')
    await screen.findByText('Inasistencia por participante')

    expect(kpi('Participantes')).toBe('108')
    expect(kpi('En riesgo')).toBe('3')
    expect(kpi('Asistencia')).toBe('90,6%')
  })

  it('pone arriba a quienes superan su tope', async () => {
    await montar()
    await irA('Académico')
    await screen.findByText('Inasistencia por participante')

    const filas = within(screen.getByRole('table', { name: /Inasistencia acumulada/i }))
      .getAllByRole('row').slice(1)
    const primeras = filas.slice(0, 3).map((f) => f.textContent ?? '')
    for (const t of primeras) expect(t).toContain('En riesgo')
    expect(primeras[0]).toMatch(/36/)
    expect(primeras[0]).toMatch(/Gerencia Proyectos/)
  })

  it('el filtro «sólo en riesgo» deja tres filas', async () => {
    await montar()
    await irA('Académico')
    await screen.findByText('Inasistencia por participante')

    await userEvent.click(screen.getByLabelText('Sólo en riesgo'))
    await waitFor(() => {
      const filas = within(screen.getByRole('table', { name: /Inasistencia acumulada/i }))
        .getAllByRole('row').slice(1)
      expect(filas).toHaveLength(3)
    })
  })
})

describe('Semanal', () => {
  it('abre en la semana del corte', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')

    // El selector muestra el rango de la semana que contiene al corte.
    expect(screen.getByRole('button', { name: 'Elegir semana' })).toHaveTextContent('10 – 16 ago')
    const tabla = screen.getByRole('table', { name: /por programa y/i })
    expect(within(tabla).getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('permite buscar la semana escribiendo', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')

    await userEvent.click(screen.getByRole('button', { name: 'Elegir semana' }))
    await userEvent.type(screen.getByPlaceholderText(/Buscar semana/i), 'sep')

    const opciones = within(screen.getByRole('listbox', { name: 'Elegir semana' }))
      .getAllByRole('option')
    expect(opciones.length).toBeGreaterThan(0)
    for (const o of opciones) expect(o.textContent).toMatch(/sep/i)

    await userEvent.click(opciones[0])
    expect(screen.getByRole('button', { name: 'Elegir semana' })).toHaveTextContent('sep')
  })

  it('muestra todas las semanas y cambia el eje a semanas', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')

    await userEvent.click(screen.getByRole('button', { name: 'Elegir semana' }))
    await userEvent.click(await screen.findByRole('option', { name: /Todas las semanas/i }))

    expect(await screen.findByText('Carga por semana')).toBeInTheDocument()
    expect(screen.getByText('Todas las clases')).toBeInTheDocument()
    // Las 130 sesiones de la base entran en el listado.
    const listado = screen.getAllByRole('table')
    const filas = within(listado[listado.length - 1]).getAllByRole('row').slice(1)
    expect(filas).toHaveLength(130)
  })

  it('filtra por programa', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')

    // Todas las semanas + un solo programa: deben quedar sus 37 sesiones.
    await userEvent.click(screen.getByRole('button', { name: 'Elegir semana' }))
    await userEvent.click(await screen.findByRole('option', { name: /Todas las semanas/i }))

    await userEvent.click(screen.getByRole('button', { name: 'Filtrar por programa' }))
    await userEvent.type(screen.getByPlaceholderText(/Buscar programa/i), 'heridas')
    await userEvent.click(await screen.findByRole('option', { name: /Cuidado de Heridas/i }))

    await waitFor(() => {
      const tablas = screen.getAllByRole('table')
      const filas = within(tablas[tablas.length - 1]).getAllByRole('row').slice(1)
      expect(filas).toHaveLength(37)
    })
    expect(kpi('Sesiones')).toBe('37')
  })
})

describe('Semanal — programa en ejecución vs. con clase (§5)', () => {
  /**
   * El enunciado pide diferenciar los dos conceptos: un programa puede estar
   * activo según su cronograma y aun así no tener clase la semana elegida.
   * En la semana del 10 al 16 de agosto eso le pasa a Odontología.
   */
  it('distingue los programas activos de los que tienen clase', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')

    expect(kpi('En ejecución')).toBe('6')
    expect(kpi('Con clase')).toBe('5')
    expect(kpi('Sesiones')).toBe('11')
  })

  it('nombra los programas en ejecución que no tienen clase esa semana', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')

    const aviso = screen.getByText(/en ejecución sin clase en/)
    expect(aviso.textContent).toContain('1 programa')
    expect(aviso.textContent).toContain('Odontología Estética')
  })

  it('al cambiar de semana cambian ambos conteos', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')

    await userEvent.click(screen.getByRole('button', { name: 'Elegir semana' }))
    await userEvent.click(await screen.findByRole('option', { name: /^6 – 12 jul/ }))

    // Primera semana del periodo: sólo habían arrancado Project (09/07) y
    // Bootcamp (11/07); los demás cronogramas empiezan el 14/07 o después.
    await waitFor(() => expect(kpi('Con clase')).toBe('2'))
    expect(kpi('En ejecución')).toBe('2')
    expect(kpi('Sesiones')).toBe('2')
    // Ningún programa activo se queda sin clase, así que no hay aviso.
    expect(screen.queryByText(/en ejecución sin clase en/)).toBeNull()
  })
})

describe('Semanal — carga por día (§6)', () => {
  /** «cuántas sesiones deben atenderse cada día» y cuántos programas mueven. */
  it('cuenta sesiones, programas y horas por día', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')

    const tabla = screen.getByRole('table', { name: /por programa y/i })
    const pie = tabla.querySelector('tfoot')!
    const fila = (encabezado: string) =>
      within(pie).getByText(encabezado).closest('tr')!

    const valores = (encabezado: string) =>
      Array.from(fila(encabezado).querySelectorAll('td')).map((c) => c.textContent)

    // Martes a sábado de la semana del 10 al 16 de agosto.
    expect(valores('Sesiones')).toEqual(['2', '2', '2', '2', '3'])
    expect(valores('Programas')).toEqual(['2', '2', '2', '2', '3'])
    expect(valores('Horas')).toEqual(['6', '6', '5', '8', '15'])
  })

  it('la matriz muestra sesiones por defecto y permite ver horas', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')

    const grupo = screen.getByRole('group', { name: 'Métrica de la matriz' })
    expect(within(grupo).getByRole('button', { name: 'Sesiones' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(within(grupo).getByRole('button', { name: 'Horas' }))
    await waitFor(() =>
      expect(within(grupo).getByRole('button', { name: 'Horas' })).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('table', { name: /Horas de clase por programa/i })).toBeInTheDocument()
  })
})

describe('Cursos — carga en dos viajes', () => {
  /**
   * Un curso son dos Excel y casi nunca se arrastran juntos. Los archivos se
   * acumulan: se sube uno, luego el otro, y sólo entonces se puede crear.
   */
  it.skipIf(!HAY_EXCEL)('acepta el cronograma primero y el listado después', async () => {
    await montar()
    await irA('Cursos')
    await screen.findByText('Agregar curso')

    const dir = path.join(RAIZ, 'Bienestar integral y felicidad', 'Equipo Logístico', 'Listado de Clases')
    const nombres = fs.readdirSync(dir).filter((f) => /\.xlsx$/i.test(f))
    const archivo = (n: string) =>
      new File([new Uint8Array(fs.readFileSync(path.join(dir, n)))], n)
    const input = () => document.getElementById('archivos') as HTMLInputElement

    // ── primer viaje: sólo el cronograma
    await userEvent.upload(input(), archivo(nombres.find((n) => /^cronograma/i.test(n))!))

    expect(await screen.findByText(/Falta el listado de participantes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar curso' })).toBeDisabled()
    // El cronograma ya aparece como cumplido, no como error.
    expect(screen.getByText('Cronograma_Felicidad.xlsx')).toBeInTheDocument()
    expect(screen.getByText('pendiente')).toBeInTheDocument()

    // ── segundo viaje: el listado. No se pierde lo anterior.
    await userEvent.upload(input(), archivo(nombres.find((n) => !/^cronograma/i.test(n))!))

    expect(await screen.findByText('válido')).toBeInTheDocument()
    expect(screen.getByText(/4 sesiones · 25\/jul → 15\/ago · 9 participantes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar curso' })).toBeEnabled()
    expect(screen.queryByText('pendiente')).toBeNull()
  })

  it.skipIf(!HAY_EXCEL)('permite quitar un archivo y volver a dejarlo incompleto', async () => {
    await montar()
    await irA('Cursos')
    await screen.findByText('Agregar curso')

    const dir = path.join(RAIZ, 'Bienestar integral y felicidad', 'Equipo Logístico', 'Listado de Clases')
    const archivos = fs.readdirSync(dir)
      .filter((f) => /\.xlsx$/i.test(f))
      .map((f) => new File([new Uint8Array(fs.readFileSync(path.join(dir, f)))], f))

    await userEvent.upload(document.getElementById('archivos') as HTMLInputElement, archivos)
    expect(await screen.findByText('válido')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Quitar Cronograma_Felicidad/i }))

    expect(await screen.findByText(/Falta el cronograma/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar curso' })).toBeDisabled()
  })

  it.skipIf(!HAY_EXCEL)('guarda el curso y limpia la selección', async () => {
    await montar()
    await irA('Cursos')
    await screen.findByText('Agregar curso')

    const dir = path.join(RAIZ, 'Bienestar integral y felicidad', 'Equipo Logístico', 'Listado de Clases')
    const archivos = fs.readdirSync(dir)
      .filter((f) => /\.xlsx$/i.test(f))
      .map((f) => new File([new Uint8Array(fs.readFileSync(path.join(dir, f)))], f))

    await userEvent.upload(document.getElementById('archivos') as HTMLInputElement, archivos)
    await screen.findByText('válido')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar curso' }))

    expect(await screen.findByText(/quedó guardado en este dispositivo/)).toBeInTheDocument()
    // La zona de carga vuelve a estar vacía, lista para el siguiente curso.
    expect(screen.queryByText('válido')).toBeNull()
    // El disparador es un <label> asociado al input, no un <button>.
    expect(screen.getByText('Seleccionar archivos')).toBeInTheDocument()
  })
})

describe('Cursos — publicar para el equipo', () => {
  /**
   * La respuesta tiene que salir dentro del panel. Antes iba al aviso global,
   * al principio de la página: quien está abajo configurando el token no lo veía
   * y parecía que «Probar conexión» no hacía nada.
   */
  async function abrirPanel() {
    await montar()
    await irA('Cursos')
    await userEvent.click(await screen.findByRole('button', { name: 'Configurar' }))
    return screen.getByText('Publicar para el equipo').closest('.card') as HTMLElement
  }

  it('muestra el resultado de «Probar conexión» dentro del panel', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('seed.json')) return new Response(semilla, { status: 200 })
      return new Response(
        JSON.stringify({ full_name: 'usuario/repo', permissions: { push: true } }),
        { status: 200 },
      )
    }))

    const panel = await abrirPanel()
    await userEvent.type(within(panel).getByLabelText('Repositorio'), 'usuario/repo')
    await userEvent.type(within(panel).getByLabelText('Token de acceso'), 'github_pat_x')
    await userEvent.click(within(panel).getByRole('button', { name: 'Probar conexión' }))

    const ok = await within(panel).findByText(/permiso de escritura/i)
    expect(ok).toBeInTheDocument()
    expect(ok.closest('.card')).toBe(panel)
  })

  it('explica el fallo cuando el token no sirve, también dentro del panel', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('seed.json')) return new Response(semilla, { status: 200 })
      return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 })
    }))

    const panel = await abrirPanel()
    await userEvent.type(within(panel).getByLabelText('Repositorio'), 'usuario/repo')
    await userEvent.type(within(panel).getByLabelText('Token de acceso'), 'malo')
    await userEvent.click(within(panel).getByRole('button', { name: 'Probar conexión' }))

    const err = await within(panel).findByText(/no es válido o expiró/i)
    expect(err.closest('.card')).toBe(panel)
  })

  it('avisa si el token no tiene permiso de escritura', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('seed.json')) return new Response(semilla, { status: 200 })
      return new Response(
        JSON.stringify({ full_name: 'usuario/repo', permissions: { push: false } }),
        { status: 200 },
      )
    }))

    const panel = await abrirPanel()
    await userEvent.type(within(panel).getByLabelText('Repositorio'), 'usuario/repo')
    await userEvent.type(within(panel).getByLabelText('Token de acceso'), 'solo-lectura')
    await userEvent.click(within(panel).getByRole('button', { name: 'Probar conexión' }))

    // «Contents: read and write» también sale en el texto de ayuda del panel,
    // así que se busca por la frase del mensaje de error.
    expect(await within(panel).findByText(/no tiene permiso de escritura en/i)).toBeInTheDocument()
  })
})

describe('Guía de datos', () => {



  it('documenta las cinco páginas, los conceptos y las tablas', async () => {
    await montar()
    await irA('Guía')

    for (const t of ['Diccionario de datos', 'Conceptos clave', 'De dónde sale cada dato',
      'Calidad de datos', 'Las páginas']) {
      expect(await screen.findByRole('heading', { level: 2, name: t })).toBeInTheDocument()
    }

    // Las cinco tablas del modelo están documentadas.
    for (const t of ['Sesiones', 'Programas', 'Asistencia', 'Participantes', 'Calendario']) {
      expect(screen.getByRole('table', { name: new RegExp(`tabla ${t}$`, 'i') })).toBeInTheDocument()
    }
  })

  it('explica la regla que más se malinterpreta', async () => {
    await montar()
    await irA('Guía')
    await screen.findByRole('heading', { level: 2, name: 'Diccionario de datos' })

    expect(screen.getByText(/Las celdas son horas de INASISTENCIA/)).toBeInTheDocument()
    expect(screen.getByText('cumplimiento = tabuladas / (tabuladas + pendientes)')).toBeInTheDocument()
    expect(screen.getByText(/Una columna por día, varias sesiones por día/)).toBeInTheDocument()
  })

  it('busca variables por nombre', async () => {
    await montar()
    await irA('Guía')
    await screen.findByRole('heading', { level: 2, name: 'Diccionario de datos' })

    await userEvent.type(screen.getByLabelText('Buscar variable'), 'intensidad')
    await waitFor(() =>
      expect(screen.getByText(/variables coinciden con «intensidad»/)).toBeInTheDocument())
    expect(screen.getAllByText('intensidad_horaria').length).toBeGreaterThan(0)
  })

  it('avisa cuando la búsqueda no encuentra nada', async () => {
    await montar()
    await irA('Guía')
    await screen.findByRole('heading', { level: 2, name: 'Diccionario de datos' })

    await userEvent.type(screen.getByLabelText('Buscar variable'), 'zzzz')
    expect(await screen.findByText(/Ninguna variable coincide con «zzzz»/)).toBeInTheDocument()
  })

  it('refleja el estado real de la base cargada', async () => {
    await montar()
    await irA('Guía')
    const tarjeta = (await screen.findByRole('heading', { name: 'Esta base, ahora mismo' }))
      .closest('.card') as HTMLElement
    expect(within(tarjeta).getByText('130')).toBeInTheDocument()
    expect(within(tarjeta).getByText('74,6%')).toBeInTheDocument()
  })
})

describe('Cursos — validación de la carga', () => {
  /** Listado sin la hoja CONSOLIDADO: el caso de §9. */
  function listadoSinConsolidado(): File {
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([[], [], [], ['', 'NOMBRE DEL CURSO', 'Curso de prueba']]),
      'FORMAS DE PAGO',
    )
    XLSX.utils.book_append_sheet(
      libro, XLSX.utils.aoa_to_sheet([['LISTADO DE ASISTENCIA']]), 'LISTADO DE ASISTENCIA',
    )
    const buf = XLSX.write(libro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    return new File([buf], 'Listado_Prueba.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  }

  function cronogramaReal(): File {
    const dir = path.join(RAIZ, 'Bienestar integral y felicidad', 'Equipo Logístico', 'Listado de Clases')
    const nombre = fs.readdirSync(dir).find((f) => /^cronograma/i.test(f))!
    const buf = fs.readFileSync(path.join(dir, nombre))
    return new File([new Uint8Array(buf)], nombre, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  }

  it.skipIf(!HAY_EXCEL)('explica que falta la hoja CONSOLIDADO y no deja agregar el curso', async () => {
    await montar()
    await irA('Cursos')
    await screen.findByText('Agregar curso')

    const input = document.getElementById('archivos') as HTMLInputElement
    await userEvent.upload(input, [cronogramaReal(), listadoSinConsolidado()])

    const mensaje = await screen.findByText(/Falta la hoja CONSOLIDADO/i, {}, { timeout: 5000 })
    expect(mensaje).toBeInTheDocument()

    // Dice dónde y qué hacer, no sólo que falló.
    expect(screen.getByText(/hojas encontradas/i)).toBeInTheDocument()
    expect(screen.getByText(/plantilla estándar del CEC/i)).toBeInTheDocument()

    // Y el botón de confirmar queda bloqueado.
    expect(screen.getByRole('button', { name: 'Agregar curso' })).toBeDisabled()
  })

  it('rechaza un archivo que no es Excel sin romper la página', async () => {
    await montar()
    await irA('Cursos')
    await screen.findByText('Agregar curso')

    // El input filtra por `accept`, pero al arrastrar puede entrar cualquier
    // cosa: ese es el camino que hay que blindar.
    const zona = screen.getByRole('region', { name: 'Zona de carga de archivos' })
    const archivo = new File(['texto plano'], 'notas.txt', { type: 'text/plain' })
    fireEvent.drop(zona, { dataTransfer: { files: [archivo], types: ['Files'] } })

    expect(await screen.findByText(/no es un Excel/i)).toBeInTheDocument()
    // La app sigue viva: la navegación responde.
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar curso' })).toBeDisabled()
  })

  it.skipIf(!HAY_EXCEL)('importa un curso válido y muestra la vista previa', async () => {
    await montar()
    await irA('Cursos')
    await screen.findByText('Agregar curso')

    const dir = path.join(RAIZ, 'Bienestar integral y felicidad', 'Equipo Logístico', 'Listado de Clases')
    const archivos = fs.readdirSync(dir)
      .filter((f) => /\.xlsx$/i.test(f))
      .map((f) => new File([new Uint8Array(fs.readFileSync(path.join(dir, f)))], f))

    const input = document.getElementById('archivos') as HTMLInputElement
    await userEvent.upload(input, archivos)

    expect(await screen.findByText('válido', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/4 sesiones · 25\/jul → 15\/ago · 9 participantes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar curso' })).toBeEnabled()
  })

  it('lista los 8 cursos cargados', async () => {
    await montar()
    await irA('Cursos')
    const tabla = await screen.findByRole('table', { name: /Cursos cargados/i })
    expect(within(tabla).getAllByRole('row').slice(1)).toHaveLength(8)
    expect(screen.getByText('· 8')).toBeInTheDocument()
  })

  it('muestra el estado de la evidencia fotográfica por programa', async () => {
    await montar()
    await irA('Cursos')
    const tabla = await screen.findByRole('table', { name: /Cursos cargados/i })
    const fila = (programa: string) =>
      within(tabla).getAllByRole('row').find((r) => r.textContent?.includes(programa))!

    // Sólo dos programas tienen fotos cargadas.
    expect(within(fila('Normatividad')).getByText('12 archivos')).toBeInTheDocument()
    expect(within(fila('Cuidado de Heridas')).getByText('3 archivos')).toBeInTheDocument()
    expect(within(fila('Bienestar')).getByText('sin cargar')).toBeInTheDocument()

    // Y el total aparece junto a los demás conteos de la base.
    expect(screen.getByText(/15 evidencias/)).toBeInTheDocument()
  })
})

describe('navegación interna (HashRouter)', () => {
  /**
   * Con HashRouter el hash de la URL es la ruta. Un `<a href="#seccion">`
   * cambia la ruta a «seccion», que no existe, y el usuario acaba en Resumen.
   * Esta prueba impide que vuelva a colarse un ancla interna.
   */
  it('ninguna página usa anclas #seccion, que romperían el enrutado', async () => {
    await montar()
    for (const pagina of ['Resumen', 'Semanal', 'Tabulación', 'Académico', 'Cursos', 'Guía'] as const) {
      await irA(pagina)
      await new Promise((r) => setTimeout(r, 60))
      const anclas = Array.from(document.querySelectorAll('a[href^="#"]'))
        // `#/algo` son rutas legítimas del HashRouter. Lo peligroso es
        // `#seccion`, que el router leería como una ruta inexistente.
        .filter((a) => !a.getAttribute('href')?.startsWith('#/'))
        // El enlace de salto conserva el href por convención, pero intercepta
        // el clic: se comprueba aparte, más abajo.
        .filter((a) => !a.classList.contains('skip-link'))
      expect(
        anclas.map((a) => a.getAttribute('href')),
        `${pagina} tiene anclas internas que llevarían a la ruta comodín`,
      ).toEqual([])
    }
  })

  it('el índice de la guía desplaza sin cambiar de página', async () => {
    await montar()
    await irA('Guía')
    await screen.findByRole('heading', { level: 2, name: 'Conceptos clave' })

    const indice = screen.getByRole('navigation', { name: 'Secciones de la guía' })
    await userEvent.click(within(indice).getByRole('button', { name: 'Conceptos clave' }))

    // Sigue en la guía: la ruta no cambió y el contenido tampoco.
    expect(window.location.hash).toBe('#/guia')
    expect(screen.getByRole('heading', { level: 2, name: 'Diccionario de datos' })).toBeInTheDocument()
    // Y el foco viajó a la sección, no se quedó en el botón.
    expect(document.activeElement?.id).toBe('conceptos')
  })

  it('el enlace de salto lleva al contenido sin salir de la página', async () => {
    await montar()
    await irA('Tabulación')
    await screen.findByText('Pendientes por programa')

    await userEvent.click(screen.getByText('Saltar al contenido'))

    expect(window.location.hash).toBe('#/tabulacion')
    expect(document.activeElement?.id).toBe('principal')
  })
})

describe('responsive', () => {

  /**
   * jsdom no calcula layout, así que no puede medir desbordes. Pero sí puede
   * verificar la causa estructural más común: una tabla ancha suelta en el
   * flujo de la página, sin un contenedor que haga scroll por su cuenta. Eso
   * es lo que obliga a la página entera a desplazarse en horizontal.
   */
  it('toda tabla vive dentro de un contenedor con scroll propio', async () => {
    await montar()
    for (const pagina of ['Resumen', 'Semanal', 'Tabulación', 'Académico', 'Guía'] as const) {
      await irA(pagina)
      await new Promise((r) => setTimeout(r, 60))
      const tablas = document.querySelectorAll('main table')
      expect(tablas.length, `${pagina} no renderizó tablas`).toBeGreaterThan(0)
      for (const t of tablas) {
        // Las tablas puramente textuales para lectores de pantalla no cuentan.
        if (t.classList.contains('sr-only')) continue
        expect(
          t.closest('.scroll-x'),
          `${pagina}: hay una tabla fuera de un contenedor .scroll-x`,
        ).not.toBeNull()
      }
    }
  })

  it('la navegación deja bajar el menú a una segunda fila', async () => {
    await montar()
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    // El menú ocupa el ancho completo en móvil; su contenedor debe permitir
    // el salto de línea, o los tres bloques se aplastan en la misma fila.
    expect(nav.className).toMatch(/w-full/)
    expect(nav.parentElement?.className).toMatch(/flex-wrap/)
    // Y se desplaza en horizontal en vez de recortarse.
    expect(nav.className).toMatch(/scroll-x/)
  })

  it('ningún control del encabezado tiene ancho fijo que desborde', async () => {
    await montar()
    await irA('Semanal')
    await screen.findByText('Carga por día')
    for (const nombre of ['Elegir semana', 'Filtrar por programa']) {
      const boton = screen.getByRole('button', { name: nombre })
      expect(boton.style.maxWidth, `${nombre} puede desbordar su contenedor`).toBe('100%')
    }
  })
})

describe('accesibilidad y navegación', () => {

  it('navega entre las seis páginas', async () => {
    await montar()
    for (const [pagina, marca] of [
      ['Semanal', 'Carga por día'],
      ['Tabulación', 'Pendientes por programa'],
      ['Académico', 'Inasistencia por participante'],
      ['Cursos', 'Agregar curso'],
      ['Guía', 'Conceptos clave'],
      ['Resumen', 'Estado por programa'],
    ] as const) {
      await irA(pagina)
      expect(await screen.findAllByText(marca)).not.toHaveLength(0)
    }
  })

  it('cada página tiene un único encabezado de nivel 1', async () => {
    await montar()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('ofrece el salto al contenido y el cambio de tema', async () => {
    await montar()
    expect(screen.getByText('Saltar al contenido')).toHaveAttribute('href', '#principal')

    const boton = screen.getByRole('button', { name: /tema oscuro/i })
    await userEvent.click(boton)
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
    expect(screen.getByRole('button', { name: /tema claro/i })).toBeInTheDocument()
  })
})
