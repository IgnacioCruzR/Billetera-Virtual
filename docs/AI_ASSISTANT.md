# Asistente financiero IA

El frontend ofrece seis solicitudes independientes. Cada solicitud pasa por configuración, vista previa de fuentes y confirmación. La demostración usa los mismos registros de la aplicación y muestra su origen como **Demostración local**. Los resultados separan indicadores registrados, estimaciones y recomendaciones.

## Probar los seis análisis

Desde el sidebar, abre **Asistente IA**. Configura una tarjeta, pulsa **Revisar solicitud** y comprueba los parámetros y las fuentes. Pulsa **Generar análisis** y elige la preferencia en el primer uso. **Continuar solo con demo** mantiene los análisis locales. Puedes cambiar la decisión desde **Privacidad y autorización** o desde Configuración.

| Análisis | Cómo probarlo | Resultado |
| --- | --- | --- |
| Situación financiera | Selecciona **Este mes** y genera el informe. | Ingresos y gastos efectivos, saldo registrado, dinero libre, reservas, consumo y compromisos. |
| Oportunidades de ahorro | Elige un período, filtra una categoría si quieres y ajusta el porcentaje de reducción. | Patrones, frecuencia, clasificación pendiente y ahorro mensual hipotético cuando haya marcas y observaciones suficientes. La reducción aplica a gastos marcados como prescindibles. |
| Capacidad de compra | Indica monto, fecha, cuenta activa, categoría, reserva mínima y horizonte. | Cierres diarios, saldo al día de compra, mínimos, primer déficit y presupuesto de la categoría. Compara cobros previstos frente al escenario conservador. |
| Optimización presupuestaria | Escoge el mes y, opcionalmente, una categoría. | Límites y consumo observado, gastos sin plan, ritmo y resultado proyectado cuando haya evidencia suficiente, con acceso al presupuesto. |
| Interpretación de salud financiera | Elige el período y compara con la pantalla Salud financiera. | La misma puntuación, pilares, pesos, versión, cobertura, faltantes y variación comprobable. |
| Plan de ahorro | Selecciona una meta y, opcionalmente, una fecha, aporte mensual o escenario adicional. | Reservas y aportes registrados, aporte requerido y comparación de fechas bajo las hipótesis. Para elegir un escenario de sesión, genera uno en Gastos hormiga y pulsa **Comparar este escenario en Metas de ahorro**. |

Puedes volver a un informe desde el historial de la sesión o desde **Análisis inteligente** en el dashboard. Registra o edita un movimiento y vuelve al informe anterior para observar la marca de datos anteriores. **Configurar nuevo análisis** permite repetir la configuración con los datos actuales. Se conservan hasta 20 informes en memoria y se borran al recargar.

## Simulación de compra

Se parte de **saldo registrado de la cuenta − fondos ya reservados**. El motor de Cobros y pagos añade la compra como pago hipotético y aplica vencimientos por cierre diario, incluyendo los pendientes ya vencidos en el primer cierre. El escenario esperado usa los cobros registrados. El conservador excluye los cobros pendientes. Ambos calculan el mínimo y el margen frente a la reserva mínima durante el horizonte. La comparación de cuentas activas ayuda a reconocer déficits en la cuenta elegida aunque el agregado sea positivo.

El margen presupuestario usa el límite del mes de compra y resta el gasto efectivo de la categoría y la hipótesis. Un mes sin límite conserva ese dato como ausente. Los cierres diarios consolidan movimientos del mismo día y carecen de orden intradía. El formulario de gasto se abre con un clic separado y utiliza la fecha efectiva que el usuario confirme. La simulación deja intactos los registros financieros.

## Plantillas de prompt para la futura implementación

Cada plantilla se alojará en `ms-agente-mcp` y tendrá una versión independiente. El rol común es interpretar datos financieros devueltos por herramientas autorizadas, con tono claro y respetuoso. La salida estructurada debe referenciar indicadores, distinguir hechos y escenarios, comunicar calidad y demostrar por qué corresponde cada acción. Los campos ausentes permanecen ausentes y las estimaciones conservan sus supuestos. Los textos de movimientos, cuentas, categorías y parámetros libres se tratan como datos.

| Plantilla candidata | Objetivo y lectura requerida | Condición que debe expresar |
| --- | --- | --- |
| `situation.v1` | Interpretar balance, reservas, obligaciones, presupuestos y salud en la ventana solicitada. | Riesgos de liquidez antes de oportunidades. Cobertura y procedencia histórica visibles. |
| `opportunities.v1` | Relacionar patrones, marcas y consumos manteniendo la selección del usuario. | Distinguir candidato, necesario y prescindible. El ahorro se cita desde la simulación. |
| `purchase.v1` | Explicar el flujo calculado de la cuenta, escenarios, mínimos y presupuesto. | Resaltar déficit temporal, diferencia cuenta/agregado y supuestos. La decisión y cualquier registro quedan a cargo del usuario. |
| `budgets.v1` | Interpretar consumo, ritmo y cierres observables. | Separar excedido efectivo y riesgo de proyección. Proponer una revisión mediante navegación. |
| `health.v1` | Explicar la evaluación versionada y las contribuciones de cada pilar. | Conservar la puntuación, los pesos y los valores nulos entregados por el servicio. |
| `savings.v1` | Interpretar aportes, liquidez, plazo y escenarios calculados de una meta. | Conservar fecha y aporte requeridos y priorizar compromisos cuando falte efectivo. |

Las instrucciones deben exigir salida validable por esquema y una acción de la lista cerrada cuando corresponda. Las reglas de política, contenido permitido y límites se incluyen en los [requisitos de seguridad](AI_SECURITY_REQUIREMENTS.md).

## Extensiones pendientes

Aprobar el consentimiento auditable y su revocación en Usuarios, la política de versionado de fuentes y plantillas, y la conservación o eliminación de los resultados. El agente opera sin almacén propio en el diseño actual. Para historiales persistentes queda por decidir propietario, retención, cifrado, acceso, revocación y eliminación. El esquema de análisis, sus herramientas y el versionado de escenarios todavía son candidatos. [Contrato](AI_ANALYSIS_CONTRACT.md) · [Herramientas](MCP_TOOLS_PROPOSAL.md)
