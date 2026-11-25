# Herramientas MCP candidatas para análisis financieros

Los nombres y esquemas quedan pendientes de aprobación. La capa MCP vive en `ms-agente-mcp`. Cada herramienta obtiene la identidad de un contexto autenticado propagado por el BFF y los servicios vuelven a autorizar los recursos. Los argumentos del modelo carecen de autoridad sobre la identidad.

| Herramienta | Destino gRPC | Entrada candidata | Salida y límite |
| --- | --- | --- | --- |
| `get_user_preferences` | `ms-usuarios` | Preferencias necesarias para el tipo de análisis | Zona horaria, moneda, idioma y estado de consentimiento. Solo campos autorizados para el propósito. |
| `get_financial_summary` | `ms-transacciones` | Período y cuenta opcional | Ingresos, gastos, balance, saldo registrado, reservado y libre. Indica corte y procedencia. |
| `get_expense_breakdown` | `ms-transacciones` | Período y categorías opcionales | Totales y frecuencia por categoría. Los detalles individuales requieren una necesidad explícita. |
| `get_budget_status` | `ms-transacciones` | Período y categoría o presupuesto opcional | Límites, consumo, ritmo, proyección, categorías sin plan y disponibilidad de comparación histórica. |
| `get_micro_expenses` | `ms-transacciones` | Período, categorías y porcentaje hipotético opcionales | Agregados, frecuencia, revisión pendiente, marcas y ahorro simulado bajo el criterio vigente. Un candidato por monto carece de marca manual. |
| `get_cashflow_forecast` | `ms-transacciones` | Corte, horizonte y cuenta opcional | Pendientes, dinero libre, mínimos y fechas de déficit. Los cobros previstos se distinguen de los ingresos efectivos. |
| `get_savings_progress` | `ms-transacciones` | Meta y corte autorizados | Objetivo, reservas, movimientos de reserva, aporte planificado y plazos si la evidencia alcanza. |
| `get_financial_health` | `ms-transacciones` | Período, corte y versión opcional | Puntuación, pilares, pesos, calidad, versión y variación comparable. Preserva valores ausentes. |
| `simulate_purchase_impact` | `ms-transacciones` | Monto, fecha, cuenta, categoría, horizonte y reserva mínima | Escenarios esperado y conservador, mínimo y primer déficit por cuenta y agregado, y efecto presupuestario. Operación transitoria. |
| `simulate_savings_plan` | `ms-transacciones` | Meta, fecha objetivo, aporte mensual y escenario adicional opcionales | Aporte requerido, fechas estimadas, diferencias y supuestos de liquidez. Operación transitoria. |

Cada respuesta incluye referencias opacas a los indicadores, disponibilidad y versión de datos cuando sea aplicable. Las herramientas son de solo lectura y envían cantidades y cálculos de Transacciones, con serialización exacta para CLP. El agente solicita solo las herramientas autorizadas para el análisis y limita su tiempo, volumen y alcance. El LLM recibe contexto utilizable en lugar de credenciales o acceso a servicios.

La comunicación exterior sigue [Topología oficial](TOPOLOGY.md). GraphQL llega al BFF, gRPC transporta las llamadas entre servicios y el agente organiza sus herramientas MCP. La conexión del agente con el LLM usa HTTPS.
