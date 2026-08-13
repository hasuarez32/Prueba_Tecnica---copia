# CEC · Operación — panel logístico del Centro de Educación Continuada

App web estática para el seguimiento logístico de los programas del CEC de la
Universidad del Norte. Es la **segunda solución** del proyecto: hace lo mismo
que el tablero de Power BI, pero se abre desde cualquier dispositivo sin
licencias y agrega lo que el tablero no puede hacer — **cargar cursos subiendo
sus Excel, normalizarlos y validarlos en el navegador**.

Todo el ETL corre del lado del cliente. No hay backend: los archivos nunca salen
del equipo de quien los sube.

---

## Qué resuelve

Para cualquier fecha de corte, responde las preguntas del equipo logístico:

| Pregunta | Dónde |
|---|---|
| ¿Qué programas están en ejecución, cuáles ya cerraron y cuáles no han empezado? | **Resumen** |
| ¿Qué programas están activos esta semana y cuáles tienen clase? | **Semanal** |
| ¿Cuántas sesiones hay que atender cada día? | **Semanal** |
| ¿Qué sesiones ya se dictaron y siguen sin tabular? | **Control de tabulación** |
| ¿Quién está por perder el derecho al certificado? | **Detalle académico** |
| ¿Cómo agrego o actualizo un curso? | **Cursos** |
| ¿Qué programas ya subieron su evidencia fotográfica? | **Cursos** |
| ¿Qué significa exactamente este dato? | **Guía** |

La **fecha de corte** es un control global en la barra superior. Al moverla se
recalculan todas las páginas al instante, sin volver a leer un solo Excel.

---

## Correr en local

Requiere Node 20 o superior.

```bash
cd cec-app
npm install
npm run dev          # http://localhost:5173
```

Otros comandos:

```bash
npm run build        # compila a dist/ (typecheck + bundle)
npm run preview      # sirve dist/ para revisar el build
npm test             # 92 pruebas: ETL contra los Excel reales + interfaz
npm run seed         # regenera public/data/seed.json desde las 8 carpetas
npm run typecheck    # sólo TypeScript
```

### Datos de ejemplo

El sitio se publica con `public/data/seed.json`: las 8 carpetas de programa ya
normalizadas. Sirve para que la app muestre algo útil desde el primer segundo.

`npm run seed` lo regenera leyendo las carpetas de programa que están **un nivel
arriba** de `cec-app/`, usando exactamente el mismo ETL que corre en el
navegador.

La búsqueda es **en profundidad**: encuentra los programas tanto en la
estructura plana (`<programa>/Equipo Logístico/Listado de Clases/`) como en la
del CEC organizada por mes (`JULIO 2026/<programa>/Equipo Logístico/…`), sin
asumir un número fijo de niveles. El programa es siempre la carpeta que contiene
a `Equipo Logístico`, nunca el mes.

Para publicar, usa `npm run seed -- --anonimizar`: conserva todos los
indicadores y sustituye nombres y documentos por identidades sintéticas.

Cuando cargas tus propios cursos, la base local (IndexedDB) tiene prioridad
sobre la semilla. El botón **Restaurar ejemplo** en Cursos vuelve a la semilla.

---

## Desplegar en GitHub Pages

El workflow ya está en `.github/workflows/deploy.yml`, **en la raíz del
proyecto** (un nivel arriba de `cec-app/`), que es el único sitio donde GitHub
Actions los lee. Construye y publica en cada empuje a `main` que toque
`cec-app/`.

Eso asume que el repositorio se crea sobre la carpeta completa del proyecto —
la que contiene `cec-app/` y las 8 carpetas de programa. Es lo que hace falta
para que las pruebas del ETL encuentren los Excel de ejemplo en CI.

1. Inicializa el repositorio en la raíz del proyecto y empújalo:

   ```bash
   git init && git add . && git commit -m "Panel operativo del CEC"
   git branch -M main
   git remote add origin https://github.com/<usuario>/<repositorio>.git
   git push -u origin main
   ```

2. En el repositorio: **Settings → Pages → Source: GitHub Actions**.

3. El sitio queda en `https://<usuario>.github.io/<repositorio>/`.

> Si prefieres que `cec-app/` sea la raíz del repositorio, mueve el workflow
> dentro y quita los `working-directory: cec-app` y el prefijo `cec-app/` de sus
> rutas. En ese caso las pruebas del ETL no encontrarán las carpetas de ejemplo:
> quita el paso «Pruebas del ETL» o deja sólo el build.

No hace falta configurar `base`: el build usa rutas relativas (`base: './'`) y
el enrutado es por hash (`#/semanal`), así que funciona igual en la raíz de un
dominio, bajo `/repositorio/` o abierto desde el disco. Tampoco hacen falta
reglas de reescritura para las rutas profundas.

---

## Persistencia

Tres niveles, de menos a más compartido:

**1. Local (automático).** Al agregar un curso, la base se guarda en IndexedDB
de ese navegador. Al volver, se carga sola. Si IndexedDB no está disponible
(modo privado de algunos navegadores), cae a `localStorage`.

**2. Export / import JSON.** Botones *Exportar JSON* e *Importar JSON* en la
página Cursos. También se puede exportar a Excel con el mismo esquema estrella
de `base_consolidada.xlsx` (`fct_sesiones`, `dim_programas`, `dim_calendario`,
`fct_asistencia`, `dim_participantes`, `Parametros`).

**3. Compartida vía GitHub (opcional).** *Cursos → Publicar para el equipo*
hace un commit del JSON consolidado al repositorio con la API de GitHub. El
despliegue lo recoge y todo el equipo ve los mismos datos.

Se publica **la base completa**, no sólo lo último añadido. Por eso, para borrar
un curso para todo el equipo basta con quitarlo de *Cursos cargados* y volver a
publicar: el archivo se reemplaza entero.

> **Cuidado con los datos personales.** Si el repositorio es público, publicar
> ahí la base con los cursos reales expone nombres y cédulas a todo internet, de
> forma permanente en el historial de git. Con repositorio público, usa esta vía
> sólo para datos anonimizados. Para compartir los datos reales dentro del
> equipo: *Exportar JSON*, enviarlo por el canal interno (Drive, Teams) y que
> cada persona use *Importar JSON*. Así los datos nunca salen a la web.

Las pruebas de interfaz usan un fixture propio (`src/test/fixtures/`), no el
`seed.json` publicado: así publicar datos distintos no rompe el CI ni bloquea
el despliegue.

### Configurar el token de GitHub

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained
   tokens → Generate new token**.
2. **Repository access:** sólo el repositorio del panel.
3. **Permissions → Repository permissions → Contents: Read and write.** Es el
   único permiso necesario.
4. Copia el token (`github_pat_…`) y pégalo en *Cursos → Publicar para el equipo*,
   junto con el repositorio (`usuario/repositorio`), la rama y la ruta del JSON.
5. **Probar conexión** valida el token y el permiso de escritura antes de
   arriesgar un commit.

Sobre el token: vive sólo en tu navegador. Sin marcar «recordar», se guarda en
`sessionStorage` y desaparece al cerrar la pestaña; marcándolo pasa a
`localStorage`. Nunca se envía a otro destino que `api.github.com`, y el botón
**Olvidar token** lo borra. Como cualquier secreto en una app estática, quien
tenga acceso físico al navegador puede leerlo: usa un token de alcance mínimo y
revócalo cuando termines.

---

## Formato esperado de los Excel

Cada curso son **dos archivos** en `Equipo Logístico/Listado de Clases/`.

### 1. Cronograma — define las sesiones

`Cronograma_*.xlsx`. El nombre de la hoja es variable (`owssvr`, `owssvr (1)`,
`owssvr - 2026-08-11T…`), así que **se detecta por sus encabezados**, no por el
nombre: la hoja buena es la que tiene `Sesión` y `Fecha` en la fila 1.

| Encabezado | Uso | ¿Obligatorio? |
|---|---|---|
| `Sesión` | número de sesión | Sí |
| `Fecha` | fecha de la sesión | Sí |
| `Hora Inicio` / `Hora Fin` | horario y jornada | Sí |
| `Intensidad horaria por sesión` | horas de la sesión | Sí |
| `Nombre del módulo` | módulo | No |
| `Salón` | de aquí sale la modalidad | No |
| `Nombre del docente` | docente | No |

Las columnas se mapean **por nombre de encabezado**, no por posición: pueden
venir en cualquier orden y sobrar columnas (`Refrigerio`, `Teléfono`, `Correo`…).

### 2. Listado de participantes — asistencia y metadatos

`*ListadodeParticipantes*.xlsx` (cualquier `.xlsx` que no empiece por
`Cronograma`). Necesita dos hojas:

**`FORMAS DE PAGO`** — metadatos. Cada dato se busca por el **texto de su
etiqueta**, tomando el valor a la derecha: `NOMBRE DEL CURSO`, `NRC:`,
`COD BANNER:`, `CODIGO CONTABLE:`, `COORDINADOR:`, `EXPERTO FACILITADOR:`,
`ENTIDAD CONVENIO:`, `MODALIDAD:`, `VALOR DEL PROGRAMA:`,
`NÚMERO DE PARTICIANTES` (sic).

**`Evidencia Fotográfica`** — carpeta hermana de `Listado de Clases`, opcional.
Sus imágenes (`.jpg`, `.png`, `.heic`…) se cuentan como evidencia del programa.
Es el tercer proceso que controla el equipo logístico, junto al cronograma y los
listados. Se cuenta por programa y no por sesión porque los nombres de archivo
no dicen a qué clase pertenece cada foto. Al arrastrar la carpeta completa a la
página Cursos, las imágenes se cuentan solas en vez de dar error.

**`CONSOLIDADO`** — la asistencia real. Estructura:

- Cabecera con `NÚMERO DE HORAS` y `NÚMERO DE HORAS DE FALLAS MÁXIMAS PERMITIDAS`.
- Una fila `Mes:` que agrupa las columnas por mes. Las celdas suelen estar
  combinadas: el mes se **propaga** hacia la derecha.
- Una fila de encabezados: `NOMBRE`, `DOCUMENTO DE IDENTIDAD`, `EMPRESA`,
  `CORREO`, **una columna por sesión**, `Σ de inasistencia`, `OBSERVACIONES:`.
- Una fila por participante.

Los encabezados de sesión aceptan dos formatos:

| Formato | Ejemplo | Cómo se interpreta |
|---|---|---|
| Fecha completa | `2026-07-25` | Directo |
| Día + jornada | `24 T`, `8 M` | Día del mes + `T`=tarde / `M`=mañana, combinados con el mes propagado y el año del cronograma |

> **El valor de cada celda son HORAS DE INASISTENCIA**, no de asistencia.
> `0` = asistió completo · `> 0` = horas que faltó · **vacía = sin tabular**.

Esa distinción es la que sostiene todo el panel: una columna vacía de una clase
que ya se dictó es una deuda administrativa; la misma columna vacía de una clase
futura no es nada.

### Sumar horas de inasistencia

`fct_asistencia` tiene grano participante × **sesión**, pero el `CONSOLIDADO`
tiene una columna por **día**. Cuando varias sesiones comparten columna —Heridas
tiene cuatro el 24/07— la misma inasistencia aparece repetida en cada una, y
sumar la columna directamente infla el total un 133 %.

Por eso cada fila trae `cuenta_en_total`, verdadera sólo en la primera de cada
participante × columna. La medida correcta en Power BI es:

```dax
Horas perdidas = CALCULATE(SUM(fct_asistencia[horas_inasistencia]),
                           fct_asistencia[cuenta_en_total] = TRUE)
```

Para el total por participante también sirve `dim_participantes[total_inasistencia]`,
que ya viene deduplicado.

### Estados de una sesión

| Estado | Cuándo |
|---|---|
| **Tabulada** | Su columna tiene al menos un valor (los ceros cuentan) |
| **Pendiente de tabular** | Columna vacía y la clase ya se dictó (`fecha ≤ corte`) |
| **Futura no exigible** | Columna vacía y la clase aún no ocurre (`fecha > corte`) |

`cumplimiento = tabuladas / (tabuladas + pendientes)`. **Una sesión futura nunca
cuenta como incumplimiento.**

### Un detalle que no es obvio

El `CONSOLIDADO` trae **una columna por día** (o por día y jornada), mientras el
cronograma puede tener **varias sesiones ese mismo día**. Heridas, por ejemplo,
tiene 4 sesiones el 24/07 y una sola columna `24 T`.

Por eso varias sesiones comparten columna, y por eso las horas de inasistencia
se cuentan **una sola vez por columna** al calcular el riesgo académico: sumarlas
por sesión multiplicaría las faltas de ese participante por cuatro.

---

## Validación: nunca falla en silencio

Al soltar los archivos, la app dice **qué, dónde y por qué**, separando lo que
bloquea de lo que no:

Los archivos se **acumulan**: se puede subir el cronograma, y el listado en otro
momento. Una lista de requisitos muestra qué falta y qué ya está puesto, y cada
archivo se puede quitar. Subir uno con el mismo nombre lo reemplaza.

- **Errores** (bloquean la importación): los dos Excel son de cursos distintos,
  falta la hoja `CONSOLIDADO`, no
  aparece la columna `Fecha` del cronograma, una fecha no se puede interpretar,
  el archivo no es un Excel o está dañado.
- **Avisos** (se importa igual): typo de año en los metadatos, horas invertidas
  o en `00:00`, sesiones fuera de orden, encabezado con jornada no reconocida,
  columnas del `CONSOLIDADO` sin sesión, participantes declarados que no cuadran
  con los reales.

Cada hallazgo indica el archivo, la hoja y la fila o columna, y trae una
sugerencia de qué hacer. Las incidencias de los cursos ya guardados quedan
consultables en *Cursos → Calidad de los datos*.

---

## Estructura

```
cec-app/
├─ src/
│  ├─ lib/etl/            ← la lógica portada de construir_base.py
│  │  ├─ types.ts             modelo de datos (§8 de la especificación)
│  │  ├─ normalize.ts         fechas, horas, números, documentos, modalidad
│  │  ├─ sheet.ts             utilidades sobre libros de SheetJS
│  │  ├─ cronograma.ts        fuente A: detección de hoja y mapeo de columnas
│  │  ├─ consolidado.ts       fuente B: FORMAS DE PAGO y CONSOLIDADO
│  │  ├─ build.ts             ensamblado y emparejamiento sesión ↔ columna
│  │  ├─ derive.ts            todo lo que depende de la fecha de corte
│  │  └─ etl.test.ts          28 pruebas contra las 8 carpetas reales
│  ├─ pages/              ← las seis páginas
│  ├─ lib/diccionario.ts  ← contenido de la Guía: cada variable explicada
│  ├─ components/         ← navegación, tarjetas, KPIs, gráfico, selector buscable
│  ├─ store/AppStore.tsx  ← base + fecha de corte + tema
│  ├─ lib/db.ts           ← IndexedDB
│  ├─ lib/github.ts       ← commit del JSON vía API
│  ├─ lib/exporters.ts    ← JSON, Excel y CSV
│  └─ test/
│     ├─ app.test.tsx     ← 40 pruebas de interfaz
│     └─ fixtures/        ← seed de ejemplo fijo, independiente del publicado
├─ scripts/
│  ├─ seed.ts             ← genera public/data/seed.json
│  ├─ descubrir.ts        ← busca las carpetas de programa en profundidad
│  └─ anonimizar.ts       ← identidades sintéticas para publicar
└─ public/data/seed.json  ← datos de ejemplo publicados
```

La separación importante es **parseo** vs. **derivación**: `build.ts` produce
sólo hechos del Excel (incluido «esta columna tiene datos»), y `derive.ts`
aplica la fecha de corte encima. Por eso mover el corte es instantáneo y no
puede corromper lo importado.

---

## La página Guía

Documenta el modelo completo: qué significa cada una de las 60 variables, de qué
hoja y columna del Excel sale, y qué decisiones se tomaron cuando los archivos no
venían perfectos. Tiene buscador — escribe «tope», «jornada» o «intensidad» y
filtra las tablas al vuelo.

Está pensada para la pregunta que siempre aparece cuando alguien hereda un
tablero: *¿y este número de dónde salió?*. Cubre cinco bloques: qué responde cada
página, los siete conceptos que gobiernan todos los cálculos, el diccionario de
datos tabla por tabla, el mapeo contra los Excel de origen y el criterio de
calidad de datos.

El contenido vive en `src/lib/diccionario.ts` como datos, no como JSX: añadir un
campo al modelo es añadir una línea ahí.

---

## Accesibilidad y diseño

- Tokens de color, tipografías (Bricolage Grotesque, Geist, Geist Mono,
  Instrument Serif) y acabados tomados de los mockups: fondo crema, tarjetas
  blancas de esquinas redondeadas, navegación en píldora, gráficos planos.
- **Tema claro y oscuro**, con los mismos tokens reasignados. Respeta la
  preferencia del sistema en la primera visita y recuerda la elección.
- Responsive mobile-first: en móvil la navegación se desplaza en una sola fila
  y las tablas anchas tienen scroll propio, con la columna de programa fija.
- Los selectores de semana y programa son comboboxes con búsqueda (patrón
  WAI-ARIA): se escribe para filtrar y se navega con flechas, Inicio, Fin,
  Enter y Escape. Un `<select>` nativo deja de servir con 22 semanas.
- El mapa de calor usa una rampa distinta en cada tema: el cyan de marca sobre
  fondo oscuro dejaba el número en 1,2:1. Hay pruebas que fijan el contraste de
  toda la rampa en AA (4,5:1) para los dos temas.
- Foco de teclado visible, salto al contenido, tablas con `<caption>` y
  encabezados asociados, gráfico con alternativa textual para lectores de
  pantalla, y `role="status"` en los cambios que importan.
- Sentence case en toda la interfaz.

---

## Verificación

`npm test` corre 92 pruebas. Las del ETL leen **los Excel reales** de las 8
carpetas y comparan contra `base_consolidada.xlsx`; las de interfaz montan la
app y leen los números **de la pantalla**.

Con fecha de corte **11/08/2026**:

| Métrica | Esperado |
|---|---|
| Sesiones | 130 |
| Tabuladas | 44 |
| Pendientes | 15 |
| Futuras | 71 |
| Cumplimiento | 74,6 % |
| Programas en ejecución | 6 de 8 |
| Participantes | 108 |
| En riesgo | 3 |
| Asistencia | 90,6 % |

Casos concretos cubiertos: Heridas 31/07 (4 sesiones) y 08/08 salen
**pendientes**; Bienestar tiene 3 tabuladas y el 15/08 **futura**; mover el
corte a 31/12/2026 deja 86 pendientes y 33,8 % de cumplimiento sin alterar las
44 tabuladas; un listado sin hoja `CONSOLIDADO` muestra el error concreto y deja
el botón de agregar deshabilitado.
