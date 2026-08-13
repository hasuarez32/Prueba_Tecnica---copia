# Especificación — App web operacional CEC (solución 2)
### Brief de contexto y requerimientos para Claude Code

> Documento de handoff. Léelo completo antes de escribir código. El objetivo es
> construir una **aplicación web estática, hosteable en GitHub Pages**, que resuelva
> el mismo problema logístico del CEC de Uninorte que ya se resolvió en Power BI,
> pero con mejor diseño, accesible desde cualquier dispositivo y con un valor
> agregado: **cargar cursos subiendo sus Excel, normalizarlos, validarlos y
> guardarlos**, todo del lado del cliente.

---

## 1. Contexto

El Centro de Educación Continuada (CEC) ejecuta en paralelo múltiples programas
(cursos y diplomados). La información logística de cada uno (cronogramas y listados
de asistencia) vive dispersa en carpetas y Excel por programa. Ya existe una primera
solución en **Power BI** (tablero de seguimiento con fecha de corte configurable,
vistas de resumen, semanal, control de tabulación y detalle académico).

Esta es la **segunda solución**: una **página web** que hace lo mismo pero con
libertad total de diseño, accesible desde cualquier dispositivo sin licencias, y
con la capacidad de **agregar/actualizar cursos subiendo archivos**. Power BI se usó
porque es el estándar de la universidad, pero no era obligatorio; esta versión busca
un producto más intuitivo y mejor terminado.

---

## 2. Insumos disponibles (en esta misma carpeta / repo)

- **`mockups_web/*.html`** — cinco mockups estáticos que definen el **diseño y la UX
  objetivo**: `1_resumen`, `2_semanal`, `3_tabulacion`, `4_academico`, `5_cursos`.
  La app final debe verse y comportarse como estos mockups (son la fuente de verdad
  del look & feel). Ábrelos y replícalos.
- **`ESPECIFICACION_BASE_CONSOLIDADA.md`** — la lógica completa de normalización y
  el esquema de datos. **Hay que portar esa lógica de Python a TypeScript.** Contiene
  cómo parsear cronogramas y la hoja CONSOLIDADO, reconstruir fechas (serial de Excel
  y encabezados `DD T`/`DD M`), detectar tabulación, y las reglas de estado.
- **`base_consolidada.xlsx`** — salida de referencia; el modelo de datos que la app
  debe reproducir en memoria (hojas `fct_sesiones`, `dim_programas`, `dim_calendario`,
  `fct_asistencia`, `dim_participantes`).
- **Las 8 carpetas de programa** (con `Equipo Logístico/Listado de Clases/` y sus
  Excel reales) — úsalas como datos de prueba para validar el parser.

---

## 3. Sistema de diseño (tomado de la referencia "Onjobby")

Respetar exactamente estos tokens:

**Colores**
```
--navy:#0E1B3A  --navy-2:#16244A  --ink:#0B1330
--pink:#FF3D8B  --pink-soft:#FFD6E5
--cyan:#3FCFCF  --cyan-soft:#CDEFEF  --mint:#E6F4F4
--cream:#F7F4EC (fondo)  --muted:#5C6A8A
--line: rgba(14,27,58,.10)  --line-2: rgba(14,27,58,.18)
```
Estados: **tabuladas = cyan**, **pendientes = pink**, **futuras = gris `#C7CEDD`**.

**Tipografías** (Google Fonts): `Bricolage Grotesque` (títulos/displays, 600–700,
letter-spacing −.02em), `Geist` (texto), `Geist Mono` (etiquetas "eyebrow" en
mayúsculas con tracking), `Instrument Serif` italic (acentos en títulos).

**Acabados**: fondo crema, tarjetas blancas con borde fino (1px `--line`) y esquinas
redondeadas (18–22px), botones y navegación en **píldora** (border-radius 999px),
nada de sombras pesadas, toques de color en cyan/pink, dona/barras planas.

**Reglas**: sentence case, responsive mobile-first, accesible (contraste AA, foco de
teclado, ARIA), y **tema claro/oscuro** (el mockup es claro; agregar dark mode
coherente).

---

## 4. Arquitectura y stack

- **Sitio estático** desplegable en **GitHub Pages** vía GitHub Actions.
- **Vite + React + TypeScript + Tailwind** (los tokens de §3 como variables CSS /
  config de Tailwind). Routing con `react-router` (hash o base path para Pages).
- **Parseo de Excel en el navegador** con **SheetJS (xlsx)**.
- **Gráficos**: ECharts o Recharts (barras, dona, heatmap del calendario).
- **Fechas**: Day.js.
- Todo el "ETL" corre **client-side**: no hay backend.

---

## 5. Modelo de datos (en memoria, mismo que la base)

Reproducir el esquema estrella de `ESPECIFICACION_BASE_CONSOLIDADA.md` §8 como tipos
TypeScript: `Sesion` (grano sesión), `Programa`, `DiaCalendario`, `Asistencia`
(participante×sesión), `Participante`. Los estados dependientes del tiempo se
calculan contra una **fecha de corte configurable** (parámetro global de la app, con
selector de fecha; por defecto hoy).

Reglas clave (ver el .md para el detalle):
- estado_sesion: Realizada / Hoy / Futura vs corte.
- tabulación: columna del CONSOLIDADO con datos → Tabulada; vacía y pasada →
  Pendiente; vacía y futura → No exigible.
- cumplimiento = tabuladas / realizadas.
- riesgo académico: inasistencia acumulada (dedup por día, no sumar por sesión) >
  tope permitido del programa.

---

## 6. Ingesta, validación y persistencia (el valor agregado)

**Carga** (página Cursos): arrastrar los dos Excel de un curso (cronograma + listado).
El parser detecta hoja y columnas por nombre (igual que el script), reconstruye
fechas y detecta tabulación.

**Validación — nunca fallar en silencio.** Si el formato es conocido, importa y
muestra vista previa (nº de sesiones, rango de fechas, participantes). Si algo falta
o difiere, mostrar un **reporte claro** indicando **qué, dónde y por qué**, con
sugerencia. Ejemplos: "falta la hoja CONSOLIDADO", "no encuentro la columna Fecha en
el cronograma", "encabezado `31 X` con jornada no reconocida (usa T o M)", "fecha no
interpretable en la sesión 4". Distinguir **errores** (bloquean) de **avisos** (se
importa igual, como el typo de año 2025 o las horas invertidas).

**Persistencia**
- **Local por dispositivo**: guardar la base consolidada en **IndexedDB**; al volver,
  cargarla sin re-subir.
- **Compartida (opcional, "GitHub-native")**: al confirmar, permitir hacer **commit
  del JSON consolidado al repositorio vía la API de GitHub** (lectura pública,
  escritura con token que el usuario configura). Así se actualiza para todos.
- **Export/Import** de la base como JSON (y opción de exportar a Excel).
- La UI es **reactiva**: al validar/guardar, todas las vistas se recalculan al instante.

---

## 7. Páginas (replicar los mockups)

1. **Resumen** (`1_resumen.html`) — filtros (fecha de corte, programa, semana),
   tarjetas KPI (en ejecución, cumplimiento, pendientes, en riesgo), barras de estado
   por programa (cyan/pink/gris) y dona de cumplimiento.
2. **Semanal** (`2_semanal.html`) — matriz calendario por día con mapa de calor +
   tabla de clases de la semana con píldoras de estado.
3. **Control de tabulación** (`3_tabulacion.html`) — KPIs, barra de pendientes por
   programa y lista de acción ordenada por días de atraso.
4. **Detalle académico** (`4_academico.html`) — tarjetas + tabla de inasistencia por
   participante, resaltando a los que superan su tope.
5. **Cursos** (`5_cursos.html`) — carga con drag & drop, reporte de validación y lista
   de cursos cargados.

Barra de navegación en píldora, común a todas, con la fecha de corte accesible de
forma global.

---

## 8. Entregables

1. Repositorio con la app (estructura Vite + React + TS + Tailwind).
2. Workflow de **GitHub Actions** que construye y publica en **GitHub Pages**.
3. La lógica de normalización en un módulo aislado (`/src/lib/etl`) con **pruebas
   unitarias** que corran contra las 8 carpetas de ejemplo.
4. README con: cómo correr localmente, cómo desplegar, cómo configurar el token de
   GitHub para la persistencia compartida, y el formato esperado de los Excel.

---

## 9. Verificación (antes de darlo por terminado)

- Cargar las 8 carpetas de ejemplo y confirmar que, con **fecha de corte 11/08/2026**,
  los totales coinciden con `base_consolidada.xlsx`: **130 sesiones, 44 tabuladas, 15
  pendientes, 71 futuras, cumplimiento 74,6%, 6 programas en ejecución, 108
  participantes, 3 en riesgo**.
- Verificar Heridas: 31/07 y 08/08 salen **pendientes**; Bienestar: 3 tabuladas y 15/08
  futura.
- Subir un archivo **inválido** (p. ej. sin hoja CONSOLIDADO) y confirmar que la app
  muestra el error concreto y no rompe.
- Probar responsive (móvil), navegación entre las 5 páginas, y que mover la fecha de
  corte recalcula todo.
- Confirmar build y publicación correcta en GitHub Pages.
