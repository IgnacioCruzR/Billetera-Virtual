# Contrato de análisis financiero

## Operación GraphQL candidata

`generateFinancialAnalysis(input: GenerateFinancialAnalysisInput!): FinancialAnalysisPayload!` representa una solicitud explícita al BFF. Se propone una mutación por el ciclo de ejecución y consumo del proveedor. Conserva el dominio financiero en modo de lectura. El esquema se aprobará en `bff-graphql` antes de habilitarlo en Apollo Client.

La solicitud contiene `requestId`, `analysisType`, `period` cuando aplique, `analysisParameters` como bloque discriminado y configuración de la solicitud. El servidor valida que se entregue exactamente el bloque compatible con el tipo. La sesión proporciona identidad y configuración autorizada. El consentimiento futuro se comprueba por el servidor en Usuarios y queda vinculado a la política vigente.

| Tipo | Parámetros candidatos |
| --- | --- |
| `SITUATION` | Período de Salud financiera. |
| `OPPORTUNITIES` | Mes, mes anterior o tres meses, categoría opcional y porcentaje entero de 0 a 100. |
| `PURCHASE` | Nombre opcional, monto entero positivo, fecha dentro del horizonte, cuenta activa, categoría, reserva mínima libre desde cero y horizonte admitido. |
| `BUDGETS` | Mes actual o anterior y categoría opcional. |
| `HEALTH` | Período de Salud financiera. |
| `SAVINGS` | Meta, fecha y aporte mensual opcionales, y referencia de escenario adicional cuando se apruebe su intercambio. |

Los períodos son ventanas de calendario ISO en la zona del perfil. Los montos viajan como cadenas decimales CLP en el futuro contrato y se convierten a enteros seguros en la demo. La entrada excluye movimientos, saldos, texto de sistema y mensajes de conversación. La implementación local usa los tipos `FinancialAnalysisRequest` y `FinancialAnalysisParameters`.

## Resultado propuesto

| Bloque | Campos y procedencia |
| --- | --- |
| Identificación | `requestId`, tipo, estado, fecha UTC de generación, período, zona, versión de plantilla y versión o referencia de datos. |
| Resumen | Síntesis de la interpretación, con texto plano. |
| Indicadores | ID, etiqueta, unidad y valor nullable. Identifica datos verificados y estimaciones del servicio financiero. |
| Fortalezas y oportunidades | Interpretación y referencias a IDs de indicadores del mismo resultado. |
| Riesgos y recomendaciones | Prioridad, título, descripción, evidencia, beneficio opcional y acción tipada. |
| Calidad, supuestos y límites | Fuentes disponibles, ausencias y restricciones relevantes. |
| Escenario de compra | Saldos y reservas registrados, mínimos, márgenes, déficit, puntos por fecha y presupuesto opcional calculados por Transacciones. |

El frontend conserva un informe parcial cuando quedan datos válidos. Una respuesta sin identidad, tipo y corte coherentes se rechaza. Los errores candidatos cubren comunicación, MCP, proveedor, vencimiento de espera, límite de solicitudes, cancelación local, consentimiento y contrato inválido. El reporte histórico guarda la versión utilizada. Un reintento equivalente reutiliza `requestId`, y un nuevo análisis recibe uno distinto. La futura idempotencia se aplicará por usuario y por huella de tipo y parámetros, con un límite de tiempo acordado.

## Adaptación y topología

`AssistantProvider` separa el resultado asíncrono de la presentación. En la integración, su implementación con Apollo Client enviará la operación por `/graphql`, transformará el resultado al modelo de presentación y conservará los estados de la UI. El BFF valida la sesión, parámetros y consentimiento antes de delegar por gRPC a `ms-agente-mcp`. El agente usa herramientas para leer Usuarios y Transacciones por gRPC, y HTTPS para pedir una interpretación al LLM externo. El BFF serializa una respuesta validada.

| Acción de navegación | Destino controlado |
| --- | --- |
| `OPEN_TRANSACTIONS` | Movimientos con fechas y categoría verificadas. |
| `OPEN_BUDGET_DETAIL` | Presupuestos o detalle de un presupuesto autorizado. |
| `OPEN_COMMITMENTS` | Cobros y pagos o el detalle de un compromiso. |
| `OPEN_MICRO_EXPENSE_SIMULATOR` | Simulador de gastos prescindibles en un mes válido. |
| `OPEN_SAVINGS_GOAL` | Planificador, con la meta elegida cuando esté disponible. |
| `OPEN_FINANCIAL_HEALTH` | Salud financiera en un período admitido. |
| `OPEN_ACCOUNTS` | Mis cuentas o detalle de cuenta. |

El frontend construye las rutas. Abrir el formulario de gasto de la simulación es una acción propia de la pantalla basada en la solicitud local y sujeta a confirmación explícita. El informe carece de permisos de escritura. [Topología oficial](TOPOLOGY.md) · [Requisitos de seguridad](AI_SECURITY_REQUIREMENTS.md)
