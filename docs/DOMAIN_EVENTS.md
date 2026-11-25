# Eventos de dominio e integración

Los agregados producen hechos al completar una transición. `ms-usuarios` y `ms-transacciones` publican los hechos que necesita otro contexto. `ms-transacciones` tiene la autoridad sobre saldos, compromisos e indicadores. `ms-notificaciones` procesa eventos y aplica sus reglas con observaciones de los propietarios recibidas por Kafka. La topología y el contrato de observación pendiente se describen en [Topología](TOPOLOGY.md#comunicación-asíncrona) y [ADR-04](ARCHITECTURE_DECISIONS.md#adr-04-eventos-y-evaluación-de-alertas).

## Transporte y contrato común

| Tópico propuesto | Productor | Consumidor MVP | Clave de partición |
| --- | --- | --- | --- |
| `billetera.usuarios.eventos.v1` | `ms-usuarios` | `ms-transacciones`, `ms-notificaciones` | `usuarioId` |
| `billetera.finanzas.eventos.v1` | `ms-transacciones` | `ms-notificaciones` | `usuarioId` |

Cada mensaje usa un sobre JSON con estos campos. Los campos obligatorios tienen valor y el esquema define por tipo cuáles son opcionales en `datos`.

| Campo | Tipo | Semántica |
| --- | --- | --- |
| `eventoId` | UUID | Identidad estable del hecho. Un reenvío conserva el valor. |
| `tipo` | string | Nombre del hecho ocurrido. |
| `versionEsquema` | int32 | Versión del contrato del tipo. Empieza en `1`. |
| `ocurridoEn` | timestamp UTC | Instante asignado a la transición en origen. |
| `usuarioId` | UUID | Propietario de los datos y clave de partición. |
| `agregadoTipo`, `agregadoId` | string, UUID | Tipo y referencia de la raíz que origina el hecho. |
| `correlacionId` | UUID | Identificador del comando o proceso. Relaciona hechos de la misma operación. |
| `datos` | objeto | Campos del tipo de evento. Usa fecha `AAAA-MM-DD` y mes `AAAA-MM`. |

Los datos monetarios que se incorporen a un contrato se codifican como pesos CLP en texto decimal, con moneda explícita. Los contratos iniciales de alertas usan referencias y fechas, con exclusión de correo, credenciales y texto libre. Los consumidores toleran campos adicionales opcionales de la misma versión. Los cambios incompatibles requieren una versión nueva y un período de compatibilidad acordado antes del cambio.

## Catálogo de publicación v1

Los campos de `datos` se agregan a `agregadoId` y `usuarioId`, que viajan en el sobre. La columna de efecto esperado describe qué dispara el hecho. El catálogo describe el diseño previsto. Notificaciones aplica las reglas vigentes de [RN-11](BUSINESS_RULES.md#alertas-y-asistencia).

| `tipo` | Raíz | `datos` | Condición de emisión | Efecto esperado |
| --- | --- | --- | --- | --- |
| `UsuarioRegistrado` | `Usuario` | `{}` | Identidad y preferencias iniciales confirmadas. | Habilitar reglas predeterminadas con una inserción que respeta personalizaciones existentes. |
| `PreferenciasActualizadas` | `Usuario` | `versionPreferencias: int64` como texto decimal, `zonaHorariaCambio: bool` | Se guardó un cambio efectivo de preferencias. | Si cambió la zona, reevaluar vencimientos y presupuesto del mes local aplicable. |
| `MovimientoEfectivoRegistrado` | `Movimiento` | `tipoMovimiento: INGRESO o GASTO`, `categoriaId: UUID`, `fechaEfectiva: FechaLocal`, `origen: MANUAL o COMPROMISO` | Se registró un ingreso o gasto efectivo. | Para un gasto, evaluar presupuesto de la categoría y el mes que corresponde a la fecha. |
| `MovimientoAnulado` | `Movimiento` | `tipoMovimiento: INGRESO o GASTO`, `categoriaId: UUID`, `fechaEfectiva: FechaLocal` | Se anuló un movimiento manual vigente. | Para un gasto, volver a evaluar la categoría y el mes. |
| `MovimientoReclasificado` | `Movimiento` | `tipoMovimiento: INGRESO o GASTO`, `categoriaAnteriorId: UUID`, `categoriaNuevaId: UUID`, `fechaEfectiva: FechaLocal` | Cambió la categoría de un ingreso o gasto vigente. | Para un gasto, evaluar las dos categorías en el mes correspondiente. |
| `PresupuestoCreado` | `Presupuesto` | `categoriaId: UUID`, `periodo: MesCalendario` | Se creó un presupuesto. | Evaluar si el gasto acumulado ya alcanza el umbral aplicable. |
| `PresupuestoActualizado` | `Presupuesto` | `categoriaId: UUID`, `periodo: MesCalendario` | Cambió su límite. | Comparar el gasto acumulado con el límite vigente. |
| `CompromisoCreado` | `CompromisoFinanciero` | `versionAgregado: int64` como texto decimal, `fechaVencimiento: FechaLocal` | Se registró un compromiso pendiente. | Evaluar si un compromiso ya está dentro de la ventana de aviso o vencido. |
| `CompromisoActualizado` | `CompromisoFinanciero` | `versionAgregado: int64` como texto decimal, `fechaVencimiento: FechaLocal` | Cambió un compromiso pendiente. | Usar la observación válida más reciente y su vencimiento para determinar la clave. |
| `CompromisoConfirmado` | `CompromisoFinanciero` | `versionAgregado: int64` como texto decimal, `movimientoId: UUID`, `fechaEfectiva: FechaLocal` | Confirmación y alta del movimiento comprometidas juntas. | Excluir el compromiso de evaluaciones de aviso si su estado vigente es terminal. |
| `CompromisoCancelado` | `CompromisoFinanciero` | `versionAgregado: int64` como texto decimal, `fechaCancelacion: FechaLocal` | Se canceló el compromiso. | Excluir el compromiso de evaluaciones de aviso si su estado vigente es terminal. |

La confirmación crea dos hechos publicables con la misma correlación y distintos `eventoId`. El evento del compromiso atiende su vencimiento. El evento del movimiento atiende el consumo presupuestario si es un gasto. Las transferencias, sus anulaciones y la reserva o liberación de ahorro producen cambios atómicos locales. Los hechos locales `TransferenciaRegistrada`, `TransferenciaAnulada`, `AhorroReservado` y `AhorroLiberado` quedan dentro de `ms-transacciones` durante el MVP. Altas y cambios de cuenta, nombres de categorías, marcas de gasto hormiga y lecturas de la bandeja también se resuelven en su servicio propietario.

## Entrega y deduplicación

1. El productor guarda el cambio y su outbox en una transacción de PostgreSQL. Un publicador reintenta los mensajes pendientes hasta recibir confirmación de Kafka y registra la publicación. Si el publicador cae antes de registrar el envío, puede reenviar el mismo `eventoId`.
2. Notificaciones trabaja con entrega al menos una vez. Evalúa la observación disponible según la política de frescura acordada y ejecuta en una transacción local el registro de `EventoProcesado`, la personalización predeterminada que proceda y las inserciones de notificaciones. Confirma el offset de Kafka después del commit local. Una repetición de `(consumidor, eventoId)` se reconoce sin aplicar otra vez el efecto. [Semántica de entrega de Apache Kafka](https://kafka.apache.org/41/design/design/#message-delivery-semantics)
3. La comprobación dentro de la transacción también usa una unicidad por `(usuarioId, claveDeduplicacion)`. Para presupuesto la clave lógica reúne `PRESUPUESTO_UMBRAL`, `presupuestoId`, `periodo` y `umbral`. Para compromisos reúne `tipoDeAlerta`, `compromisoId` y `fechaVencimiento`. Eventos diferentes y evaluaciones programadas compiten por la misma clave sin duplicar el aviso. Cambiar una regla y volver a su valor anterior conserva las claves previas.
4. Cada tópico tiene orden por partición. El diseño debe tolerar reenvíos y diferencias de orden entre tópicos mediante versiones de agregado, fecha de observación y claves de negocio. Un evento antiguo no vuelve a aplicar los datos de su carga como si fueran una nueva transición.
5. Un fallo transitorio conserva el trabajo pendiente y se reintenta con espera acotada entre intentos. Un mensaje inválido se aísla en una cola de errores con diagnóstico y acceso restringido. El offset puede avanzar tras registrar de forma durable ese fallo. Un reproceso controlado conserva el `eventoId`. La retención debe cubrir el horizonte admitido de reprocesos al configurar Kafka e inbox.

## Evaluación programada y consistencia

La propuesta es que `ms-transacciones` observe candidatos cuando cambie el estado financiero o transcurra un intervalo de reconciliación, sugerido inicialmente cada hora. Usa su propia base y las preferencias de `ms-usuarios` obtenidas por los canales autorizados. Las observaciones llegan por Kafka a `ms-notificaciones`, que aplica las reglas personales. Si la última observación utilizable indica que la condición dejó de cumplirse, el aviso se omite. La reconciliación comparte las mismas claves de negocio que el consumidor.

Quedan por acordar cómo renovar observaciones ante cambios de regla, cambios de zona horaria o ausencia de eventos, y cómo diferir evaluaciones basadas en datos obsoletos. Un aviso histórico puede reflejar una condición que cambió después de la observación. La consulta del recurso por el BFF muestra su estado actual. El contrato debe validarse contra los casos de aceptación de RN-11 antes de implementar las alertas. [ADR-04](ARCHITECTURE_DECISIONS.md#adr-04-eventos-y-evaluación-de-alertas)
## Propuesta de eventos de consumo presupuestario

El frontend calcula avisos de demostración a partir del estado actual. La propuesta para la integración definitiva usa `ms-transacciones` como productor y `ms-notificaciones` como consumidor. Los nombres representan tipos de evento versionados propuestos. La asignación a tópicos y la relación con el catálogo v1 existente quedan pendientes de aprobación.

| Tipo propuesto | Condición |
| --- | --- |
| `finance.budget.threshold_reached.v1` | El gasto efectivo de la categoría alcanza el umbral pertinente durante el mes del presupuesto. |
| `finance.budget.limit_reached.v1` | El consumo equivale exactamente al límite. Este evento adicional permite mostrar el estado de límite alcanzado. |
| `finance.budget.exceeded.v1` | El consumo supera el límite. |

La carga propuesta incluye `presupuestoId`, `categoriaId`, `periodo`, `moneda`, `limite`, `consumo` y, para el aviso correspondiente, `umbral`. Conserva el sobre común, la clave de partición por usuario y los montos como cadenas decimales en CLP. Queda por acordar la precedencia entre el umbral por presupuesto y la regla global, el comportamiento de los cruces saltados y la deduplicación por presupuesto, período, tipo de alerta y valor del umbral cuando aplique. El frontend consultará los avisos del usuario y actualizará su lectura a través del BFF GraphQL.

## Avisos de cobros y pagos

La demo deriva avisos del estado compartido. La arquitectura prevista usa `ms-transacciones`, Kafka para transportar eventos, `ms-notificaciones` en Java y `bff-graphql` para consultar avisos y registrar su lectura mediante GraphQL.

| Tipo | Estado del contrato | Condición y datos |
| --- | --- | --- |
| `finance.commitment.due.v1` | Evento ya definido | El pendiente entra en la ventana de vencimiento. El aviso usa la fecha local vigente y la referencia al compromiso. |
| `finance.commitment.overdue.v1` | Extensión propuesta | Se observa un pendiente después de su vencimiento en la zona del usuario. Datos propuestos `tipoCompromiso`, `fechaVencimiento`, `fechaLocalObservada` y `versionAgregado`. |
| `finance.commitment.confirmed.v1` | Extensión propuesta | `ms-transacciones` completa la confirmación y el alta del movimiento en la misma transacción. Datos propuestos `tipoCompromiso`, `movimientoId`, `fechaEfectiva` y `versionAgregado`. |

Quedan por acordar el evento de observación temporal, su relación con la evaluación periódica y la relación del evento de confirmación propuesto con `CompromisoConfirmado` del catálogo v1. Se propone deduplicar los vencimientos por usuario, compromiso, condición y fecha vigente y la confirmación por compromiso y movimiento. Las nuevas observaciones de `ms-transacciones` invalidan las candidaturas afectadas por reprogramación o cancelación. El riesgo de saldo insuficiente se deriva de la proyección autorizada. Queda por definir si se ofrece como aviso persistente y cómo se identifica una misma condición de riesgo.

## Avisos de metas de ahorro

La bandeja de la demo calcula avisos desde las metas y operaciones compartidas. La arquitectura prevista usa `ms-transacciones` para producir hechos, Kafka para su entrega y `ms-notificaciones` en Java para evaluar reglas y exponer avisos por gRPC a `bff-graphql`.

| Tipo | Estado del contrato | Condición y datos |
| --- | --- | --- |
| `finance.savings.goal_reached.v1` | Evento previamente definido | La reserva vigente alcanza el objetivo de la meta. |
| `finance.savings.milestone_reached.v1` | Extensión propuesta | El progreso cruza un hito configurable. Datos propuestos `hitoPorcentaje`, `fechaLocal` y `versionAgregado`. La demo muestra el último hito vigente entre 25, 50 y 75 %. |
| `finance.savings.goal_due.v1` | Extensión propuesta | La fecha objetivo de una meta abierta está próxima o vencida. Datos propuestos `fechaObjetivo`, `fechaLocalObservada`, `condicion` y `versionAgregado`. La demo considera próximos los siete días anteriores, incluido el día objetivo, y atrasado desde el día posterior. |

Quedan por acordar los hitos configurables, la política de reemisión al liberar y volver a alcanzar un objetivo, la ventana de aviso y la evaluación de cambios de fecha. Se propone deduplicar por usuario, meta y hito, y por usuario, meta, fecha objetivo y condición temporal. Las nuevas observaciones de `ms-transacciones` invalidan los avisos que aún sean candidatos si cambia la meta. Los escenarios hipotéticos se mantienen en el cliente en la demo.

## Eventos candidatos de Salud financiera

| Tipo propuesto | Condición candidata |
| --- | --- |
| `finance.health.risk_detected.v1` | Se inicia o cambia materialmente un episodio de riesgo observable, por ejemplo al aparecer un déficit de dinero libre con compromisos vinculados. |
| `finance.health.significant_change.v1` | La puntuación cruza un umbral de variación aprobado entre evaluaciones comparables de la misma versión y con cobertura suficiente. |

Las observaciones pueden incluir período, corte, versión de metodología y evaluación, tipo de riesgo, estado de calidad, referencia del recurso y valores mínimos para sustentar el aviso. Se propone deduplicar por usuario, episodio o par de cortes, tipo y versión. El umbral, las condiciones de comparabilidad, el control de reintentos y la asignación de tópicos quedan por aprobar. Los escenarios hipotéticos quedan fuera del flujo de eventos.

`ms-transacciones` publicaría observaciones en Kafka. `ms-notificaciones` las consumiría y aplicaría las preferencias del usuario antes de exponer los avisos a `bff-graphql` por gRPC. La bandeja del frontend consultaría GraphQL. La demo agrega una alerta local si el dinero libre proyectado cae bajo cero y el aviso de flujo existente todavía no representa el episodio.
