# Eventos de dominio e integración

Los agregados producen hechos al completar una transición. Los productores publican a Kafka los hechos requeridos por otro contexto. Financiero tiene la autoridad sobre saldos y compromisos. Notificaciones procesa eventos para decidir avisos y consulta el estado vigente por gRPC cuando una condición depende de datos financieros.

## Transporte y contrato común

| Tópico propuesto | Productor | Consumidor MVP | Clave de partición |
| --- | --- | --- | --- |
| `billetera.usuarios.eventos.v1` | Usuarios | Notificaciones | `usuarioId` |
| `billetera.finanzas.eventos.v1` | Financiero | Notificaciones | `usuarioId` |

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

Los campos de `datos` se agregan a `agregadoId` y `usuarioId`, que viajan en el sobre. La columna de reconsulta describe qué dispara el hecho. Notificaciones aplica las reglas vigentes en [RN-11](BUSINESS_RULES.md#alertas-y-asistencia).

| `tipo` | Raíz | `datos` | Condición de emisión | Reconsulta o efecto esperado |
| --- | --- | --- | --- | --- |
| `UsuarioRegistrado` | `Usuario` | `{}` | Identidad y preferencias iniciales confirmadas. | Habilitar reglas predeterminadas con una inserción que respeta personalizaciones existentes. |
| `PreferenciasActualizadas` | `Usuario` | `versionPreferencias: int64` como texto decimal, `zonaHorariaCambio: bool` | Se guardó un cambio efectivo de preferencias. | Si cambió la zona, reevaluar vencimientos y presupuesto del mes local aplicable. |
| `MovimientoEfectivoRegistrado` | `Movimiento` | `tipoMovimiento: INGRESO o GASTO`, `categoriaId: UUID`, `fechaEfectiva: FechaLocal`, `origen: MANUAL o COMPROMISO` | Se registró un ingreso o gasto efectivo. | Para un gasto, evaluar presupuesto de la categoría y el mes que corresponde a la fecha. |
| `MovimientoAnulado` | `Movimiento` | `tipoMovimiento: INGRESO o GASTO`, `categoriaId: UUID`, `fechaEfectiva: FechaLocal` | Se anuló un movimiento manual vigente. | Para un gasto, volver a evaluar la categoría y el mes. |
| `MovimientoReclasificado` | `Movimiento` | `tipoMovimiento: INGRESO o GASTO`, `categoriaAnteriorId: UUID`, `categoriaNuevaId: UUID`, `fechaEfectiva: FechaLocal` | Cambió la categoría de un ingreso o gasto vigente. | Para un gasto, evaluar las dos categorías en el mes correspondiente. |
| `PresupuestoCreado` | `Presupuesto` | `categoriaId: UUID`, `periodo: MesCalendario` | Se creó un presupuesto. | Evaluar si el gasto acumulado ya alcanza el umbral aplicable. |
| `PresupuestoActualizado` | `Presupuesto` | `categoriaId: UUID`, `periodo: MesCalendario` | Cambió su límite. | Comparar el gasto acumulado con el límite vigente. |
| `CompromisoCreado` | `CompromisoFinanciero` | `versionAgregado: int64` como texto decimal, `fechaVencimiento: FechaLocal` | Se registró un compromiso pendiente. | Evaluar si un compromiso ya está dentro de la ventana de aviso o vencido. |
| `CompromisoActualizado` | `CompromisoFinanciero` | `versionAgregado: int64` como texto decimal, `fechaVencimiento: FechaLocal` | Cambió un compromiso pendiente. | Consultar el estado y usar el vencimiento vigente para determinar la clave. |
| `CompromisoConfirmado` | `CompromisoFinanciero` | `versionAgregado: int64` como texto decimal, `movimientoId: UUID`, `fechaEfectiva: FechaLocal` | Confirmación y alta del movimiento comprometidas juntas. | Excluir el compromiso de evaluaciones de aviso si su estado vigente es terminal. |
| `CompromisoCancelado` | `CompromisoFinanciero` | `versionAgregado: int64` como texto decimal, `fechaCancelacion: FechaLocal` | Se canceló el compromiso. | Excluir el compromiso de evaluaciones de aviso si su estado vigente es terminal. |

La confirmación crea dos hechos publicables con la misma correlación y distintos `eventoId`. El evento del compromiso atiende su vencimiento. El evento del movimiento atiende el consumo presupuestario si es un gasto. Las transferencias, sus anulaciones y la reserva o liberación de ahorro producen cambios atómicos locales. Los hechos locales `TransferenciaRegistrada`, `TransferenciaAnulada`, `AhorroReservado` y `AhorroLiberado` quedan dentro de Financiero durante el MVP. Altas y cambios de cuenta, nombres de categorías, marcas de gasto hormiga y lecturas de la bandeja también se resuelven en su servicio propietario.

## Entrega y deduplicación

1. El productor guarda el cambio y su outbox en una transacción de PostgreSQL. Un publicador reintenta los mensajes pendientes hasta recibir confirmación de Kafka y registra la publicación. Si el publicador cae antes de registrar el envío, puede reenviar el mismo `eventoId`.
2. Notificaciones trabaja con entrega al menos una vez. Consulta los datos financieros o las preferencias necesarias antes de escribir y ejecuta en una transacción local el registro de `EventoProcesado`, la personalización predeterminada que proceda y las inserciones de notificaciones. Confirma el offset de Kafka después del commit local. Una repetición de `(consumidor, eventoId)` se reconoce sin aplicar otra vez el efecto. [Semántica de entrega de Apache Kafka](https://kafka.apache.org/41/design/design/#message-delivery-semantics)
3. La comprobación dentro de la transacción también usa una unicidad por `(usuarioId, claveDeduplicacion)`. Para presupuesto la clave lógica reúne `PRESUPUESTO_UMBRAL`, `presupuestoId`, `periodo` y `umbral`. Para compromisos reúne `tipoDeAlerta`, `compromisoId` y `fechaVencimiento`. Eventos diferentes y evaluaciones programadas compiten por la misma clave sin duplicar el aviso. Cambiar una regla y volver a su valor anterior conserva las claves previas.
4. Cada tópico tiene orden por partición. La lógica tolera reenvíos y diferencias de orden entre tópicos porque reevalúa el estado vigente y usa claves de negocio. Un evento antiguo no vuelve a aplicar los datos de su carga como si fueran una nueva transición.
5. Un fallo transitorio conserva el trabajo pendiente y se reintenta con espera acotada entre intentos. Un mensaje inválido se aísla en una cola de errores con diagnóstico y acceso restringido. El offset puede avanzar tras registrar de forma durable ese fallo. Un reproceso controlado conserva el `eventoId`. La retención debe cubrir el horizonte admitido de reprocesos al configurar Kafka e inbox.

## Evaluación programada y consistencia

Notificaciones ejecuta una evaluación periódica, propuesta cada hora, para capturar cambios por calendario aunque no haya eventos. Usa consultas gRPC paginadas con identidad interna autorizada para obtener compromisos candidatos y presupuestos vigentes y aplica la fecha local de cada usuario. Al cambiar una regla, el servicio vuelve a evaluar el estado o lo recoge en la siguiente ejecución programada. La reconciliación comparte las mismas claves de negocio que el consumidor. Si una condición dejó de cumplirse al consultar el estado, se omite el aviso. Un aviso emitido refleja la condición observada antes del commit de Notificaciones. Una confirmación concurrente posterior a la lectura puede dejar un aviso histórico cuyo recurso ahora esté confirmado. La consulta del recurso muestra su estado actual.
## Propuesta de eventos de consumo presupuestario

El frontend calcula avisos de demostración a partir del estado actual. La propuesta para la integración definitiva mantiene a Financiero (.NET) como productor y a Notificaciones (Java) como consumidor. Los nombres representan tipos de evento versionados propuestos. La asignación a tópicos y la relación con el catálogo v1 existente quedan pendientes de aprobación.

| Tipo propuesto | Condición |
| --- | --- |
| `finance.budget.threshold_reached.v1` | El gasto efectivo de la categoría alcanza el umbral pertinente durante el mes del presupuesto. |
| `finance.budget.limit_reached.v1` | El consumo equivale exactamente al límite. Este evento adicional permite mostrar el estado de límite alcanzado. |
| `finance.budget.exceeded.v1` | El consumo supera el límite. |

La carga propuesta incluye `presupuestoId`, `categoriaId`, `periodo`, `moneda`, `limite`, `consumo` y, para el aviso correspondiente, `umbral`. Conserva el sobre común, la clave de partición por usuario y los montos como cadenas decimales en CLP. Queda por acordar la precedencia entre el umbral por presupuesto y la regla global, el comportamiento de los cruces saltados y la deduplicación por presupuesto, período, tipo de alerta y valor del umbral cuando aplique. El frontend consultará los avisos del usuario y actualizará su lectura a través del BFF GraphQL.
