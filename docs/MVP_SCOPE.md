# Alcance del MVP

El MVP cubre los trece requisitos funcionales en su forma básica. Permite registrar datos manualmente en CLP, entender su efecto sobre el saldo, anticipar pendientes y consultar resultados desde una sesión propia. Las dependencias, reglas y criterios de aceptación están en [Requisitos funcionales](FUNCTIONAL_REQUIREMENTS.md).

## Funcionalidades del MVP

| Área | Entrega mínima | Trazabilidad |
| --- | --- | --- |
| Identidad | Registro con correo y contraseña, inicio y cierre de sesión, zona horaria y configuración de gastos hormiga. | RF-01, RT-01 |
| Cuentas y registros | Apertura con saldo inicial, clasificación por categorías personales, ingresos, gastos, transferencias internas atómicas, historial, reclasificación y anulaciones permitidas. | RF-02 a RF-04 |
| Planificación | Un presupuesto por categoría y mes, compromisos de cobro y pago individuales, confirmación total idempotente, cancelación y proyección por fechas. | RF-05 a RF-07 |
| Análisis | Detección por monto y frecuencia, marca necesaria o prescindible, series diarias o mensuales de saldo, totales y desgloses, salud financiera `v1` sobre meses cerrados. | RF-08, RF-09, RF-11 |
| Ahorro | Metas con monto objetivo, reserva y liberación en CLP y saldo disponible global. | RF-10 |
| Alertas | Bandeja dentro de la aplicación, reglas de consumo presupuestario, vencimiento próximo y pago vencido, y marca de lectura. | RF-12 |
| Asistencia | Consultas y explicación de resultados mediante MCP y un LLM externo, con herramientas acotadas a la lectura de datos propios. | RF-13 |
| Plataforma | React, TypeScript y Apollo Client, BFF NestJS y GraphQL, Usuarios en Go, Financiero en .NET y C#, Notificaciones en Java y Spring Boot, gRPC, Kafka, PostgreSQL independiente por microservicio, Docker, Kubernetes e integración continua en GitHub Actions con cobertura mínima de 60 %. | RT-01 a RT-04 |

## Mejoras posteriores

- Compromisos recurrentes, confirmación parcial y corrección auditada de una confirmación. Deben preservar el vínculo con los movimientos y el cómputo de puntualidad.
- Reglas de presupuesto con varios umbrales simultáneos y comparación de períodos con el mismo criterio analítico. La versión inicial conserva una regla configurable de umbral por usuario.
- Historial de criterios analíticos y comparación reproducible de versiones del indicador de salud. El MVP reporta la versión de fórmula y preferencias utilizadas al calcular.
- Canales de notificación adicionales y preferencias por canal. El MVP usa la bandeja de la aplicación.
- Consulta de tendencias de más de un período desde el asistente, sustentada en los mismos cálculos y permisos de lectura.

## Riesgos técnicos

| Riesgo | Contención inicial | Verificación |
| --- | --- | --- |
| Doble escritura ante fallo, reintento o concurrencia. | Transacciones locales, claves de idempotencia y restricciones por propietario y origen. Serialización de las escrituras financieras de un usuario. | Fallo inyectado entre piernas, confirmaciones concurrentes, confirmación contra cancelación y dos reservas que compiten por el último disponible. |
| Inconsistencias de precisión en C#, gRPC, GraphQL o JavaScript. | Enteros CLP, representación decimal textual en los límites que lo requieren y acumulación de rango ampliado. | Casos por encima del entero seguro de JavaScript y agregaciones mayores a `int64`. |
| Evaluación por calendario en cambios de mes o zona horaria. | Fechas financieras explícitas, zona IANA para hoy y eventos de cambio de preferencias. | Cambio de día en UTC y en la zona del usuario, cambio de mes, cambio de zona y pago cerca de vencimiento. |
| Eventos entregados más de una vez, retrasados o fuera de orden entre tópicos. | Outbox, registro de eventos procesados, reconsulta y clave semántica de alerta. | Reenvío después de commit y antes de offset, caída temporal de Kafka y competencia entre consumidor y programador. |
| Alerta desactualizada por transición entre servicios. | Evaluación con estado vigente al consultar, tiempo de creación visible y referencia al recurso actual. | Compromiso confirmado antes de evaluar y confirmación concurrente con la generación. |
| Puntuación sensible a registros incompletos o cambios de criterio. | Cobertura por componente, versión de fórmula y contexto de preferencias, con casos de insuficiencia definidos. | Mes parcial, actividad ausente, pagos cancelados antes y después del vencimiento y reclasificación tardía. |
| Indisponibilidad o exposición de datos al LLM externo. | Herramientas de alcance limitado, identidad fijada en el servidor, minimización de datos y manejo de consultas sin resultado. | Peticiones de mutación, uso de identificadores ajenos, solicitudes de credenciales y fallo del proveedor. |

## Decisiones para la implementación

| Tema | Base adoptada en esta etapa | Decisión pendiente |
| --- | --- | --- |
| Autenticación y sesiones | Acceso con correo normalizado y contraseña con hash y sal. Cierre efectivo de sesión. | Política de contraseña, algoritmo de hash, mecanismo de sesión, expiración y propagación de identidad entre servicios. |
| Calendario y criterios personales | `America/Santiago`, 3.000 CLP y tres ocurrencias por categoría como valores iniciales propuestos. | Validar los valores de partida antes de congelar contratos y datos iniciales. |
| Fórmula de salud | Último mes cerrado, referencias de 20 % para el excedente sobre ingresos y la proporción de gastos hormiga sobre gastos totales, y cobertura mínima de 60 puntos de peso. | Validar calibración y sensibilidad con ejemplos de uso. Si cambian los parámetros, versionar la fórmula. |
| Cierre y corrección | Anulaciones de registros manuales y transferencias, reclasificación de gastos y cierre del límite presupuestario al concluir el mes. | Diseñar reversión de confirmación y tratamiento de abonos parciales para una etapa posterior. |
| Kafka y notificaciones | Tópicos y contratos v1, bandeja interna y reconciliación horaria propuesta. | Definir retención y reproceso, estrategia de evolución de esquemas y ventana operativa de entrega. |
| Integración con el LLM | Herramientas de solo lectura, respuesta con período y cobertura y minimización de los datos enviados. | Seleccionar proveedor, política de tratamiento y retención de datos, y límites operativos. |
| Tamaño de consultas y cobertura de pruebas | Consultas por rangos y lotes programados paginados. Cobertura propuesta de líneas por componente. | Fijar horizonte máximo de proyección, límites y paginación de consultas públicas y medición por tecnología en CI. |

## Cierre de la etapa de definición

Los entregables de esta etapa son los siete documentos Markdown y sus diagramas Mermaid. La implementación de servicios, persistencia, migraciones y diseño de interfaz corresponden a etapas posteriores. La aplicación registra finanzas personales de forma manual y excluye integraciones bancarias y transacciones monetarias reales.
