/**
 * Contenido de la página Guía: qué significa cada variable del modelo y de
 * dónde sale. Vive como datos —no como JSX— para poder buscarlo y para que
 * añadir un campo al modelo sea añadir una línea aquí.
 */

export interface CampoDoc {
  campo: string
  tipo: string
  /** Qué es, en una frase que se pueda leer sin contexto. */
  descripcion: string
  /** De dónde sale: hoja y columna del Excel, o cómo se calcula. */
  origen: string
  ejemplo?: string
  /** Advertencia o matiz que evita malinterpretarlo. */
  nota?: string
}

export interface TablaDoc {
  id: string
  nombre: string
  /** Qué representa una fila. */
  grano: string
  proposito: string
  campos: CampoDoc[]
}

/* ───────────────────────── las páginas del panel ───────────────────────── */

export interface PaginaDoc {
  id: string
  nombre: string
  ruta: string
  pregunta: string
  descripcion: string
  elementos: Array<{ titulo: string; detalle: string }>
}

export const PAGINAS_DOC: PaginaDoc[] = [
  {
    id: 'p-resumen',
    nombre: 'Resumen',
    ruta: '#/',
    pregunta: '¿Cómo va la operación completa hoy?',
    descripcion:
      'La foto general. Responde de un vistazo cuántos programas están activos, qué tan al día está la tabulación de asistencia y cuántos participantes están en riesgo de perder el certificado.',
    elementos: [
      {
        titulo: 'En ejecución',
        detalle:
          'Programas cuya fecha de corte cae entre su primera y su última sesión. Un programa que ya terminó, o que aún no empieza, no cuenta aquí aunque siga en la base.',
      },
      {
        titulo: 'Cumplimiento',
        detalle:
          'Porcentaje de sesiones ya dictadas cuya asistencia está cargada. Es el indicador central del panel: mide trabajo administrativo pendiente, no calidad académica.',
      },
      {
        titulo: 'Pendientes',
        detalle:
          'Sesiones que ya ocurrieron y siguen sin asistencia cargada. Es la deuda concreta del equipo logístico.',
      },
      {
        titulo: 'En riesgo',
        detalle:
          'Participantes cuya inasistencia acumulada ya superó el tope de su programa. Perdieron el derecho al certificado salvo que el programa haga una excepción.',
      },
      {
        titulo: 'Programas',
        detalle:
          'La tabla dice en qué punto está cada curso: «En ejecución» si la fecha de corte cae entre su primera y su última sesión, «Por iniciar» si aún no empieza y «Finalizado» si ya cerró. Van primero los activos, que son los que hay que atender, con su periodo, su cumplimiento y quién coordina.',
      },
      {
        titulo: 'Estado por programa',
        detalle:
          'Una barra por programa. El ancho total es proporcional a su número de sesiones, y dentro se apilan tabuladas (cyan), pendientes (rosa) y futuras (gris). Sirve para ver de un golpe quién está atrasado y quién apenas empieza.',
      },
      {
        titulo: 'Cumplimiento de tabulación',
        detalle:
          'La dona repite el porcentaje y lo desglosa: cuántas sesiones se han dictado, cuántas están tabuladas, cuántas pendientes y cuántas quedan por delante.',
      },
    ],
  },
  {
    id: 'p-semanal',
    nombre: 'Semanal',
    ruta: '#/semanal',
    pregunta: '¿Qué clases hay esta semana y dónde se concentra la carga?',
    descripcion:
      'La vista de planeación. Muestra cómo se reparte la carga de clases entre días y programas, para anticipar choques de salón, docente o logística.',
    elementos: [
      {
        titulo: 'En ejecución vs. con clase',
        detalle:
          'Son dos cosas distintas y por eso van una al lado de la otra. «En ejecución» es que el cronograma del programa abarca la semana elegida; «con clase» es que además tiene al menos una sesión esos días. Un diplomado de cinco meses está en ejecución todo el tiempo pero descansa muchas semanas: cuando eso pasa, un aviso nombra a los programas activos que no tienen clase.',
      },
      {
        titulo: 'Carga por día',
        detalle:
          'Matriz programa × día. La celda muestra las sesiones de ese programa ese día, o las horas si se cambia la métrica con el interruptor de la tarjeta. El color se escala contra la celda más cargada del rango visible: más intenso, más carga.',
      },
      {
        titulo: 'Totales por día',
        detalle:
          'Bajo la matriz, tres filas responden lo que necesita el equipo para repartirse el trabajo: cuántas sesiones hay que atender ese día, cuántos programas distintos mueven y cuántas horas suman.',
      },
      {
        titulo: 'Carga por semana',
        detalle:
          'Al elegir «Todas las semanas», las columnas pasan de días a semanas. Es el mismo mapa de calor, pero con el zoom suficiente para ver meses enteros sin que la tabla se vuelva ilegible.',
      },
      {
        titulo: 'Clases de la semana',
        detalle:
          'El detalle fila a fila: programa, fecha, horario, modalidad, docente, estado de tabulación y días de atraso si aplica. Ordenada de la más reciente a la más antigua.',
      },
      {
        titulo: 'Filtros',
        detalle:
          'La semana y el programa se buscan escribiendo. La semana acepta «ago», «10/08» o la fecha completa; el programa acepta también su NRC o su coordinador.',
      },
    ],
  },
  {
    id: 'p-tabulacion',
    nombre: 'Control de tabulación',
    ruta: '#/tabulacion',
    pregunta: '¿Qué tengo que resolver primero?',
    descripcion:
      'La página operativa. Convierte el cumplimiento en una lista de tareas concreta, ordenada por urgencia.',
    elementos: [
      {
        titulo: 'Pendientes por programa',
        detalle:
          'Quién está más atrasado, en número absoluto de sesiones sin tabular. Un programa con 5 pendientes de 37 sesiones pesa distinto que uno con 2 de 4; para eso está el cumplimiento del Resumen.',
      },
      {
        titulo: 'Lista de acción',
        detalle:
          'Cada sesión ya dictada y sin tabular, ordenada por días de atraso, la más vieja arriba. Trae el número de sesión, el módulo y el docente para poder ir a buscar el listado firmado.',
      },
      {
        titulo: 'Días de atraso',
        detalle:
          'Días calendario entre la fecha de la sesión y la fecha de corte. No descuenta fines de semana ni festivos: es tiempo transcurrido, no días hábiles.',
      },
    ],
  },
  {
    id: 'p-academico',
    nombre: 'Detalle académico',
    ruta: '#/academico',
    pregunta: '¿Quién está por perder el certificado?',
    descripcion:
      'La cara académica de los mismos datos. Compara la inasistencia acumulada de cada participante contra el tope de fallas que permite su programa.',
    elementos: [
      {
        titulo: 'Asistencia',
        detalle:
          'Porcentaje de registros tabulados en los que el participante asistió. Se calcula sólo sobre lo que está cargado: las sesiones sin tabular no cuentan ni a favor ni en contra.',
      },
      {
        titulo: 'Inasistencia por participante',
        detalle:
          'Horas acumuladas de falta frente al tope de su programa. La barra es relativa al participante con más horas del listado; en rosa, quienes ya superaron su tope.',
      },
      {
        titulo: 'Tope',
        detalle:
          'El valor de «NÚMERO DE HORAS DE FALLAS MÁXIMAS PERMITIDAS» de ese programa. Varía por curso: 20 h en un diplomado de 90 h, 5 h en un bootcamp de 24 h.',
      },
    ],
  },
  {
    id: 'p-cursos',
    nombre: 'Cursos',
    ruta: '#/cursos',
    pregunta: '¿Cómo agrego o actualizo un curso?',
    descripcion:
      'La puerta de entrada de los datos. Se arrastran los dos Excel del curso, la app los normaliza, valida y guarda en este navegador.',
    elementos: [
      {
        titulo: 'Validación',
        detalle:
          'Nunca falla en silencio. Los errores bloquean la importación y explican qué falta, en qué hoja y qué hacer; los avisos dejan pasar el curso pero quedan registrados.',
      },
      {
        titulo: 'Cursos cargados',
        detalle:
          'Los programas que hoy están en la base, con sus sesiones y sus pendientes. El punto es cyan si está al día y rosa si tiene sesiones sin tabular.',
      },
      {
        titulo: 'Base de datos',
        detalle:
          'Exportar e importar la base como JSON, exportar a Excel con el esquema estrella, restaurar los datos de ejemplo o vaciar todo.',
      },
      {
        titulo: 'Publicar para el equipo',
        detalle:
          'Opcional. Hace un commit del JSON al repositorio vía la API de GitHub, para que el resto del equipo vea los mismos datos al abrir el sitio.',
      },
    ],
  },
]

/** La Guía se documenta a sí misma: si no, sería la única página sin explicar. */
PAGINAS_DOC.push({
  id: 'p-guia',
  nombre: 'Guía',
  ruta: '#/guia',
  pregunta: '¿Qué significa exactamente este dato?',
  descripcion:
    'Esta misma página. Explica cada variable del modelo, de qué hoja y columna del Excel sale, y qué se decidió cuando los archivos no venían perfectos.',
  elementos: [
    {
      titulo: 'Buscador',
      detalle:
        'Filtra las tablas del diccionario al escribir. Busca en el nombre de la variable, en su descripción, en su origen y en las notas: «tope» encuentra horas_falla_max aunque no se llame así.',
    },
    {
      titulo: 'Esta base, ahora mismo',
      detalle:
        'Los totales de los datos que tienes cargados en este momento, al corte activo. Sirve para contrastar contra lo que muestran las demás páginas.',
    },
  ],
})

/* ───────────────────────── conceptos y reglas ───────────────────────── */

export interface ConceptoDoc {
  id: string
  titulo: string
  resumen: string
  cuerpo: string[]
  formula?: string
  tabla?: { encabezados: string[]; filas: string[][] }
}

export const CONCEPTOS: ConceptoDoc[] = [
  {
    id: 'c-corte',
    titulo: 'Fecha de corte',
    resumen: 'El reloj contra el que se juzga todo el panel.',
    cuerpo: [
      'Es el parámetro global de la barra superior. Todo lo que depende del tiempo se calcula contra ella: si una sesión ya se dictó, si un programa está activo, cuántos días lleva atrasada una tabulación.',
      'Cambiarla no altera ni un dato de los Excel. Sólo cambia desde dónde se mira: la misma base con corte de julio y con corte de diciembre cuenta la misma cantidad de sesiones tabuladas, pero reparte muy distinto las pendientes y las futuras.',
      'Se guarda en el navegador, así que al volver sigue la que dejaste. En la primera visita arranca en la fecha de hoy.',
    ],
  },
  {
    id: 'c-inasistencia',
    titulo: 'Las celdas son horas de INASISTENCIA',
    resumen: 'El dato del Excel está invertido respecto a lo que uno esperaría.',
    cuerpo: [
      'En la hoja CONSOLIDADO, el valor de cada celda son las horas que el participante FALTÓ a esa sesión, no las que asistió. Es la convención del formato del CEC y es la fuente de casi todos los malentendidos.',
      'Un 0 significa asistencia completa. Un número mayor que 0 son las horas perdidas: si iguala la intensidad de la sesión, faltó completa; si es menor, llegó tarde o se fue antes.',
      'Una celda vacía no es un cero. Significa que esa sesión no ha sido tabulada para ese participante, y es justo lo que el panel persigue.',
    ],
    tabla: {
      encabezados: ['Valor de la celda', 'Qué significa'],
      filas: [
        ['0', 'Asistió completo'],
        ['Mayor que 0 y menor que la intensidad', 'Asistencia parcial: faltó esas horas'],
        ['Igual o mayor que la intensidad', 'No asistió a la sesión'],
        ['Vacía', 'Sin tabular — no se sabe si asistió'],
      ],
    },
  },
  {
    id: 'c-tabulacion',
    titulo: 'Estado de tabulación',
    resumen: 'Distingue dos vacíos que en Excel se ven idénticos.',
    cuerpo: [
      'Una columna vacía puede significar dos cosas opuestas: que alguien no cargó la asistencia de una clase que ya se dictó (deuda), o que la clase simplemente no ha ocurrido (normal). La fecha de corte es lo que las separa.',
      'Que una sesión esté tabulada NO depende de la fecha de corte: es un hecho del Excel. Lo que depende del corte es cómo se lee una columna vacía.',
    ],
    tabla: {
      encabezados: ['Estado', 'Condición', 'Color'],
      filas: [
        ['Tabulada', 'Su columna tiene al menos un valor, incluidos los ceros', 'Cyan'],
        ['Pendiente de tabular', 'Columna vacía y la clase ya se dictó (fecha ≤ corte)', 'Rosa'],
        ['Futura no exigible', 'Columna vacía y la clase aún no ocurre (fecha > corte)', 'Gris'],
      ],
    },
  },
  {
    id: 'c-cumplimiento',
    titulo: 'Cumplimiento',
    resumen: 'Sólo se mide sobre lo que ya se dictó.',
    formula: 'cumplimiento = tabuladas / (tabuladas + pendientes)',
    cuerpo: [
      'El denominador son las sesiones realizadas, no todas las del programa. Una sesión futura nunca cuenta como incumplimiento: no se le puede exigir al equipo que tabule una clase que todavía no ha pasado.',
      'La diferencia no es menor. Bienestar tiene 4 sesiones, 3 tabuladas y 1 futura: su cumplimiento es 100 % (3 de 3), no 75 % (3 de 4). Si las futuras contaran, un programa que va perfecto pero apenas arranca aparecería reprobado.',
      'Cuando un programa no tiene ninguna sesión dictada, el cumplimiento no es 0 %: no está definido, y el panel muestra un guion.',
    ],
  },
  {
    id: 'c-columna-dia',
    titulo: 'Una columna por día, varias sesiones por día',
    resumen: 'El detalle que más distorsiona los cálculos si se ignora.',
    cuerpo: [
      'El CONSOLIDADO trae una columna por día (o por día y jornada), mientras el cronograma puede tener varias sesiones ese mismo día. Cuidado de Heridas, por ejemplo, tiene 4 sesiones el 24 de julio y una sola columna «24 T».',
      'Consecuencia 1: varias sesiones comparten la misma columna, así que las cuatro quedan tabuladas o pendientes juntas. No es posible tabular la sesión 2 del 24 de julio sin tabular las otras tres.',
      'Consecuencia 2: al sumar las horas de inasistencia de un participante, cada columna se cuenta UNA sola vez. Sumarla por sesión multiplicaría sus faltas de ese día por cuatro y lo pondría en riesgo sin motivo.',
      'Cuando sí hay dos columnas para la misma fecha, se desempata por jornada: la letra T (tarde) o M (mañana) del encabezado contra la hora de inicio de la sesión.',
    ],
  },
  {
    id: 'c-riesgo',
    titulo: 'Riesgo académico',
    resumen: 'Quién pierde el derecho al certificado.',
    formula: 'en_riesgo = total_inasistencia > horas_falla_max',
    cuerpo: [
      'Cada programa declara en su CONSOLIDADO cuántas horas de falla tolera. Si la inasistencia acumulada del participante supera ese tope, pierde el derecho al certificado.',
      'El total se recalcula desde los registros de asistencia, no se copia de la columna Σ del Excel: así se detecta si el archivo tiene la suma mal. Cuando el recalculado no coincide con el del archivo, queda registrado como aviso de calidad de datos.',
      'Es una foto parcial mientras el programa siga en curso: sólo cuenta lo tabulado hasta ahora. Un participante puede pasar a estar en riesgo cuando se carguen las sesiones pendientes.',
    ],
  },
  {
    id: 'c-jornada',
    titulo: 'Jornada y modalidad',
    resumen: 'Dos campos derivados, no leídos.',
    cuerpo: [
      'La jornada sale de la hora de inicio: antes de las 12:00 es mañana, desde las 12:00 es tarde. Sirve para desempatar cuando hay dos columnas del CONSOLIDADO para el mismo día.',
      'La modalidad se normaliza desde el texto libre de la columna «Salón», que en la práctica se usa para anotar el tipo de clase. Si el cronograma no trae esa columna, se usa el campo «MODALIDAD» de FORMAS DE PAGO.',
    ],
    tabla: {
      encabezados: ['Texto en el Excel', 'Modalidad normalizada'],
      filas: [
        ['PRESENCIAL', 'Presencial'],
        ['VIRTUAL', 'Virtual'],
        ['REMOTO', 'Remoto'],
        ['PRESENCIAL-VIRTUAL, Blended', 'Híbrido'],
        ['Trabajo Independiente', 'Trabajo Independiente'],
        ['PRESENCIAL-HOSPITAL…', 'Práctica'],
      ],
    },
  },
]

/* ───────────────────────── diccionario de datos ───────────────────────── */

export const TABLAS: TablaDoc[] = [
  {
    id: 't-sesiones',
    nombre: 'Sesiones',
    grano: 'Una fila por sesión de clase',
    proposito:
      'La tabla central del panel. Todo lo que se ve en Resumen, Semanal y Control de tabulación sale de aquí.',
    campos: [
      {
        campo: 'id_sesion',
        tipo: 'texto',
        descripcion: 'Identificador único de la sesión.',
        origen: 'Se arma como programa_id + número de sesión.',
        ejemplo: 'HERIDAS-07',
        nota: 'Si el cronograma repite un número de sesión, se le añade un sufijo para no perder la fila.',
      },
      {
        campo: 'programa_id',
        tipo: 'texto',
        descripcion: 'Código corto del programa al que pertenece.',
        origen: 'Derivado del nombre de la carpeta o del archivo.',
        ejemplo: 'HERIDAS',
      },
      {
        campo: 'programa',
        tipo: 'texto',
        descripcion: 'Nombre corto y legible del programa.',
        origen: 'Derivado del nombre de la carpeta.',
        ejemplo: 'Cuidado de Heridas',
      },
      {
        campo: 'num_sesion',
        tipo: 'entero',
        descripcion: 'Número de la sesión dentro del programa.',
        origen: 'Cronograma, columna «Sesión».',
        ejemplo: '7',
        nota: 'No siempre es correlativo ni sigue el orden de las fechas: Odontología salta números y trae dos sesiones al final del archivo. El panel siempre ordena por fecha, no por este número.',
      },
      {
        campo: 'modulo',
        tipo: 'texto',
        descripcion: 'Nombre del módulo o tema de la sesión.',
        origen: 'Cronograma, columna «Nombre del módulo».',
        ejemplo: 'Valoración de heridas',
        nota: 'No todos los cronogramas la traen; en esos casos queda vacío.',
      },
      {
        campo: 'fecha',
        tipo: 'fecha',
        descripcion: 'Día en que se dicta la sesión.',
        origen: 'Cronograma, columna «Fecha».',
        ejemplo: '2026-07-31',
        nota: 'Es el dato con el que se cruza contra el CONSOLIDADO y contra la fecha de corte.',
      },
      {
        campo: 'hora_inicio · hora_fin',
        tipo: 'texto HH:MM',
        descripcion: 'Horario de la sesión.',
        origen: 'Cronograma, columnas «Hora Inicio» y «Hora Fin».',
        ejemplo: '14:00 – 19:00',
        nota: 'Hay cronogramas con horas invertidas o en 00:00. Se conservan tal cual y quedan marcadas en observaciones: corregirlas sería inventar datos.',
      },
      {
        campo: 'intensidad_horaria',
        tipo: 'número',
        descripcion: 'Horas que dura la sesión.',
        origen: 'Cronograma, columna «Intensidad horaria por sesión».',
        ejemplo: '5',
        nota: 'Es el umbral con el que se decide si un participante asistió: se compara contra sus horas de inasistencia.',
      },
      {
        campo: 'jornada',
        tipo: 'Mañana | Tarde',
        descripcion: 'Franja del día en que ocurre la sesión.',
        origen: 'Derivado: mañana si la hora de inicio es anterior a las 12:00.',
        ejemplo: 'Tarde',
      },
      {
        campo: 'modalidad',
        tipo: 'texto normalizado',
        descripcion: 'Cómo se dicta la clase.',
        origen: 'Normalizada desde «Salón» del cronograma; si falta, desde «MODALIDAD» de FORMAS DE PAGO.',
        ejemplo: 'Híbrido',
        nota: 'Valores posibles: Presencial, Virtual, Remoto, Híbrido, Trabajo Independiente, Práctica.',
      },
      {
        campo: 'salon',
        tipo: 'texto',
        descripcion: 'El texto original de la columna «Salón», sin normalizar.',
        origen: 'Cronograma, columna «Salón».',
        ejemplo: 'PRESENCIAL-HOSPITAL UNIVERSIDAD DEL NORTE',
        nota: 'Se conserva porque a veces trae información de lugar que la modalidad normalizada pierde.',
      },
      {
        campo: 'docente',
        tipo: 'texto',
        descripcion: 'Quién dicta la sesión.',
        origen: 'Cronograma, columna «Nombre del docente».',
        ejemplo: 'Adriana Duque',
      },
      {
        campo: 'estado_sesion',
        tipo: 'Realizada | Hoy | Futura',
        descripcion: 'Ubicación de la sesión en el calendario respecto al corte.',
        origen: 'Derivado: comparación de la fecha contra la fecha de corte.',
        ejemplo: 'Realizada',
        nota: 'Es puro calendario. No dice nada sobre si la asistencia está cargada.',
      },
      {
        campo: 'estado_seguimiento',
        tipo: 'Tabulada | Pendiente de tabular | Futura no exigible',
        descripcion: 'El estado administrativo de la sesión: el corazón del panel.',
        origen: 'Derivado: si la columna del CONSOLIDADO tiene datos, y si la fecha ya pasó.',
        ejemplo: 'Pendiente de tabular',
        nota: 'No confundir con estado_sesion. Una sesión «Realizada» puede estar tabulada o pendiente; ahí está el hallazgo.',
      },
      {
        campo: 'asistencia_tabulada',
        tipo: 'Sí | No | N/A',
        descripcion: 'Versión corta del estado de seguimiento.',
        origen: 'Derivado: Sí = tabulada, No = pendiente, N/A = futura no exigible.',
        ejemplo: 'No',
        nota: 'Las futuras usan N/A y no «No» para que no se lean como incumplimiento en un tablero.',
      },
      {
        campo: 'dias_atraso',
        tipo: 'entero',
        descripcion: 'Días transcurridos desde la sesión hasta la fecha de corte.',
        origen: 'Derivado. Es 0 si la sesión aún no ha ocurrido.',
        ejemplo: '11',
        nota: 'Días calendario, sin descontar fines de semana ni festivos.',
      },
      {
        campo: 'n_participantes',
        tipo: 'entero',
        descripcion: 'Participantes inscritos que declara el programa.',
        origen: 'FORMAS DE PAGO, etiqueta «NÚMERO DE PARTICIANTES».',
        ejemplo: '35',
        nota: 'Es el número declarado, y en varios cursos no coincide con las filas reales del CONSOLIDADO. Para tasas de asistencia el panel usa el conteo real.',
      },
      {
        campo: 'n_asistentes',
        tipo: 'entero',
        descripcion: 'Participantes que asistieron a esa sesión.',
        origen: 'Calculado: los que tienen horas de inasistencia menores que la intensidad.',
        ejemplo: '33',
        nota: 'Sólo existe si la sesión está tabulada. En las demás queda vacío a propósito.',
      },
      {
        campo: 'n_inasistentes',
        tipo: 'entero',
        descripcion: 'Participantes que faltaron a esa sesión.',
        origen: 'Calculado: los que tienen horas de inasistencia iguales o mayores que la intensidad.',
        ejemplo: '2',
      },
      {
        campo: 'observaciones',
        tipo: 'lista de texto',
        descripcion: 'Banderas de calidad de datos de esa fila.',
        origen: 'Generadas durante la importación.',
        ejemplo: 'la hora de fin es anterior a la de inicio; sin columna en el CONSOLIDADO',
        nota: 'Es la trazabilidad: explica por qué una sesión concreta quedó como quedó.',
      },
    ],
  },
  {
    id: 't-programas',
    nombre: 'Programas',
    grano: 'Una fila por programa (curso o diplomado)',
    proposito:
      'Los metadatos administrativos de cada curso y sus agregados de seguimiento.',
    campos: [
      { campo: 'programa_id', tipo: 'texto', descripcion: 'Código corto único del programa.', origen: 'Derivado del nombre de la carpeta.', ejemplo: 'ECOGRAFIA' },
      { campo: 'programa', tipo: 'texto', descripcion: 'Nombre corto para mostrar en tablas y gráficos.', origen: 'Derivado del nombre de la carpeta.', ejemplo: 'Ecografía Clínica' },
      { campo: 'nombre_oficial', tipo: 'texto', descripcion: 'Nombre completo del curso, como aparece en los documentos.', origen: 'FORMAS DE PAGO, «NOMBRE DEL CURSO».', ejemplo: 'Diplomado Ecografía Clínica POCUS' },
      { campo: 'nrc', tipo: 'texto', descripcion: 'Número de referencia del curso en Banner.', origen: 'FORMAS DE PAGO, «NRC:».', ejemplo: '1192' },
      { campo: 'cod_banner', tipo: 'texto', descripcion: 'Código del programa en Banner.', origen: 'FORMAS DE PAGO, «COD BANNER:».', ejemplo: 'CLI9975' },
      { campo: 'codigo_contable', tipo: 'texto', descripcion: 'Centro de costo contable.', origen: 'FORMAS DE PAGO, «CODIGO CONTABLE:».', ejemplo: '72A429' },
      { campo: 'coordinador', tipo: 'texto', descripcion: 'Quién coordina el programa desde el CEC.', origen: 'FORMAS DE PAGO, «COORDINADOR:».', ejemplo: 'Elena Zapata' },
      { campo: 'experto_facilitador', tipo: 'texto', descripcion: 'Docente principal o experto responsable del contenido.', origen: 'FORMAS DE PAGO, «EXPERTO FACILITADOR:».', ejemplo: 'Santiago Quintero' },
      { campo: 'entidad_convenio', tipo: 'texto', descripcion: 'Empresa o entidad con la que se ejecuta el programa.', origen: 'FORMAS DE PAGO, «ENTIDAD CONVENIO:».', ejemplo: 'MOLNLYCKE', nota: 'Vacío en los programas abiertos al público.' },
      { campo: 'modalidad', tipo: 'texto normalizado', descripcion: 'Modalidad predominante del programa.', origen: 'La más frecuente entre sus sesiones.', ejemplo: 'Remoto' },
      { campo: 'valor_programa', tipo: 'número', descripcion: 'Precio del programa en pesos.', origen: 'FORMAS DE PAGO, «VALOR DEL PROGRAMA:».', ejemplo: '3800000' },
      { campo: 'n_participantes', tipo: 'entero', descripcion: 'Participantes declarados.', origen: 'FORMAS DE PAGO, «NÚMERO DE PARTICIANTES».', ejemplo: '22' },
      { campo: 'n_participantes_reales', tipo: 'entero', descripcion: 'Filas de participante que realmente tiene el CONSOLIDADO.', origen: 'Conteo directo.', ejemplo: '22', nota: 'Cuando difiere del declarado, queda un aviso de calidad de datos. Este es el que usan las tasas de asistencia.' },
      { campo: 'horas_totales', tipo: 'número', descripcion: 'Duración total del programa en horas.', origen: 'CONSOLIDADO, «NÚMERO DE HORAS».', ejemplo: '90' },
      { campo: 'horas_falla_max', tipo: 'número', descripcion: 'Tope de horas de inasistencia que tolera el programa.', origen: 'CONSOLIDADO, «NÚMERO DE HORAS DE FALLAS MÁXIMAS PERMITIDAS».', ejemplo: '20', nota: 'Sin este dato no se puede evaluar el riesgo académico del curso.' },
      { campo: 'fecha_inicio · fecha_fin', tipo: 'fecha', descripcion: 'Primera y última sesión del programa.', origen: 'Mínimo y máximo de las fechas de sus sesiones.', ejemplo: '2026-07-28 → 2026-10-03' },
      { campo: 'n_sesiones', tipo: 'entero', descripcion: 'Total de sesiones del cronograma.', origen: 'Conteo.', ejemplo: '22' },
      { campo: 'n_sesiones_realizadas', tipo: 'entero', descripcion: 'Sesiones cuya fecha ya pasó (o es hoy).', origen: 'Derivado del corte. Equivale a tabuladas + pendientes.', ejemplo: '7' },
      { campo: 'n_sesiones_tabuladas', tipo: 'entero', descripcion: 'Sesiones con la asistencia cargada.', origen: 'Conteo por estado de seguimiento.', ejemplo: '6' },
      { campo: 'n_sesiones_pendientes', tipo: 'entero', descripcion: 'Sesiones dictadas y sin cargar.', origen: 'Conteo por estado de seguimiento.', ejemplo: '1' },
      { campo: 'n_sesiones_futuras', tipo: 'entero', descripcion: 'Sesiones que aún no ocurren.', origen: 'Conteo por estado de seguimiento.', ejemplo: '15' },
      { campo: 'pct_cumplimiento_tabulacion', tipo: 'número 0–1', descripcion: 'Proporción de sesiones dictadas que ya están tabuladas.', origen: 'tabuladas ÷ realizadas.', ejemplo: '0,857', nota: 'Vacío si el programa aún no ha dictado ninguna sesión.' },
      { campo: 'estado_programa', tipo: 'Por iniciar | En ejecución | Finalizado', descripcion: 'Dónde está el programa respecto a la fecha de corte.', origen: 'Derivado comparando el corte con fecha_inicio y fecha_fin.', ejemplo: 'En ejecución' },
      { campo: 'n_en_riesgo', tipo: 'entero', descripcion: 'Participantes del programa que superaron el tope de fallas.', origen: 'Conteo.', ejemplo: '2' },
      { campo: 'n_evidencias', tipo: 'entero', descripcion: 'Archivos de evidencia fotográfica cargados para el programa.', origen: 'Conteo de imágenes en «Equipo Logístico/Evidencia Fotográfica».', ejemplo: '12', nota: 'Es el tercer proceso que controla el equipo logístico, junto al cronograma y los listados. Se cuenta por programa y no por sesión porque los nombres de archivo no dicen a qué clase pertenece cada foto.' },
      { campo: 'origen', tipo: 'texto', descripcion: 'Archivos de los que se importó el curso.', origen: 'Nombres de los Excel cargados.', ejemplo: 'Cronograma_Ecografía.xlsx + GUECFT061_….xlsx', nota: 'Trazabilidad: permite saber de qué archivo salió cada curso.' },
    ],
  },
  {
    id: 't-asistencia',
    nombre: 'Asistencia',
    grano: 'Una fila por participante y sesión tabulada',
    proposito:
      'La capa académica de detalle. Sólo existe para las sesiones que ya tienen datos cargados: de las demás no hay nada que registrar.',
    campos: [
      { campo: 'id_registro', tipo: 'texto', descripcion: 'Identificador único del registro.', origen: 'id_sesion + documento.', ejemplo: 'HERIDAS-05|900000015' },
      { campo: 'id_sesion', tipo: 'texto', descripcion: 'Sesión a la que corresponde.', origen: 'Enlace a la tabla de sesiones.', ejemplo: 'HERIDAS-05' },
      { campo: 'fecha', tipo: 'fecha', descripcion: 'Fecha de la sesión.', origen: 'Copiada de la sesión.', ejemplo: '2026-07-25' },
      { campo: 'documento', tipo: 'texto', descripcion: 'Documento de identidad del participante.', origen: 'CONSOLIDADO, «DOCUMENTO DE IDENTIDAD».', ejemplo: '900000015', nota: 'Cuando el Excel trae «12345 /67890» se toma el primer número: el segundo suele ser el código Banner.' },
      { campo: 'nombre · empresa', tipo: 'texto', descripcion: 'Datos del participante.', origen: 'CONSOLIDADO, columnas «NOMBRE» y «EMPRESA».', ejemplo: 'Adriana Betancur · MOLNLYCKE' },
      { campo: 'horas_inasistencia', tipo: 'número', descripcion: 'Horas que el participante faltó a esa sesión.', origen: 'El valor de la celda del CONSOLIDADO.', ejemplo: '0', nota: 'Cero significa que asistió completo. Es inasistencia, no asistencia.' },
      { campo: 'asistio', tipo: 'booleano', descripcion: 'Si se considera que asistió a la sesión.', origen: 'Calculado: horas_inasistencia menor que la intensidad de la sesión.', ejemplo: 'Sí' },
      { campo: 'columna', tipo: 'entero', descripcion: 'Columna del CONSOLIDADO de la que salió el valor.', origen: 'Índice interno.', ejemplo: '5', nota: 'Es lo que permite no contar dos veces la misma falta cuando varias sesiones comparten columna.' },
      { campo: 'cuenta_en_total', tipo: 'booleano', descripcion: 'Marca la única fila de cada participante y columna que debe sumarse.', origen: 'Calculado al importar.', ejemplo: 'Sí', nota: 'Sin filtrar por este campo, sumar las horas infla el total: la misma inasistencia se repite en cada sesión que comparte columna (un 133 % de más en Cuidado de Heridas). La medida correcta filtra cuenta_en_total = verdadero.' },
    ],
  },
  {
    id: 't-participantes',
    nombre: 'Participantes',
    grano: 'Una fila por participante y programa',
    proposito: 'El resumen académico de cada persona: cuánto ha faltado y si eso ya le cuesta el certificado.',
    campos: [
      { campo: 'documento', tipo: 'texto', descripcion: 'Documento de identidad.', origen: 'CONSOLIDADO.', ejemplo: '900000042' },
      { campo: 'nombre', tipo: 'texto', descripcion: 'Nombre completo, como está en el listado.', origen: 'CONSOLIDADO.', ejemplo: 'Camila Restrepo' },
      { campo: 'empresa', tipo: 'texto', descripcion: 'Empresa que lo patrocina, si aplica.', origen: 'CONSOLIDADO.', ejemplo: 'MOLNLYCKE' },
      { campo: 'total_inasistencia', tipo: 'número', descripcion: 'Horas de falta acumuladas en todo el programa.', origen: 'Suma de sus registros de asistencia, contando cada columna una sola vez.', ejemplo: '36', nota: 'Se recalcula en vez de copiar la columna Σ del Excel, para poder detectar sumas mal hechas en el archivo.' },
      { campo: 'horas_falla_max', tipo: 'número', descripcion: 'Tope de faltas de su programa.', origen: 'CONSOLIDADO del programa.', ejemplo: '9' },
      { campo: 'en_riesgo', tipo: 'booleano', descripcion: 'Si ya superó el tope y perdió el derecho al certificado.', origen: 'total_inasistencia mayor que horas_falla_max.', ejemplo: 'Sí' },
    ],
  },
  {
    id: 't-calendario',
    nombre: 'Calendario',
    grano: 'Una fila por día, desde la primera hasta la última sesión',
    proposito:
      'La dimensión de tiempo. En Power BI es la que permite filtrar por semana o mes; en la app sostiene la vista semanal. Cubre años completos (1 de enero a 31 de diciembre), no sólo el rango de las sesiones, porque la inteligencia de tiempo de Power BI lo exige.',
    campos: [
      { campo: 'fecha', tipo: 'fecha', descripcion: 'El día.', origen: 'Generado.', ejemplo: '2026-08-11' },
      { campo: 'anio · mes · dia', tipo: 'entero', descripcion: 'Partes de la fecha.', origen: 'Derivado.', ejemplo: '2026 · 8 · 11' },
      { campo: 'mes_nombre', tipo: 'texto', descripcion: 'Nombre del mes en español.', origen: 'Derivado.', ejemplo: 'Agosto' },
      { campo: 'dia_semana', tipo: 'texto', descripcion: 'Nombre del día.', origen: 'Derivado.', ejemplo: 'Martes' },
      { campo: 'dia_semana_num', tipo: 'entero 1–7', descripcion: 'Día de la semana, lunes = 1.', origen: 'Derivado (norma ISO).', ejemplo: '2' },
      { campo: 'semana_iso', tipo: 'entero', descripcion: 'Número de semana del año según ISO 8601.', origen: 'Derivado.', ejemplo: '33', nota: 'Las semanas empiezan en lunes; la semana 1 es la que contiene el primer jueves del año.' },
      { campo: 'anio_semana', tipo: 'texto', descripcion: 'Año y semana juntos, para ordenar sin ambigüedad.', origen: 'Derivado.', ejemplo: '2026-W33' },
      { campo: 'es_fin_de_semana', tipo: 'booleano', descripcion: 'Si el día es sábado o domingo.', origen: 'Derivado.', ejemplo: 'No', nota: 'En el CEC muchas clases son sábado: no implica que no haya actividad.' },
    ],
  },
]

/* ───────────────────────── origen de los archivos ───────────────────────── */

export const FUENTES = [
  {
    id: 'f-cronograma',
    archivo: 'Cronograma_*.xlsx',
    hoja: 'Nombre variable — se detecta por sus encabezados',
    aporta: 'Las sesiones: cuándo, cuánto dura, quién dicta, en qué modalidad.',
    detalle:
      'El nombre de la hoja cambia entre archivos (owssvr, owssvr (1), owssvr - 2026-08-11T…), así que no se busca por nombre: se recorre el libro y se toma la hoja cuya primera fila tenga «Sesión» y «Fecha». Las columnas se mapean por su encabezado, no por posición, así que pueden venir en cualquier orden y sobrar columnas.',
    columnas: [
      ['Sesión', 'num_sesion', 'Obligatoria'],
      ['Fecha', 'fecha', 'Obligatoria'],
      ['Hora Inicio · Hora Fin', 'horario y jornada', 'Obligatorias'],
      ['Intensidad horaria por sesión', 'intensidad_horaria', 'Obligatoria'],
      ['Nombre del módulo', 'modulo', 'Opcional'],
      ['Salón', 'modalidad', 'Opcional'],
      ['Nombre del docente', 'docente', 'Opcional'],
    ],
  },
  {
    id: 'f-formas',
    archivo: '*ListadodeParticipantes*.xlsx',
    hoja: 'FORMAS DE PAGO',
    aporta: 'Los metadatos administrativos del programa.',
    detalle:
      'Cada dato se localiza buscando el texto de su etiqueta y tomando el primer valor no vacío a su derecha, porque la maquetación varía entre archivos. La búsqueda se corta donde empieza la tabla de participantes: más abajo hay encabezados como «CODIGO BANNER» que colisionan con las etiquetas.',
    columnas: [
      ['NOMBRE DEL CURSO', 'nombre_oficial', ''],
      ['NRC: · COD BANNER: · CODIGO CONTABLE:', 'códigos administrativos', ''],
      ['COORDINADOR: · EXPERTO FACILITADOR:', 'responsables', ''],
      ['ENTIDAD CONVENIO: · MODALIDAD:', 'contexto del programa', ''],
      ['VALOR DEL PROGRAMA:', 'valor_programa', ''],
      ['NÚMERO DE PARTICIANTES', 'n_participantes', 'La etiqueta tiene ese error de escritura en la plantilla original'],
    ],
  },
  {
    id: 'f-consolidado',
    archivo: '*ListadodeParticipantes*.xlsx',
    hoja: 'CONSOLIDADO',
    aporta: 'La asistencia real y el tope de fallas.',
    detalle:
      'Es la hoja que sostiene el panel. Tiene una fila «Mes:» con celdas combinadas que agrupa las columnas por mes, una fila de encabezados con una columna por sesión, y una fila por participante. La hoja «LISTADO DE ASISTENCIA» es sólo el formato en blanco para firmar: no se usa como fuente.',
    columnas: [
      ['NÚMERO DE HORAS', 'horas_totales', 'En la cabecera'],
      ['NÚMERO DE HORAS DE FALLAS MÁXIMAS PERMITIDAS', 'horas_falla_max', 'En la cabecera'],
      ['Fila «Mes:»', 'mes de cada bloque de columnas', 'Combinada: el mes se propaga hacia la derecha'],
      ['NOMBRE · DOCUMENTO DE IDENTIDAD · EMPRESA · CORREO', 'datos del participante', ''],
      ['Columnas de sesión', 'horas de inasistencia', 'Encabezado: fecha completa, o día + jornada («24 T»)'],
      ['Σ de inasistencia', 'total declarado', 'El panel lo recalcula y avisa si no coincide'],
    ],
  },
]

/* ───────────────────────── calidad de datos ───────────────────────── */

export const CALIDAD = [
  {
    severidad: 'error' as const,
    titulo: 'Errores — bloquean la importación',
    descripcion: 'Sin estos datos no se puede construir nada fiable, así que el curso no entra.',
    casos: [
      'Falta la hoja CONSOLIDADO: no hay de dónde sacar la asistencia.',
      'No aparece la columna «Fecha» o «Sesión» en el cronograma.',
      'Una fecha de sesión no se puede interpretar.',
      'El archivo no es un Excel, está dañado, o no se reconoce como cronograma ni como listado.',
      'El CONSOLIDADO no tiene ninguna fila de participante legible.',
    ],
  },
  {
    severidad: 'aviso' as const,
    titulo: 'Avisos — el curso se importa igual',
    descripcion: 'Son inconsistencias reales de los archivos fuente. El panel las conserva y las marca en vez de corregirlas por su cuenta.',
    casos: [
      'Año equivocado en los metadatos: mandan las fechas del cronograma.',
      'Horas invertidas (fin antes que inicio) o en 00:00.',
      'Sesiones fuera de orden o con numeración no correlativa.',
      'Encabezado de columna con jornada no reconocida (debe ser T o M).',
      'Columnas del CONSOLIDADO que no corresponden a ninguna sesión, o sesiones sin columna.',
      'El número de participantes declarado no coincide con las filas reales.',
      'La suma de intensidad horaria del cronograma no cuadra con las horas totales declaradas.',
      'El Σ de inasistencia del archivo no coincide con el recalculado.',
    ],
  },
]
