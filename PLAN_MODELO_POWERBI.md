# Plan del modelo — Dashboard CEC en Power BI

Referencia para construir el tablero sobre `base_consolidada.xlsx`. Cubre:
importación, relaciones, la **fecha de corte interactiva**, todas las medidas DAX,
el diseño de páginas y el formato visual.

---

## 0. Importar

Importar las 6 hojas de `base_consolidada.xlsx` como tablas:
`fct_sesiones`, `fct_asistencia`, `dim_programas`, `dim_calendario`,
`dim_participantes`, `Parametros`.

En Power Query, confirmar tipos: `fecha` = Fecha; `hora_inicio`/`hora_fin` = Texto;
`intensidad_horaria`, `n_*`, `valor_programa`, `horas_*` = Número;
`asistio`, `en_riesgo`, `es_fin_de_semana` = Booleano.

> Al importar, `asistencia_tabulada` con valor `N/A` entra como texto en Power BI
> (no como nulo). Correcto, no tocar.

---

## 1. Relaciones (modelo estrella)

Claves y cardinalidades (todas 1→muchos, filtro simple en dirección dim→hecho):

| Desde (1) | Hacia (muchos) | Clave |
|---|---|---|
| `dim_programas[programa_id]` | `fct_sesiones[programa_id]` | programa_id |
| `dim_programas[programa_id]` | `fct_asistencia[programa_id]` | programa_id |
| `dim_calendario[fecha]` | `fct_sesiones[fecha]` | fecha |
| `dim_calendario[fecha]` | `fct_asistencia[fecha]` | fecha |
| `fct_sesiones[id_sesion]` | `fct_asistencia[id_sesion]` | id_sesion |
| `dim_participantes[part_key]` | `fct_asistencia[part_key]` | part_key (crear, ver abajo) |

**Marcar `dim_calendario` como tabla de fechas** (Modelado → Marcar como tabla de
fechas → `fecha`). Necesario para el corte semanal/mensual.

**Clave de participante** (Power BI no admite claves compuestas): crear una columna
calculada idéntica en ambas tablas —
```DAX
part_key = fct_asistencia[programa_id] & "|" & fct_asistencia[documento]
```
```DAX
part_key = dim_participantes[programa_id] & "|" & dim_participantes[documento]
```
y relacionarlas por `part_key`.

**Ordenar columnas para que los ejes salgan bien:**
- `dim_calendario[mes_nombre]` → Ordenar por `mes`.
- `fct_sesiones[dia_semana]` → Ordenar por `dia_semana_num`.

---

## 2. Fecha de corte interactiva (lo central)

Las columnas `estado_sesion` / `estado_seguimiento` del Excel se calcularon con el
corte del script. Para que el usuario **mueva la fecha y todo se recalcule**, se usa
un parámetro y medidas dinámicas.

### 2.1 Tabla de parámetro (desconectada)
Crear tabla calculada:
```DAX
Corte = CALENDAR( DATE(2026,7,1), DATE(2026,12,31) )
```
Renombrar la columna a `Corte[FechaCorte]`. Poner un **segmentador de fecha única**
sobre `Corte[FechaCorte]` (estilo "entre" o lista). No relacionarla con nada.

### 2.2 Medida base del corte
```DAX
_FechaCorte = COALESCE( SELECTEDVALUE( Corte[FechaCorte] ), TODAY() )
```
Todo lo temporal se cuelga de esta medida. Si el usuario no elige nada, usa hoy.

### 2.3 Regla dinámica de estado
`asistencia_tabulada = "Sí"` es un hecho real (la columna del CONSOLIDADO tiene
datos) e **no** depende del corte. Lo que sí depende del corte es si una sesión sin
datos es "pendiente" (ya pasó) o "futura". Regla:

- `asistencia_tabulada = "Sí"` **y** `fecha <= corte` → **Tabulada**
- sin datos **y** `fecha <= corte` → **Pendiente de tabular**
- `fecha > corte` → **Futura no exigible**

---

## 3. Medidas DAX

### 3.1 Sesiones / seguimiento logístico
```DAX
Sesiones = COUNTROWS( fct_sesiones )

Sesiones realizadas =
VAR c = [_FechaCorte]
RETURN COUNTROWS( FILTER( fct_sesiones, fct_sesiones[fecha] <= c ) )

Sesiones tabuladas =
VAR c = [_FechaCorte]
RETURN COUNTROWS( FILTER( fct_sesiones,
    fct_sesiones[asistencia_tabulada] = "Sí" && fct_sesiones[fecha] <= c ) )

Sesiones pendientes =
VAR c = [_FechaCorte]
RETURN COUNTROWS( FILTER( fct_sesiones,
    fct_sesiones[asistencia_tabulada] <> "Sí" && fct_sesiones[fecha] <= c ) )

Sesiones futuras =
VAR c = [_FechaCorte]
RETURN COUNTROWS( FILTER( fct_sesiones, fct_sesiones[fecha] > c ) )

% Cumplimiento tabulación =
DIVIDE( [Sesiones tabuladas], [Sesiones tabuladas] + [Sesiones pendientes] )
```

### 3.2 Estado dinámico por sesión (para tablas/formato condicional)
```DAX
Estado seguimiento (din) =
VAR c = [_FechaCorte]
VAR f = SELECTEDVALUE( fct_sesiones[fecha] )
VAR tiene = SELECTEDVALUE( fct_sesiones[asistencia_tabulada] ) = "Sí"
RETURN
    SWITCH( TRUE(),
        f > c, "Futura no exigible",
        tiene, "Tabulada",
        "Pendiente de tabular" )

Días de atraso =
VAR c = [_FechaCorte]
VAR f = SELECTEDVALUE( fct_sesiones[fecha] )
VAR tiene = SELECTEDVALUE( fct_sesiones[asistencia_tabulada] ) = "Sí"
RETURN IF( NOT tiene && f <= c, DATEDIFF( f, c, DAY ) )
```

### 3.3 Programas
```DAX
Programas en ejecución =
VAR c = [_FechaCorte]
RETURN COUNTROWS( FILTER( dim_programas,
    dim_programas[fecha_inicio] <= c && dim_programas[fecha_fin] >= c ) )

-- Respeta el segmentador de semana/mes vía dim_calendario:
Programas con clase = DISTINCTCOUNT( fct_sesiones[programa_id] )
```

### 3.4 Asistencia / riesgo académico
```DAX
-- OJO: total de inasistencia SIEMPRE desde dim_participantes (ya deduplicado).
-- NO sumar fct_asistencia[horas_inasistencia] (se replica en días multisesión).
Horas inasistencia (total) = SUM( dim_participantes[total_inasistencia] )

Participantes = DISTINCTCOUNT( dim_participantes[part_key] )

Participantes en riesgo =
CALCULATE( COUNTROWS( dim_participantes ), dim_participantes[en_riesgo] = TRUE() )

Asistencias registradas =
CALCULATE( COUNTROWS( fct_asistencia ), fct_asistencia[asistio] = TRUE() )

% Asistencia =
DIVIDE(
    CALCULATE( COUNTROWS( fct_asistencia ), fct_asistencia[asistio] = TRUE() ),
    COUNTROWS( fct_asistencia ) )
```

---

## 4. Diseño de páginas

Barra de segmentadores común (arriba de cada página): **Programa**, **Mes**,
**Semana** (`dim_calendario[anio_semana]`), **Fecha de corte** (`Corte[FechaCorte]`).

### Página 1 — Vista global (resumen ejecutivo)
- Tarjetas KPI: `Programas en ejecución`, `Programas con clase`,
  `Sesiones realizadas`, `% Cumplimiento tabulación`, `Sesiones pendientes`,
  `Participantes en riesgo`.
- Barras apiladas: sesiones por programa, color por estado (tabulada/pendiente/futura).
- Medidor (gauge) o tarjeta grande: `% Cumplimiento tabulación`.
- Matriz: `programa` (filas) × estado (columnas), valor = conteo.

### Página 2 — Seguimiento semanal (el calendario operativo)
- Segmentador de semana destacado.
- **Matriz calendario**: filas = `programa`, columnas = `dia_semana` (Lun→Sáb),
  valor = nº de sesiones; formato condicional por intensidad.
- Tarjetas: sesiones de la semana, programas con clase, horas totales de la semana.
- Tabla detalle de la semana: `programa`, `fecha`, `dia_semana`, `hora_inicio`–`hora_fin`,
  `modalidad`, `docente`, `Estado seguimiento (din)` con color.

### Página 3 — Control de tabulación (cumplimiento)
- Matriz `programa` × `num_sesion` con color por `Estado seguimiento (din)`
  (verde/rojo/gris) — mapa de calor del estado.
- **Lista de acción**: solo sesiones `Pendiente de tabular`, con `Días de atraso`
  descendente. Es el "qué falta por tabular hoy".
- Tarjeta `% Cumplimiento tabulación` y tendencia por semana.

### Página 4 — Detalle académico (opcional)
- Tabla `dim_participantes`: nombre, programa, `total_inasistencia`,
  `horas_falla_max`, `en_riesgo` (ícono/color).
- KPI `Participantes en riesgo`; filtro por programa.

---

## 5. Formato y tema

- Colores de estado: **Tabulada = verde**, **Pendiente = rojo**, **Futura = gris**.
  Definir en formato condicional por reglas sobre `Estado seguimiento (din)`.
- Tema institucional Uninorte (azul ~`#003087` / acento `#0072CE`), fondo claro.
- Formato condicional de la matriz calendario: escala por nº de sesiones.
- Íconos de KPI: cumplimiento con semáforo (verde ≥90%, ámbar 70–90%, rojo <70%).

---

## 6. Checklist de armado

- [ ] Importar 6 hojas y fijar tipos.
- [ ] Crear `part_key` en `fct_asistencia` y `dim_participantes`.
- [ ] Crear las 6 relaciones; marcar `dim_calendario` como tabla de fechas.
- [ ] Ordenar `mes_nombre` por `mes` y `dia_semana` por `dia_semana_num`.
- [ ] Tabla `Corte` + segmentador de fecha; medida `_FechaCorte`.
- [ ] Crear todas las medidas de §3.
- [ ] Montar páginas 1–4 y aplicar tema/colores de estado.
- [ ] Validar: mover la fecha de corte y ver que KPIs, pendientes y cumplimiento
      cambian; seleccionar una semana y ver la carga por día.

> Regla de oro del modelo: **para horas de inasistencia por participante usar
> `dim_participantes`; `fct_asistencia` solo para "asistió sí/no" por sesión.**
