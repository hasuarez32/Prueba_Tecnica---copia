# Especificación técnica — Base consolidada logística CEC (Uninorte)
### Brief de contexto y requerimientos para construir el script

> Documento de handoff. Léelo completo antes de escribir código. El objetivo es
> producir **un script en Python** que transforme las carpetas dispersas de los
> programas del CEC en **una única base consolidada** (`base_consolidada.xlsx`),
> limpia y lista para alimentar un dashboard en Power BI y un HTML interactivo.

---

## 1. Contexto del proyecto

El **Centro de Educación Continuada (CEC)** de la Universidad del Norte ejecuta
múltiples programas (cursos y diplomados) en paralelo. El equipo logístico
controla, por cada programa: el cronograma de clases, los listados de asistencia
y las evidencias. Hoy esa información está **dispersa** en una carpeta por
programa, cada una con Excels de formato heterogéneo.

**Meta del proyecto:** pasar de esa revisión carpeta-por-carpeta a una **visión
consolidada** que permita, para cualquier semana:
- Qué programas están **en ejecución**.
- Cuáles tienen **clase esa semana**, qué días y cuántas sesiones.
- El **estado de tabulación de asistencias**: qué sesiones ya se dieron y aún no
  tienen la asistencia cargada.

Este script produce la **capa de datos**. El dashboard (Power BI + HTML) se
construye después, encima de la base que este script genera.

---

## 2. Insumo: estructura de la carpeta

Carpeta raíz de entrada: **`Prueba_Tecnica - copia/`**

Contiene **8 carpetas de programa** + un Word con el enunciado (ignorar el Word).
Cada carpeta de programa sigue esta estructura:

```
<Programa>/
  Equipo Logístico/
    Listado de Clases/
      Cronograma_*.xlsx              <- fuente de SESIONES
      *ListadodeParticipantes*.xlsx  <- fuente de ASISTENCIA y METADATOS
    Evidencia Fotográfica/           <- (opcional) .jpg/.jpeg/.heic — IGNORAR
```

Los 8 programas (nombre exacto de carpeta):

| # | Carpeta | programa_id sugerido |
|---|---|---|
| 1 | `Bienestar integral y felicidad` | BIENESTAR |
| 2 | `Bootcamp analitica predictiva con python` | BOOTCAMP |
| 3 | `Dip Cuidado De Heridas` | HERIDAS |
| 4 | `Dip ECOGRAFIA CLINICA` | ECOGRAFIA |
| 5 | `Dip odontologia estatica adhesiva` | ODONTOLOGIA |
| 6 | `Diplomado normatividad - instalaciones electricas` | NORMATIVIDAD |
| 7 | `Gerencia de proyectos- project` | PROJECT |
| 8 | `Grupo Integracion Sensorial` | SENSORIAL |

> El script debe **recorrer dinámicamente** las carpetas, no asumir esta lista
> fija. Detecta cada programa como una subcarpeta que contenga
> `Equipo Logístico/Listado de Clases/`.

---

## 3. Fuente A — Cronograma (define las sesiones)

Archivo: `Equipo Logístico/Listado de Clases/Cronograma_*.xlsx`

- La hoja relevante tiene un nombre variable (`owssvr`, `owssvr (1)`,
  `owssvr - 2026-08-11T...`). **No busques por nombre de hoja**: recorre las hojas
  y usa aquella cuya **primera fila de encabezados** contenga `Sesión` y `Fecha`.
- Fila 0 = encabezados. Cada fila siguiente = una sesión.

**Columnas (varían entre programas — mapear por nombre de encabezado, no por
posición):**

| Encabezado (puede variar) | Uso | ¿Obligatorio? |
|---|---|---|
| `Sesión` | num_sesion | Sí |
| `Fecha` | fecha de la sesión | Sí |
| `Hora Inicio` | hora_inicio | Sí |
| `Hora Fin` | hora_fin | Sí |
| `Intensidad horaria por sesión` | intensidad_horaria | Sí |
| `Nombre del módulo` | modulo | No (algunos no lo traen) |
| `Salón` | salon / modalidad de sesión | No |
| `Nombre del docente` | docente | No |
| `Refrigerio`, `Teléfono`, `Correo`, `Ruta de acceso`, etc. | ignorar | — |

Notas de calidad de datos (ya detectadas, manejar explícitamente):
- `Fecha`, `Hora Inicio`, `Hora Fin` pueden venir como datetime o como texto.
  Normalizar todo a fecha/hora reales.
- Hay **horas invertidas o en cero** (ej. Project sesión 10 con hora_fin < hora_inicio;
  Normatividad una sesión con hora_fin `00:00`). No abortar: registrar el problema
  en `observaciones` y conservar la fila.
- Odontología trae **sesiones fuera de orden** (num_sesion no correlativo con la
  fecha). Ordenar por fecha, no por número.
- La columna `Salón` a veces contiene la **modalidad** (`PRESENCIAL`, `VIRTUAL`,
  `REMOTO`, `PRESENCIAL-VIRTUAL`, `Trabajo Independiente`, `PRESENCIAL-HOSPITAL...`).
  Derivar `modalidad` normalizada a partir de ahí (ver §7).

---

## 4. Fuente B — Listado de Participantes (asistencia + metadatos)

Archivo: `Equipo Logístico/Listado de Clases/*ListadodeParticipantes*.xlsx`
(el nombre varía; tómalo como el `.xlsx` de la misma carpeta que **no** empieza
por `Cronograma`).

Hojas presentes: `FORMAS DE PAGO`, `LISTADO DE ASISTENCIA`, `CONSOLIDADO`,
`CERTIFICADO`, `FICHA DE TRAMITE`.

### 4.1 Hoja `FORMAS DE PAGO` → metadatos del programa
Localiza cada dato buscando el **texto de la etiqueta** y tomando la celda de
valor a su derecha (la maquetación puede variar). Etiquetas a extraer:
- `EXPERTO FACILITADOR:` → experto_facilitador
- `NOMBRE DEL CURSO` → nombre_oficial
- `ENTIDAD CONVENIO:` → entidad_convenio
- `MODALIDAD:` → modalidad_declarada
- `VALOR DEL PROGRAMA:` → valor_programa
- `NÚMERO DE PARTICIANTES` (sic) → n_participantes
- `NRC:` → nrc
- `COD BANNER:` → cod_banner
- `CODIGO CONTABLE:` → codigo_contable
- `COORDINADOR:` → coordinador

### 4.2 Hoja `CONSOLIDADO` → **esta es la asistencia real**
Estructura:
- Cabecera con `NÚMERO DE HORAS` (horas totales del programa) y
  `NÚMERO DE HORAS DE FALLAS MÁXIMAS PERMITIDAS` (tope de inasistencia).
- Una fila `Mes:` que **agrupa las columnas por mes** (JULIO, AGOSTO, SEPTIEMBRE…).
  Las celdas de mes suelen estar combinadas/una sola vez por bloque: hay que
  **propagar (forward-fill)** el mes hacia las columnas siguientes.
- Una fila de encabezados con: `NOMBRE`, `DOCUMENTO DE IDENTIDAD`, `EMPRESA`,
  `CORREO`, luego **una columna por sesión**, y al final `Σ de inasistencia` y
  `OBSERVACIONES:`.
- Cada fila siguiente = un participante.

**Encabezado de las columnas de sesión — dos formatos:**
1. **Fecha completa**: `2026-07-25` (datetime). Usar directo.
2. **Día + jornada**: `24 T`, `8 M`, `5 M`. El número = **día del mes**; la letra
   = **jornada** (`T` = Tarde, `M` = Mañana). Combinar con el **mes propagado** de
   la fila `Mes:` y el año (2026) para reconstruir la fecha completa. La jornada
   sirve para desambiguar dos sesiones el mismo día.

**Valor de cada celda = HORAS DE INASISTENCIA de ese participante en esa sesión:**
- `0` → asistió completo.
- número `> 0` → horas que faltó (si iguala la intensidad de la sesión, faltó
  completa; si es menor, asistencia parcial).
- **celda vacía** → esa sesión **no ha sido tabulada** para ese participante.

`Σ de inasistencia` = suma de horas de inasistencia del participante en todo el
programa. Se compara contra `NÚMERO DE HORAS DE FALLAS MÁXIMAS PERMITIDAS`:
si la supera, el participante **pierde el derecho a certificado**.

> `LISTADO DE ASISTENCIA` es solo el formato en blanco para firmar; **no** usarla
> como fuente de asistencia. `CERTIFICADO` y `FICHA DE TRAMITE`: ignorar.

---

## 5. Regla clave — ¿una sesión está "tabulada"?

Para cada sesión del cronograma, ubica su **columna correspondiente** en
`CONSOLIDADO` (cruzando por fecha, y por jornada T/M cuando hay dos el mismo día):

- La columna **tiene al menos un valor** en las filas de participantes
  (incluye ceros) → **`Tabulada`**.
- La columna está **totalmente vacía** y la fecha de la sesión **ya pasó**
  (`fecha <= fecha_corte`) → **`Pendiente de tabular`**.
- La columna está **vacía** y la fecha es **futura** (`fecha > fecha_corte`) →
  **`Futura no exigible`**.

El **cumplimiento** se mide SOLO sobre sesiones realizadas:
`cumplimiento = # Tabuladas / (# Tabuladas + # Pendientes de tabular)`.
Una sesión futura **nunca** cuenta como incumplimiento.

Si no se encuentra columna para una sesión del cronograma, marcar
`asistencia_tabulada = No` con nota en `observaciones` ("sin columna en CONSOLIDADO").

---

## 6. Parámetro configurable — fecha de corte

- El script debe aceptar la **fecha de corte** como parámetro
  (`--fecha-corte YYYY-MM-DD`), con **valor por defecto = fecha de hoy**.
- Todos los estados que dependen del tiempo (`estado_sesion`, `estado_programa`,
  `estado_seguimiento`) se calculan contra ese parámetro.
- Además, escribir la fecha de corte usada en la hoja `Parametros` del Excel de
  salida (celda editable), para que el dashboard la lea.

---

## 7. Reglas de derivación (normalización)

- **dia_semana / dia_semana_num**: de `fecha` (Lunes=1 … Domingo=7).
- **semana_iso**: número de semana ISO. `anio_semana` como texto `"2026-W##"`.
- **jornada**: `Mañana` si `hora_inicio < 12:00`, si no `Tarde` (para cruce y visual).
- **modalidad** (normalizada a un set fijo): mapear el texto de `Salón`/modalidad
  a uno de: `Presencial`, `Virtual`, `Remoto`, `Híbrido`, `Trabajo Independiente`,
  `Práctica`. (Ej.: `PRESENCIAL-VIRTUAL`→`Híbrido`; `PRESENCIAL-HOSPITAL...`→`Práctica`.)
- **estado_sesion**: `Realizada` si `fecha < corte`; `Hoy` si `= corte`;
  `Futura` si `> corte`.
- **fecha_inicio / fecha_fin (programa)**: mínimo y máximo de las fechas de sus
  sesiones.
- **estado_programa**: `Por iniciar` si `corte < fecha_inicio`; `Finalizado` si
  `corte > fecha_fin`; en otro caso `En ejecución`.

---

## 8. SALIDA EXACTA — `base_consolidada.xlsx`

Un solo archivo, **una hoja por tabla**, datos limpios: **una sola fila de
encabezados, sin celdas combinadas, sin títulos decorativos, tipos correctos**
(fechas como fecha, números como número). Esto es requisito para Power BI.

### Hoja `fct_sesiones` — grano: una fila por sesión (tabla de hechos principal)

| Columna | Tipo | Descripción |
|---|---|---|
| id_sesion | texto | `<programa_id>-<num_sesion>` (único). Ej. `HERIDAS-07` |
| programa_id | texto | FK a dim_programas |
| programa | texto | nombre corto legible |
| num_sesion | entero | |
| modulo | texto | vacío si no aplica |
| fecha | fecha | |
| anio | entero | |
| mes | entero | 1–12 |
| mes_nombre | texto | Enero…Diciembre |
| dia_semana | texto | Lunes…Domingo |
| dia_semana_num | entero | 1–7 |
| semana_iso | entero | |
| anio_semana | texto | `2026-W30` |
| jornada | texto | Mañana / Tarde |
| hora_inicio | hora/texto | `HH:MM` |
| hora_fin | hora/texto | `HH:MM` |
| intensidad_horaria | número | horas de la sesión |
| modalidad | texto | set normalizado (§7) |
| salon | texto | texto original de salón |
| docente | texto | |
| estado_sesion | texto | Realizada / Hoy / Futura |
| asistencia_tabulada | texto | Sí / No / N/A |
| estado_seguimiento | texto | Tabulada / Pendiente de tabular / Futura no exigible |
| n_participantes | entero | inscritos del programa |
| n_asistentes | entero (nullable) | si tabulada: # con inasistencia < intensidad |
| n_inasistentes | entero (nullable) | si tabulada: # con inasistencia >= intensidad |
| observaciones | texto | banderas de calidad de datos |

### Hoja `dim_programas` — una fila por programa

| Columna | Tipo | Descripción |
|---|---|---|
| programa_id | texto | PK |
| programa | texto | nombre corto |
| nombre_oficial | texto | de FORMAS DE PAGO |
| nrc | texto | |
| cod_banner | texto | |
| codigo_contable | texto | |
| coordinador | texto | |
| experto_facilitador | texto | |
| entidad_convenio | texto | |
| modalidad | texto | modalidad predominante del programa |
| valor_programa | número | |
| n_participantes | entero | |
| fecha_inicio | fecha | min(fecha) de sesiones |
| fecha_fin | fecha | max(fecha) de sesiones |
| n_sesiones | entero | conteo de sesiones |
| horas_totales | número | NÚMERO DE HORAS (CONSOLIDADO) |
| horas_falla_max | número | HORAS DE FALLAS MÁXIMAS PERMITIDAS |
| n_sesiones_realizadas | entero | fecha <= corte |
| n_sesiones_tabuladas | entero | |
| n_sesiones_pendientes | entero | realizadas sin tabular |
| pct_cumplimiento_tabulacion | número | tabuladas / realizadas (0–1) |
| estado_programa | texto | Por iniciar / En ejecución / Finalizado |

### Hoja `dim_calendario` — una fila por día

Rango: desde el **mínimo** hasta el **máximo** de todas las fechas de sesión.
Columnas: `fecha` (PK), `anio`, `mes`, `mes_nombre`, `dia`, `dia_semana`,
`dia_semana_num`, `semana_iso`, `anio_semana`, `es_fin_de_semana` (bool).

### Hoja `fct_asistencia` — grano: participante × sesión (capa académica)

| Columna | Tipo | Descripción |
|---|---|---|
| id_registro | texto | único |
| programa_id | texto | |
| id_sesion | texto | FK a fct_sesiones |
| fecha | fecha | |
| documento | texto | documento de identidad (primer número) |
| nombre | texto | |
| empresa | texto | |
| horas_inasistencia | número | valor de la celda (0 = asistió) |
| asistio | booleano | `horas_inasistencia < intensidad_horaria` |
| tabulada | booleano | si la sesión estaba tabulada |

> Solo generar filas para sesiones **tabuladas** (las que tienen datos). Las demás
> no tienen asistencia que registrar.

### Hoja `dim_participantes` — una fila por participante × programa (riesgo académico)

| Columna | Tipo | Descripción |
|---|---|---|
| programa_id | texto | |
| documento | texto | |
| nombre | texto | |
| empresa | texto | |
| total_inasistencia | número | Σ de inasistencia (recalculado desde fct_asistencia) |
| horas_falla_max | número | del programa |
| en_riesgo | booleano | `total_inasistencia > horas_falla_max` |

### Hoja `Parametros`
- `fecha_corte` : la fecha usada (editable).
- `fecha_generacion` : timestamp de ejecución del script.

---

## 9. Requisitos técnicos del script

- **Python 3** con `pandas` y `openpyxl`. Un único archivo ejecutable, ej.
  `construir_base.py`.
- Parámetros CLI: `--input "<ruta carpeta>"` (default = carpeta actual),
  `--fecha-corte YYYY-MM-DD` (default = hoy), `--output base_consolidada.xlsx`.
- **Robusto**: si a un programa le falta una hoja o columna, no debe abortar todo;
  registra el problema y continúa con el resto.
- Ignorar carpetas `Evidencia Fotográfica` y archivos de imagen (.jpg/.jpeg/.heic).
- Al terminar, imprimir en consola un **log resumen**: programas procesados,
  # de sesiones por programa, sesiones tabuladas/pendientes/futuras, y la lista de
  **incidencias de calidad de datos** encontradas.
- El código debe ser **determinista y reproducible**: volver a correrlo con la
  misma carpeta y fecha de corte produce exactamente la misma base.

---

## 10. Casos de calidad de datos a manejar (checklist)

- [ ] Fechas/horas como texto → normalizar a tipo fecha/hora.
- [ ] Horas invertidas o en `00:00` → conservar y marcar en `observaciones`.
- [ ] Sesiones fuera de orden (Odontología) → ordenar por fecha.
- [ ] Typo de año en metadatos (`2025` en Heridas / FORMAS DE PAGO) → confiar en
      las fechas del **cronograma** (2026); no usar la fecha del metadato para sesiones.
- [ ] Encabezados de columna de sesión en formato `DD T` / `DD M` → reconstruir fecha
      con el mes propagado y jornada.
- [ ] Fila `Mes:` con celdas combinadas → forward-fill del mes.
- [ ] Documento de identidad con formato `12345 /67890` → tomar el primer número.
- [ ] Columnas que existen en unos cronogramas y no en otros → mapear por nombre,
      dejar vacío si falta.
- [ ] Nombres de hoja de cronograma variables → detectar por encabezados, no por nombre.

---

## 11. Entregables esperados de este paso

1. `construir_base.py` — el script.
2. `base_consolidada.xlsx` — la base con las hojas de §8.
3. Un log/README corto con las incidencias de calidad de datos detectadas por
   programa.

Una vez validada esta base, se conecta a Power BI (modelo estrella:
`fct_sesiones` y `fct_asistencia` → `dim_programas` por `programa_id`,
`fct_sesiones` → `dim_calendario` por `fecha`) y se construye el HTML.
