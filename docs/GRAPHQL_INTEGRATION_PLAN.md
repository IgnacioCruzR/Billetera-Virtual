# Operaciones GraphQL candidatas

Todas las operaciones de este inventario están pendientes de aprobación e implementación en `bff-graphql`. La demo usa adaptadores locales. `C` indica consulta y `M` indica mutación. Todas requieren sesión autenticada. El BFF deriva la identidad de la sesión y valida el acceso. El servicio propietario limita cada lectura y escritura al usuario autenticado. El alta de sesión, la caducidad y el transporte de credenciales se definirán en el contrato de autenticación.

## `ms-usuarios`

| Operación | Tipo | Parámetros candidatos | Respuesta esperada |
| --- | --- | --- | --- |
| `viewer` | C | Sesión vigente | Perfil, fechas y metadatos de sesión autorizados |
| `userPreferences` | C | Secciones opcionales | Región, preferencias financieras, detección, asistente y presentación sincronizada si se aprueba |
| `updateUserProfile` | M | Nombre visible, versión esperada | Perfil validado y versión |
| `updateUserPreferences` | M | Sección, valores, versión esperada | Bloque persistido, incluida detección de gastos hormiga cuando corresponda |
| `changePassword` | M | Contraseña actual y nueva | Resultado y efecto sobre la sesión, sin credenciales |
| `updateAiConsent` | M | Decisión, versión de política | Estado, fecha y versión de consentimiento |
| `logout` | M | Sesión vigente | Confirmación idempotente de cierre o revocación |
| `notificationPreferences` / `updateNotificationPreferences` | C / M | Sección global. La mutación recibe habilitación y versión | Preferencia global. El BFF puede componerla con reglas de Notificaciones |

## `ms-transacciones`

| Operación | Tipo | Parámetros candidatos | Respuesta esperada |
| --- | --- | --- | --- |
| `dashboardSummary` | C | Período, corte, horizonte | Efectivos, saldo total y disponible, reservas, comparativo equivalente y referencias a otros módulos |
| `movements`, `movement` | C | Filtros, rango, cursor y orden, o ID | Página y totales del período, o detalle con cuentas, categoría y referencia de compromiso |
| `createMovement`, `updateMovement`, `deleteMovement` | M | Tipo, cuenta, destino cuando aplique, importe, fecha, categoría y descripción. Edición o eliminación con ID y versión | Movimiento o resultado de anulación aprobada, versión y saldos afectados. Una transferencia se aplica en una transacción |
| `accounts`, `account` | C | Estado, corte, período, cursor o ID | Cuentas y detalle con saldo inicial, efectivo, reservado y libre, ajustes y actividad |
| `createAccount`, `updateAccount`, `changeAccountStatus`, `deleteAccount` | M | Datos de cuenta, estado o motivo según acción, ID y versión cuando aplique | Cuenta o estado final, saldos y restricciones de referencias |
| `adjustAccountBalance` | M | Cuenta, importe real, fecha, motivo, versión | Ajuste independiente, delta y saldo resultante |
| `budgets`, `budget` | C | Mes, categoría, historial o ID | Límites, consumo efectivo, cobertura y evolución con corte |
| `createBudget`, `updateBudget`, `duplicateBudgets`, `deleteBudget` | M | Mes, categoría, límite y umbral, o IDs y mes destino. ID y versión en cambios | Presupuestos y consumo afectados, conflictos de unicidad. Copia de lote atómica |
| `commitments`, `commitment`, `cashFlowProjection` | C | Filtros, rango de calendario, cursor, ID o corte, horizonte y cuenta | Historial, calendario, detalle con movimiento asociado o serie de proyección con riesgos y supuestos |
| `createCommitment`, `updateCommitment`, `cancelCommitment` | M | Tipo, cuenta, categoría, importe, fecha, recurrencia si se aprueba. ID y versión en cambios | Compromiso, estado, versión y referencias |
| `confirmCommitment` | M | ID, cuenta autorizada, fecha efectiva, versión y clave de idempotencia | Compromiso y un único movimiento efectivo junto a los saldos afectados |
| `microExpenseOverview`, `microExpensePatterns`, `microExpenseHistory` | C | Corte, período, filtros, patrón o cursor | Indicadores, series, patrones y movimientos autorizados con zona y versión del criterio |
| `classifyMicroExpenses` | M | IDs de movimientos, clasificación, versión | Clasificaciones y resumen actualizado. Autorización y aplicación atómicas para todo el lote |
| `savingsSummary`, `savingsGoals`, `savingsGoal`, `savingsHistory`, `savingsProjection` | C | Corte, filtro, ID, cursor o supuestos de cálculo | Totales y disponibilidad por cuenta, metas y estados, historial o estimación con vigencia y supuestos |
| `createSavingsGoal`, `updateSavingsGoal`, `changeSavingsGoalStatus` | M | Meta, plan, aporte inicial opcional, ID, acción y versión cuando apliquen | Meta y disponibilidad actualizadas. Alta y aporte inicial atómicos |
| `reserveSavings`, `releaseSavings` | M | Meta, cuenta, importe, fecha, motivo y clave de idempotencia | Reserva o liberación, disponibilidad de cuenta y progreso. Sin movimiento efectivo nuevo |
| `categories` | C | Tipo y estado | Catálogo autorizado y referencias resumidas |
| `createCategory`, `updateCategory` | M | Nombre, tipo, icono, color, descripción, ID y versión cuando correspondan | Categoría y catálogo afectado |
| `archiveCategory`, `restoreCategory`, `deleteCategory` | M | ID, versión y confirmación de eliminación | Estado, referencias y resultado de validación atómica |
| `financialHealth`, `financialHealthHistory` | C | Período, corte, granularidad o versión | Puntuación nullable, pilares, razones y calidad, o serie con comparabilidad y procedencia |
| `financialHealthMethodology`, `financialHealthRecommendations` | C | Versión o referencia de evaluación y período | Metodología versionada, o recomendaciones con evidencia y acción tipada |
| `simulateFinancialHealth` | C | Período y corte, ingresos, egresos, categoría, reducción, fondos iniciales y pagos hipotéticos | Base y escenario, diferencias nullable, supuestos y flujo. Sin persistencia |
| `updateFinancialHealthPreferences` | M | Ámbito, versión y parámetros cuya edición se apruebe | Método o preferencias vigentes con fecha de aplicación |

Una transferencia identifica dos cuentas y se registra fuera de ingresos y gastos. La política histórica de eliminación o anulación y la entidad de ajuste se regirán por el modelo aprobado. La exportación persistente requiere acordar fecha de corte, alcance, formato de entrega y coordinación por el BFF. [Contratos de Configuración](SETTINGS_GRAPHQL_CONTRACT.md) · [Salud financiera](FINANCIAL_HEALTH_INTEGRATION.md) · [Reglas del dominio](BUSINESS_RULES.md)

## `ms-notificaciones`

| Operación | Tipo | Parámetros candidatos | Respuesta esperada |
| --- | --- | --- | --- |
| `notifications` | C | Estado, tipo, cursor | Página, recuento sin leer y referencias autorizadas |
| `markNotificationRead`, `markAllNotificationsRead` | M | ID, o alcance de lectura y corte | Estado de lectura idempotente y recuento actualizado |
| `notificationPreferences` / `updateNotificationPreferences` | C / M | Bloque propio y versión en escritura | Preferencias de entrega. El BFF las compone con la habilitación de Usuarios |
| `notificationRules`, `updateNotificationRule` | C / M | Tipo opcional en consulta. Tipo, activación, anticipación y versión en escritura | Reglas y versión persistida |

## `ms-agente-mcp`

| Operación | Tipo | Parámetros candidatos | Respuesta esperada | Autorización adicional |
| --- | --- | --- | --- | --- |
| `generateFinancialAnalysis` | M | `requestId`, tipo, período, bloque discriminado de parámetros y configuración permitida | Informe tipado con fuentes, limitaciones, indicadores y acciones de navegación. Resultados y cambios hipotéticos del dominio son de solo lectura | Consentimiento vigente y versionado por Usuarios, acceso a cada recurso y deduplicación por sesión y solicitud |

El agente consulta Usuarios y Transacciones por gRPC mediante herramientas autorizadas. Construye la solicitud de interpretación al LLM externo por HTTPS. [Contrato detallado de IA](AI_ANALYSIS_CONTRACT.md) · [Seguridad de IA](AI_SECURITY_REQUIREMENTS.md)

## Incorporación de adaptadores

1. Acordar el esquema, paginación, errores tipados, versiones, idempotencia, fechas ISO y montos CLP exactos. Determinar cómo se obtiene una revisión coherente del libro para múltiples vistas.
2. Incorporar la sesión autorizada en el modo `integration` y completar las operaciones tipadas después de aprobar el esquema. Crear un cliente Apollo nuevo por sesión. Al salir o caducar, desmontar las vistas de datos, detener solicitudes y vaciar la caché con `closeBffSession`.
3. Suministrar a los hooks las implementaciones de `FinancialRepository`, `SettingsRepository`, `FinancialHealthRepository` y `AssistantProvider`. Usar carga asíncrona para Salud y bandeja, con estados de espera, error, datos insuficientes y reintento. El proveedor demo sigue seleccionándose por separado.
4. Actualizar o invalidar en conjunto las lecturas afectadas después de cada escritura confirmada. Reproducir el escenario financiero y probar autorización cruzada, expiración, reintentos y concurrencia en BFF y servicios con datos aislados.

El mismo host sirve la SPA y `/graphql`. En el futuro Ingress, la ruta exacta se envía al BFF. El BFF llama a los servicios por gRPC y los servicios autorizados mantienen sus flujos Kafka. [Estado y comprobaciones](FRONTEND_INTEGRATION_STATUS.md) · [Topología](TOPOLOGY.md)
