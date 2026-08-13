# Base consolidada CEC — incidencias de calidad de datos

Generado por `construir_base.py` el 2026-08-12 22:40:35.

- **Fecha de corte:** `2026-08-11`
- **Archivo generado:** `base_consolidada.xlsx`
- **Programas procesados:** 8

## Resumen por programa

| Programa | Sesiones | Tabuladas | Pendientes | Futuras | Cumplim. | Participantes | Incidencias |
|---|---:|---:|---:|---:|---:|---:|---:|
| Bienestar y Felicidad | 4 | 3 | 0 | 1 | 100% | 9 | 3 |
| Bootcamp Analítica Predictiva | 4 | 2 | 2 | 0 | 50% | 5 | 2 |
| Cuidado de Heridas | 37 | 11 | 5 | 21 | 69% | 35 | 4 |
| Ecografía Clínica | 22 | 6 | 1 | 15 | 86% | 22 | 3 |
| Odontología Estética Adhesiva | 17 | 0 | 2 | 15 | 0% | 11 | 7 |
| Normatividad Inst. Eléctricas | 30 | 10 | 3 | 17 | 77% | 10 | 6 |
| Gerencia de Proyectos (Project) | 12 | 12 | 0 | 0 | 100% | 8 | 4 |
| Integración Sensorial | 4 | 0 | 2 | 2 | 0% | 8 | 6 |

## Incidencias detectadas

### Bienestar y Felicidad

- **AVISO** — Cronograma sin columna 'Nombre del módulo'.
- **AVISO** — FORMAS DE PAGO sin valor para: experto_facilitador, entidad_convenio, codigo_contable.
- **AVISO** — NÚMERO DE PARTICIANTES declarado = 5 pero CONSOLIDADO lista 9 participante(s).

### Bootcamp Analítica Predictiva

- **AVISO** — Cronograma sin columna 'Salón': la modalidad se toma de MODALIDAD en FORMAS DE PAGO.
- **AVISO** — Cronograma sin columna 'Nombre del módulo'.

### Cuidado de Heridas

- **AVISO** — FORMAS DE PAGO sin valor para: experto_facilitador, valor_programa, codigo_contable.
- **AVISO** — FORMAS DE PAGO / 'LUGAR Y FECHA' declara el año 2025 ('Barranquilla - 24/07/2025') pero el cronograma es de 2026: se usan las fechas del cronograma.
- **AVISO** — 1 sesión(es) con hora_fin anterior o igual a hora_inicio (se conservan y quedan marcadas en observaciones): sesión 5 08:00→01:00.
- **AVISO** — Suma de intensidad horaria del cronograma (99 h) ≠ NÚMERO DE HORAS del CONSOLIDADO (90 h).

### Ecografía Clínica

- **AVISO** — FORMAS DE PAGO sin valor para: experto_facilitador, codigo_contable.
- **AVISO** — 1 sesión(es) con hora_fin fechada en un día distinto al de la sesión: sesión 1 → 2026-07-29.
- **AVISO** — Suma de intensidad horaria del cronograma (78 h) ≠ NÚMERO DE HORAS del CONSOLIDADO (90 h).

### Odontología Estética Adhesiva

- **AVISO** — Sesiones fuera de orden en el cronograma: se reordenaron por fecha (§10).
- **AVISO** — Numeración de sesiones no correlativa; faltan los números 3, 6, 11, 17, 20.
- **AVISO** — FORMAS DE PAGO sin valor para: experto_facilitador, codigo_contable.
- **AVISO** — FORMAS DE PAGO / 'LUGAR Y FECHA' declara el año 2025 ('Barranquilla - 24/07/2025') pero el cronograma es de 2026: se usan las fechas del cronograma.
- **AVISO** — NÚMERO DE PARTICIANTES declarado = 10 pero CONSOLIDADO lista 11 participante(s).
- **AVISO** — 1 sesión(es) con hora_fin anterior o igual a hora_inicio (se conservan y quedan marcadas en observaciones): sesión 16 17:00→14:00.
- **AVISO** — Suma de intensidad horaria del cronograma (74 h) ≠ NÚMERO DE HORAS del CONSOLIDADO (102 h).

### Normatividad Inst. Eléctricas

- **AVISO** — FORMAS DE PAGO sin valor para: entidad_convenio, nrc, cod_banner.
- **AVISO** — 1 sesión(es) con hora_fin anterior o igual a hora_inicio (se conservan y quedan marcadas en observaciones): sesión 8 17:00→00:00.
- **AVISO** — 1 sesión(es) con hora_fin en 00:00: sesión 8.
- **AVISO** — 2 sesión(es) del cronograma sin columna en CONSOLIDADO (sesión 5 del 2026-07-22, sesión 6 del 2026-07-23); quedan como no tabuladas.
- **AVISO** — Fecha(s) con más de una columna en CONSOLIDADO (2026-08-05, 2026-08-06): se usa la columna con datos y jornada compatible.
- **AVISO** — 2 columna(s) de CONSOLIDADO sin sesión en el cronograma (5 T→2026-08-05, 6 T→2026-08-06).

### Gerencia de Proyectos (Project)

- **AVISO** — Cronograma sin columna 'Salón': la modalidad se toma de MODALIDAD en FORMAS DE PAGO.
- **AVISO** — FORMAS DE PAGO sin valor para: entidad_convenio, nrc, cod_banner.
- **AVISO** — 1 sesión(es) con hora_fin fechada en un día distinto al de la sesión: sesión 10 → 2026-07-28.
- **AVISO** — Suma de intensidad horaria del cronograma (36 h) ≠ NÚMERO DE HORAS del CONSOLIDADO (40 h).

### Integración Sensorial

- **AVISO** — Cronograma sin columna 'Salón': la modalidad se toma de MODALIDAD en FORMAS DE PAGO.
- **AVISO** — Cronograma sin columna 'Nombre del módulo'.
- **AVISO** — FORMAS DE PAGO sin valor para: experto_facilitador, codigo_contable.
- **AVISO** — CONSOLIDADO: 9 columna(s) de sesión sin fecha reconstruible ('M.', 'T', 'M', 'T', 'M', 'T', 'M', 'T'); esas sesiones quedan sin columna.
- **AVISO** — NÚMERO DE PARTICIANTES declarado = 6 pero CONSOLIDADO lista 8 participante(s).
- **AVISO** — 4 sesión(es) del cronograma sin columna en CONSOLIDADO (sesión 1 del 2026-07-31, sesión 2 del 2026-08-01, sesión 3 del 2026-08-14, sesión 4 del 2026-08-15); quedan como no tabuladas.

## Cómo se ejecuta

```bash
python construir_base.py                                # corte = hoy, carpeta actual
python construir_base.py --fecha-corte 2026-08-11
python construir_base.py --input "C:/ruta/Prueba_Tecnica" \
                         --fecha-corte 2026-08-11 \
                         --output base_consolidada.xlsx
```

Requiere `pandas` y `openpyxl`. El script recorre dinámicamente toda subcarpeta que contenga `Equipo Logístico/Listado de Clases/`, ignora `Evidencia Fotográfica` y las imágenes, y **no aborta** si un programa tiene problemas: lo registra como incidencia y sigue con el resto.

## Criterios aplicados

- **Estado de tabulación (§5):** una sesión es `Tabulada` si su columna en `CONSOLIDADO` tiene al menos un valor (los ceros cuentan); `Pendiente de tabular` si está vacía y `fecha <= fecha_corte`; `Futura no exigible` si está vacía y `fecha > fecha_corte`.
- **Cumplimiento:** `tabuladas / (tabuladas + pendientes)`. Las sesiones futuras nunca cuentan como incumplimiento.
- **Columna por día, no por sesión:** el `CONSOLIDADO` trae una columna por día (o por día+jornada) mientras el cronograma puede tener varias sesiones ese día. Varias sesiones pueden compartir columna; el emparejamiento usa fecha y, cuando hay más de una columna para la misma fecha, jornada `T`/`M`.
- **`asistencia_tabulada`:** `Sí` = Tabulada, `No` = Pendiente de tabular, `N/A` = Futura no exigible. Las sesiones sin columna en `CONSOLIDADO` quedan marcadas en `observaciones`.
- **`fct_asistencia`** sólo contiene filas de sesiones tabuladas y con celda diligenciada; una celda vacía dentro de una sesión tabulada no genera fila.
- **`total_inasistencia`** se recalcula sumando cada columna de `CONSOLIDADO` una sola vez por participante, aunque esa columna sirva a varias sesiones del mismo día (evita el doble conteo).
- **Año de las columnas `DD T` / `DD M`:** se reconstruye con el mes propagado (forward-fill de la fila `Mes:`) y el año que hace calzar la fecha con el cronograma (2026 en todos los programas).
- **`n_participantes`** se toma de `NÚMERO DE PARTICIANTES` (FORMAS DE PAGO), como indica §4.1. En 3 programas ese número declarado **no coincide** con las filas reales del `CONSOLIDADO` (ver incidencias); el conteo real está en `dim_participantes`, que es el que conviene usar para tasas de asistencia.
- **Typo de año 2025** (Heridas y Odontología, campo `LUGAR Y FECHA`): se ignora para efectos de fechas; las sesiones salen del cronograma (§10).

- **Celdas vacías:** todas las columnas de **texto** sin dato traen el literal `N/A` en lugar de quedar en blanco (`modulo`, `salon`, `docente`, `observaciones`, `empresa`, `nrc`, `cod_banner`, `codigo_contable`, `experto_facilitador`, `entidad_convenio`…). Se cambia con `--relleno-texto ""`.
- **Las columnas numéricas y de fecha se dejan realmente nulas** a propósito: `n_asistentes`, `n_inasistentes`, `intensidad_horaria`, `valor_programa`, `horas_totales`, `horas_falla_max` y `pct_cumplimiento_tabulacion` quedan vacías cuando no aplican. Escribirles `N/A` las convertiría en columnas de texto en Power BI y rompería sumas, promedios y ejes de fecha; el vacío es lo que Power BI espera y lo muestra como *(Blank)*. En `fct_sesiones` esos vacíos son informativos: `n_asistentes`/`n_inasistentes` sólo existen si la sesión está `Tabulada`.

> Nota para quien lea el Excel con pandas: `N/A` es un valor nulo por defecto en `read_excel`. Para leerlo como texto: `pd.read_excel(..., keep_default_na=False)`. Power BI lo importa como texto sin ajustes.

## Verificación realizada

Contraste del `.xlsx` generado contra los Excel originales, releyendo el `CONSOLIDADO` con un script independiente (corte `2026-08-11`):

- **Cuidado de Heridas** — 21 columnas de sesión en `CONSOLIDADO`. Con datos: `24 T`, `25 T`, `30 T` (julio), `1 T`, `6 T` (agosto). Vacías: `31 T` y todas las de `8 T` en adelante. La base marca **11 Tabuladas** (las 4 sesiones del 24-jul + 25-jul + 30-jul + las 4 del 1-ago + 6-ago), **5 Pendientes** (las 4 sesiones del 31-jul + la del 8-ago, ya pasadas y sin tabular) y **21 Futuras**. Los 37 estados coinciden. 35 participantes, igual que las filas reales de la hoja.
- **Bienestar y Felicidad** — 4 columnas con fecha completa. Con datos: `2026-07-25`, `2026-08-01`, `2026-08-08`. Vacía: `2026-08-15` (futura). La base marca **3 Tabuladas** y **1 Futura no exigible**; cumplimiento 100 % porque la futura no entra al denominador. Los 4 estados coinciden. 9 participantes.
- **Σ de inasistencia** — el total recalculado desde `fct_asistencia` coincide con la columna `Σ de inasistencia` del archivo para los **108 participantes de los 8 programas**, sin una sola diferencia.
- **`en_riesgo`** — marca exactamente 3 participantes (Bootcamp ×1, Project ×2), los mismos que los archivos originales rotulan `NO GRADUA` en OBSERVACIONES.
- **Integridad del modelo** — hojas y columnas exactas a §8, sin celdas combinadas, `fecha` como fecha real; `id_sesion`, `id_registro` y `programa_id` únicos; todas las FK resuelven; ninguna sesión futura queda como `Pendiente de tabular`; `n_asistentes`/`n_inasistentes` cuadran con `fct_asistencia`; `dim_calendario` continuo.
- **Determinismo** — dos corridas seguidas producen hojas idénticas.

**Discrepancias encontradas:** ninguna entre la base y los Excel originales. Las diferencias reportadas arriba son inconsistencias **dentro de los archivos fuente** (año 2025 en metadatos, horas invertidas, participantes declarados vs. reales, horas del cronograma vs. horas del CONSOLIDADO, columnas faltantes o duplicadas en Normatividad, `CONSOLIDADO` de Integración Sensorial sin fechas en los encabezados), que el script conserva y marca en lugar de corregir.
