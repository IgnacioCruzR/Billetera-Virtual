# Integración de Salud financiera

La demo calcula la [metodología v2-demo](FINANCIAL_INDICATORS.md#metodología-v2-demo-de-salud-financiera) con los registros compartidos y el adaptador `FinancialHealthRepository`. La capa de presentación consume el resultado, su procedencia y su disponibilidad. La integración sustituirá el adaptador por Apollo Client y moverá la autoridad del cálculo a `ms-transacciones` en NestJS y TypeScript.

## Contratos GraphQL candidatos

| Operación de lectura | Entrada | Respuesta propuesta |
| --- | --- | --- |
| `financialHealth` | Período, corte opcional y versión si se admite más de una | Evaluación, estado de calidad, intervalo, zona horaria aplicada, puntuación global nullable, resultado de cada pilar, peso, puntos, razones, cobertura e indicadores complementarios. |
| `financialHealthHistory` | Período, granularidad mensual y versión | Cortes, disponibilidad, procedencia, valores por pilar, variaciones, ventana previa y motivo cuando falte equivalencia. |
| `financialHealthMethodology` | Versión opcional | Versión, pesos, referencias, criterios de disponibilidad, interpretación, horizonte y fecha de vigencia. |
| `financialHealthRecommendations` | Período y versión o referencia de evaluación | Identificador, pilar, prioridad, evidencia, fecha o referencia del recurso, beneficio esperado y acción tipada. |
| `simulateFinancialHealth` | Período, corte base, ingresos y gastos hipotéticos, ajuste opcional de categoría, reducción, dinero libre inicial e IDs de pagos omitidos del flujo | Resultado base e hipotético, diferencia global nullable, diferencias por pilar, ahorro potencial, flujo de caja y supuestos. Es una consulta transitoria. |

El BFF deriva identidad y zona horaria del perfil autenticado. El contrato distingue un cero observado de un valor ausente, corte cerrado de provisional y reconstrucción de un resultado histórico persistido. Los puntos y las tasas se entregan con precisión suficiente. Los importes en CLP usan cadenas decimales. Los IDs de las acciones identifican recursos autorizados. La interfaz crea las rutas desde las acciones tipadas. Los argumentos de simulación se validan del lado servidor, incluida la pertenencia de cada compromiso.

El navegador usará `/graphql` mediante Apollo Client. `bff-graphql` consultará a Transacciones por gRPC y a Usuarios por gRPC para las preferencias correspondientes. Transacciones aplicará las mismas fuentes de movimientos, cuentas, presupuestos, compromisos, clasificaciones y reservas que usa el resto de la aplicación. Los cambios efectivos deberán actualizar o invalidar la evaluación, el historial interesado y las recomendaciones de Apollo como resultado de las mismas mutaciones.

Cuando se apruebe el esquema, la capa de acceso convertirá los resultados asíncronos de Apollo a los modelos de presentación y a los estados de carga, éxito y error. La simulación usará una consulta bajo demanda. El Ingress dará acceso a `/graphql`; la ruta del contenedor está reservada mientras se ejecuta la demo local.

## Herramienta MCP y análisis guiado

Se propone `get_financial_health` como herramienta de lectura de `ms-agente-mcp`. Su entrada es el período y, si corresponde, el corte o la versión permitida. La identidad viaja en el contexto autenticado. Su respuesta incluye resultado, pilares, indicadores, calidad de datos y recomendaciones estructuradas calculadas por Transacciones.

La futura solicitud estructurada seguirá `frontend → bff-graphql (GraphQL) → ms-agente-mcp (gRPC)`. El agente obtendrá preferencias de `ms-usuarios` y evaluaciones de `ms-transacciones` mediante herramientas gRPC autorizadas. Podrá invocar el servicio de LLM por HTTPS para redactar el análisis de los resultados. El BFF devolverá al frontend un objeto tipado con `summary`, `strengths`, `risks`, `recommendations`, `actions` y `limitations`, asociado a período y versión de metodología.

> Explica la evaluación devuelta por get_financial_health en lenguaje claro y respetuoso. Usa los resultados, unidades y alertas de la herramienta. Mantén los valores ausentes e identifica si el corte es provisional o reconstruido. Presenta fortalezas, riesgos, próximos pasos y limitaciones en campos separados. Usa las referencias de acciones autorizadas y conserva la prioridad calculada por el servicio.

El análisis será una lectura guiada dentro del módulo. El servicio determina todas las puntuaciones antes del análisis y la respuesta conserva esa procedencia.

## Extensiones pendientes del dominio

- Aprobar `v2-demo` como base de una metodología oficial versionada, incluidos umbrales, horizonte, cobertura mínima y comparabilidad entre versiones.
- Definir instantáneas comparables por período, datos de origen, política de reprocesamiento y trazabilidad de movimientos, presupuestos, reclasificaciones, preferencias y reprogramaciones.
- Definir fondo de emergencia verificable, cesta de gastos esenciales, ventana de observación y cualquier exclusión de fondos reservados.
- Validar cómo tratar pagos reprogramados, costo de proyecciones y revisiones de un período bajo concurrencia.
- Aprobar criterios de riesgo, cambios significativos, supresión y deduplicación para los [eventos Kafka candidatos](DOMAIN_EVENTS.md#eventos-candidatos-de-salud-financiera).

La [topología oficial](TOPOLOGY.md) y el [stack del proyecto](../TECH_STACK.md) establecen las dependencias de red, la infraestructura y los lenguajes de cada servicio.
