# Billetera Virtual · Frontend

Frontend de demostración en React, TypeScript, Tailwind CSS y shadcn/ui, con iconos Lucide y gráficos Recharts. Usa pesos chilenos y toma la fecha de corte en `America/Santiago`.

El stack y las fronteras del sistema se describen en [Arquitectura](../ARCHITECTURE.md) y [Topología](../docs/TOPOLOGY.md).

## Ejecutar en local

Usa Node.js 22.12 o superior. Desde la raíz del repositorio ejecuta:

```sh
cd frontend
npm ci
npm run dev
```

Abre la URL que imprime Vite. `npm run build` comprueba TypeScript y genera `dist/`. `npm run preview` sirve esa compilación.

Las pantallas comparten los registros de demostración en memoria. Al recargar se restablecen los datos iniciales. Las alertas presupuestarias se calculan desde los límites y gastos registrados, y las reservas se derivan de los aportes y liberaciones.

`VITE_DATA_MODE=demo` selecciona la demostración y es el valor predeterminado. Con `VITE_DATA_MODE=integration`, la entrada inicializa Apollo Client con `/graphql` del mismo origen y muestra el estado pendiente del BFF. La configuración es pública y Vite la incorpora durante la compilación. Para cambiar el modo de la imagen, vuelve a construirla con `--build-arg VITE_DATA_MODE=integration`. [Plan de integración](../docs/GRAPHQL_INTEGRATION_PLAN.md)

## Contenedor Nginx

El [entorno local de Compose](../docs/LOCAL_DEVELOPMENT.md) puede arrancar este contenedor de forma independiente en modo demo. La guía incluye la verificación de las diez rutas contra el paquete servido por Nginx.

Desde la raíz del checkout, con un daemon Docker disponible, construye y sirve la misma demo.

```sh
docker build -t billetera-frontend ./frontend
docker run --rm -p 127.0.0.1:8080:8080 billetera-frontend
```

La aplicación se abre en `http://127.0.0.1:8080/` y Nginx responde en `/healthz`. El endpoint público de integración previsto es `/graphql` del mismo host. En Kubernetes, Ingress envía esa ruta al BFF y sirve la interfaz desde Nginx. [Topología de despliegue](../docs/TOPOLOGY.md#despliegue-objetivo-en-kubernetes)

## Probar Movimientos

1. Abre **Movimientos** desde el menú lateral. Cambia el período del resumen y comprueba que las tarjetas de ingresos, gastos y balance neto se actualizan.
2. Combina un tipo, una cuenta y un rango de fechas en el historial. Usa **Filtros avanzados** para los rangos de monto y la clasificación. En móvil los controles se abren con **Filtros**. Exporta el resultado con **Exportar CSV**.
3. Registra un gasto, ingreso o transferencia con **Nuevo movimiento**. Abre el menú de la fila para consultar, editar o eliminar la operación. Vuelve al dashboard para comparar saldos y totales.
4. Abre **Configuración** para cambiar el monto máximo o la frecuencia mensual de la detección de gastos hormiga. La clasificación manual se mantiene al recalcular los candidatos automáticos.

## Probar Mis cuentas

1. Abre **Mis cuentas** y usa **Nueva cuenta** para elegir tipo, color e icono. Un saldo inicial de 50.000 CLP aumenta el saldo registrado en esa cantidad. Los ingresos del período conservan su valor.
2. Abre el menú de la tarjeta y registra un ingreso, gasto o transferencia. La cuenta queda preseleccionada. Desde **Ver historial** puedes consultar y filtrar sus operaciones en Movimientos.
3. Abre el detalle para consultar el saldo inicial, la actividad por período y los ajustes. Usa **Ajustar saldo** para indicar saldo real, fecha y motivo y confirmar el registro.
4. Archiva una cuenta con saldo, comprueba que mantiene su historial en **Archivadas** y reactívala. Prueba la eliminación con una cuenta recién creada a $0 que carezca de referencias.

## Probar Presupuestos

1. Abre **Presupuestos** y cambia de mes con los botones de período o los campos de mes y año. El resumen distingue el consumo presupuestado del gasto en categorías sin límite.
2. En **Gastos sin presupuesto**, usa **Planificar** para crear un límite con la categoría preseleccionada. Cambia el límite o la advertencia desde el menú de la tarjeta y revisa el resumen del dashboard.
3. Abre una tarjeta para ver el ritmo diario, el consumo acumulado y la comparación con el mes anterior. **Ver gastos del presupuesto** abre Movimientos filtrado por tipo, categoría y fechas.
4. Prueba **Duplicar presupuesto** y **Duplicar planificación**. Si el mes de destino contiene alguna categoría de origen, el diálogo muestra el conflicto y deja intacto el destino. Registra o reclasifica un gasto para ver cómo se actualizan ambas categorías.

## Probar Cobros y pagos

1. Abre **Cobros y pagos** y selecciona **Nuevo compromiso**. Elige cobro o pago e indica monto, cuenta activa, categoría y vencimiento. Comprueba que cambian los pendientes y el saldo proyectado y que el saldo efectivo conserva su valor. Usa una fecha anterior a hoy para probar el estado **Vencido**.
2. Abre el detalle. Usa **Editar compromiso** para corregir el monto o reprogramar, **Cancelar compromiso** para conservarlo en el historial y retirarlo de la proyección, o **Confirmar cobro** o **Confirmar pago** para registrar la operación. Selecciona la fecha efectiva entre la apertura de la cuenta y hoy. Abre **Ver movimiento asociado** para comprobar el vínculo y revisa el cambio en el saldo de la cuenta. Un pago confirmado consume presupuesto de su categoría y mes efectivo si existe un límite. Un cobro confirmado se registra como ingreso.
3. Cambia a **Calendario**, elige el mes y selecciona un día para consultar sus movimientos previstos y confirmados por vencimiento. **Agregar compromiso** precarga esa fecha. **Mes actual** vuelve al mes en curso. Usa el listado para consultar cancelados o filtrar por tipo, estado, cuenta, categoría o fecha.
4. Elige entre 7, 15, 30, 60 y 90 días. Selecciona un punto del gráfico o usa **Fecha del flujo de caja** para consultar los compromisos de ese día. El panel preventivo también permite seleccionar la fecha de cada riesgo.
5. Abre **Abrir simulador**. Agrega un cobro o pago hipotético, cambia la fecha y monto de un pendiente o excluye un cobro. Puedes ajustar o dejar vacía la reserva. Compara saldo final, mínimo, primer déficit y diferencia con el escenario base. **Restablecer escenario** vuelve al base y cerrar el simulador descarta la sesión de simulación.

### Cálculo del flujo de caja

El horizonte incluye desde hoy hasta hoy más la cantidad de días seleccionada, ambos inclusive. El dashboard usa 30 días. El saldo inicial de la serie es el saldo efectivo consolidado a la fecha de corte. Cada punto diario aplica `saldo(d) = saldo(d − 1) + cobros pendientes(d) − pagos pendientes(d)`. Los pendientes vencidos se imputan a hoy como inmediatos y conservan su fecha de vencimiento para consulta. Los confirmados forman parte del saldo efectivo a partir de la fecha registrada y los cancelados quedan fuera de la proyección.

El saldo mínimo compara el saldo efectivo inicial con todos los cierres del horizonte. El primer déficit es el primer día con saldo estrictamente negativo, incluido hoy si el saldo inicial es negativo. El margen final es `saldo final − reserva`. La reserva base corresponde a los montos guardados en metas de la demo y la reserva simulada puede ajustarse. Se agrupan eventos del mismo día porque el modelo usa fechas sin hora. Podría existir un faltante intradía que esta serie diaria no alcance a representar. La interfaz identifica pagos dentro de cinco días y considera concentración a partir de dos pagos en una fecha.

## Probar Gastos hormiga

1. Abre **Gastos hormiga** y elige un mes de corte. **Vista del período** permite consultar ese mes, tres meses terminando en él o el año hasta ese corte. Las cuatro visualizaciones muestran evolución, categorías, frecuencia y clasificación. El mes parcial tiene un asterisco en la evolución.
2. Selecciona un patrón o filtra el historial por descripción, fecha, cuenta, categoría, clasificación o monto. Desde un movimiento puedes consultar su detalle en **Movimientos**. En **Acciones**, aplica una marca manual, excluye el gasto o restablece la clasificación automática. También puedes marcar varios gastos y confirmar cambios con **Clasificar selección**.
3. Usa **Configurar detección** para cambiar el umbral, la frecuencia, las categorías excluidas o la vista inicial de frecuencia. Guarda el criterio o restablece los valores iniciales. Los candidatos se actualizan en todas las pantallas y las marcas manuales se conservan. El detalle de un presupuesto muestra cuánto del consumo de la categoría corresponde al análisis. **Mis cuentas** ofrece un acceso con la cuenta preseleccionada.
4. Abre **Simular ahorro**, selecciona uno o más patrones o los gastos marcados como prescindibles y ajusta la reducción general. Puedes elegir un porcentaje propio por patrón o añadir voluntariamente un gasto individual. **Restablecer simulación** limpia la selección y vuelve al 25 %. El escenario modifica únicamente la comparación en pantalla.

### Detección y alcance

El criterio inicial es automático, con máximo de 5.000 CLP inclusive y un mínimo de tres ocurrencias al mes. El algoritmo toma gastos efectivos hasta la fecha de corte. Excluye de la búsqueda automática las categorías configuradas y las marcas manuales de necesario y excluido. Normaliza la descripción con Unicode, elimina tildes, pasa a minúsculas y convierte puntuación y espacios repetidos en un espacio. Agrupa por mes calendario, categoría y descripción normalizada exacta. Las descripciones vacías quedan sin candidato. Un prescindible manual puede aportar frecuencia al grupo si cumple el umbral y la categoría. Los candidatos se determinan en el mes de la operación y los filtros de historial solo afectan la consulta visible.

El análisis incluye candidatos automáticos y gastos marcados como pequeños necesarios o prescindibles. Las marcas manuales conservan su efecto analítico al cambiar las preferencias. La exclusión individual conserva el gasto efectivo para saldos y presupuestos. El algoritmo identifica coincidencias de texto y frecuencia. Variantes de un comercio con descripciones distintas pueden formar grupos separados.

### Indicadores y simulación

| Indicador | Cálculo |
| --- | --- |
| Total y promedio | Suma de los gastos incluidos y esa suma dividida por la cantidad, redondeada a CLP. |
| Frecuencia semanal | Cantidad incluida por siete, dividido por los días de calendario observados. |
| Participación | Total incluido dividido por gastos efectivos o ingresos efectivos del período. Un denominador cero se muestra como no disponible. |
| Variación | Diferencia entre el total actual y el anterior, dividida por el anterior. El comparador abarca igual número de meses y, si el último mes está en curso, usa el mismo día de corte o el último día disponible del comparador. |
| Ritmo mensual y proyección anual | Para meses completos se usa el gasto real mensual. Para un mes parcial se estima `gasto acumulado × días del mes ÷ días transcurridos` con al menos siete días transcurridos y gastos incluidos en dos fechas distintas. Se promedian los importes mensuales de la selección, se redondea a CLP y se multiplica por doce. |
| Ahorro hipotético | Se aplica la reducción de cada movimiento a su contribución al ritmo mensual. Si un movimiento se selecciona por varias vías se cuenta una vez y el porcentaje específico del patrón tiene prioridad. El ahorro mensual redondeado se multiplica por 3, 6 o 12. El nuevo ritmo es el ritmo base menos el ahorro. |

El ritmo base del simulador incluye los gastos analizados y los otros gastos elegidos individualmente. Las estimaciones suponen un ritmo estable y la misma reducción durante todo el horizonte. La demo conserva las preferencias y marcas durante la sesión en memoria.

## Probar Metas de ahorro

1. Abre **Metas de ahorro**, elige **Nueva meta** y completa el objetivo en CLP. Puedes elegir una plantilla, cambiar el icono y el color, fijar una fecha y registrar un aporte inicial desde una cuenta activa.
2. Abre **Agregar aporte** en la tarjeta. Selecciona cuenta, importe y fecha. Revisa el dinero libre antes y después del aporte. Comprueba en **Mis cuentas** y el dashboard el nuevo reservado y el mismo saldo registrado.
3. Desde las acciones, pausa y reactiva la meta. Consulta el detalle para ver las cuentas, el gráfico y el historial. Usa **Liberar dinero reservado** para devolver disponibilidad a la cuenta. Una meta alcanzada vuelve a **En progreso** si libera parte de la reserva.
4. Cuando alcance el objetivo, elige **Finalizar meta**. El cierre registra una liberación por cada cuenta. Puedes abrir el formulario de Movimientos para confirmar una compra independiente. Para una meta pendiente o pausada, **Cancelar meta** muestra el importe que liberará y conserva la meta en el historial.
5. Abre el **Planificador de ahorro** para comparar fechas. En **Gastos hormiga**, configura una reducción con ahorro mensual positivo y pulsa **Comparar este escenario en Metas de ahorro**. Elige una meta. El planificador usa la estimación guardada como aporte adicional para una meta a la vez. Puedes conservar varios escenarios de comparación durante la sesión.

### Reservas y cierre

La reserva vigente de cada meta y cuenta es la suma de aportes menos liberaciones con fecha efectiva hasta el corte. El dinero libre de una cuenta es su saldo registrado menos las reservas vigentes. El disponible para nuevas reservas es el menor entre el dinero libre global y la suma de saldos libres positivos de cuentas activas, con mínimo cero. El excedente financiero del mes corresponde a ingresos efectivos menos gastos efectivos. Los aportes netos del mes corresponden a aportes menos liberaciones del mes.

Los aportes requieren una cuenta activa y quedan acotados por el restante de la meta y por el dinero libre efectivo de la cuenta y del conjunto de cuentas. Si la operación se retrofecha, se revisan los cierres de cada fecha con movimientos, ajustes o reservas desde la operación hasta hoy. La liberación se acota a la reserva de esa meta en la cuenta durante las mismas fechas. Un cobro previsto queda fuera del efectivo disponible. Los gastos, pagos confirmados y transferencias respetan las reservas. Si un ajuste de conciliación registra un faltante real, el dinero libre puede resultar negativo y bloquea nuevos aportes. La cuenta debe liberar sus reservas antes de archivarse.

Pausar conserva las reservas. Alcanzar el objetivo habilita el cierre. Finalizar o cancelar registra una liberación por cuenta dentro de la misma operación y deja el historial disponible. El progreso global divide la reserva de las metas en progreso por el objetivo agregado de esas mismas metas. El total reservado incluye también las metas pausadas y alcanzadas. En la lista, los atrasos son un indicador derivado de la fecha objetivo y del estado vigente.

### Proyección del planificador

- **Restante** aplica `máximo(0, objetivo − reservado)`.
- **Meses estimados** aplica `redondear hacia arriba(restante ÷ aporte mensual)` con aportes positivos. Una meta alcanzada requiere cero aportes. Si faltan fondos y el aporte es cero, la fecha se muestra como no disponible.
- **Aporte requerido** aplica `redondear hacia arriba(restante ÷ aportes disponibles)`. Los aportes son mensuales desde el próximo mes, en el mismo día de hoy o el último día del mes si ese día no existe. Se cuentan los aportes que caen hasta la fecha deseada inclusive. Un plazo vencido o anterior al primer aporte queda sin aporte aplicable.
- **Ritmo habitual** usa el plan registrado si existe. De lo contrario toma el promedio de aportes netos de los últimos tres meses cerrados cuando al menos dos tienen aportes netos positivos.
- **Ritmo acelerado** suma el ahorro mensual hipotético de Gastos hormiga al ritmo habitual. La diferencia entre los meses estimados de ambos planes muestra cuánto podría adelantarse la meta. Los escenarios guardados conservan el corte y el importe estimado al crearse.

Los datos y escenarios viven en memoria en la demo. La fecha estimada representa una planificación y depende de mantener el ritmo mensual seleccionado.

## Verificar el frontend

Para ejecutar las pruebas de integración con Chromium, instala el navegador de Playwright una vez.

```sh
npx playwright install chromium
npm test
```

Puedes ejecutar las mismas pruebas con un Edge instalado usando `PLAYWRIGHT_CHANNEL=msedge`. [Navegadores compatibles con Playwright](https://playwright.dev/docs/browsers)

`npm run test:unit` ejecuta las pruebas unitarias con Node.js. `npm run lint` comprueba TypeScript, JavaScript y las reglas de Hooks de React. `npm run typecheck` comprueba los tipos y `npm run test:e2e` ejecuta la suite de navegador.

`npm run test:coverage` exige al menos 60 % de cobertura de líneas sobre los módulos de `src/` cargados por esa suite. `npm run test:coverage:statements` vuelve a ejecutar la suite con contadores de Istanbul sobre esos mismos archivos para medir sentencias. [Auditoría de alcance](../docs/FRONTEND_AUDIT.md#cobertura) · [Workflow de CI](../.github/workflows/frontend-ci.yml)

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `src/app/` | Selección de modo, composición de proveedores de demo y transporte Apollo para el BFF. |
| `src/features/dashboard/dashboard.tsx` | Composición del dashboard y controles compartidos. |
| `src/features/dashboard/` | Navegación, tarjetas, gráficos, vistas y formulario de registro. |
| `src/features/dashboard/mock-data.ts` | Cuentas, categorías, movimientos, presupuestos, compromisos y datos de análisis de ejemplo. |
| `src/features/dashboard/use-dashboard.ts` | Derivación de saldos, actividad, presupuestos, gastos hormiga y proyección desde los registros compartidos. |
| `src/features/dashboard/movement-dialog.tsx` | Formulario reutilizado para registrar y editar. |
| `src/features/movements/transactions-page.tsx` | Pantalla, resumen e interacción del historial. |
| `src/features/movements/transaction-filters.tsx` y `transaction-history.tsx` | Filtros, tabla, tarjetas móviles, acciones y paginación. |
| `src/features/movements/transaction-dialogs.tsx` | Detalle y confirmación de eliminación. |
| `src/features/movements/movement-data.ts` y `history.ts` | Validaciones, detección, filtros y CSV. |
| `src/features/accounts/accounts-page.tsx`, `account-cards.tsx` y `account-charts.tsx` | Resumen, cuentas activas y archivadas, acciones y gráficos de distribución y evolución. |
| `src/features/accounts/account-dialogs.tsx` | Alta, vista previa, edición, detalle, ajuste y confirmaciones. |
| `src/features/accounts/account-data.ts` y `account-balances.ts` | Repositorio simulado compartido y cálculo de saldos. |
| `src/features/budgets/` | Planificación mensual, validaciones, consumo, ritmo, alertas, detalle y gráficos. |
| `src/features/commitments/` | Historial, calendario, alta, detalle, confirmación, cancelación, cálculo de flujo, riesgos y simulación. |
| `src/features/micro-expenses/` | Detección, indicadores, patrones, configuración, historial, clasificación y simulación de ahorro. |
| `src/features/savings/` | Metas, operaciones de reserva, cálculos de disponibilidad, historial, gráficos y planificador. |
| `src/features/health/` | Evaluación compartida, método versionado, comparación histórica, gráficos, explicaciones, plan de mejora y simulador. |
| `src/features/assistant/` | Configuración y consentimiento, proveedor asíncrono local, simulación de compra, informes y acciones de sesión. |
| `src/lib/calendar.ts` | Validación y aritmética de fechas de calendario, y fecha de corte por zona horaria. |
| `tests/movements.spec.ts` | Pruebas de integración en navegador. |
| `tests/accounts.spec.ts` | Pruebas de saldos compartidos, transferencias, ajustes, archivo, eliminación y privacidad. |
| `tests/budgets.spec.ts` y `tests/budget-calculations.unit.ts` | Pruebas de flujos de presupuesto, calendario, estados, consumo y proyecciones. |
| `tests/commitments.spec.ts` y `tests/cash-flow.unit.ts` | Pruebas de confirmación, cancelación, calendario, proyección y aislamiento de simulaciones. |
| `tests/micro-expenses.spec.ts` y `tests/micro-expenses.unit.ts` | Pruebas de detección, indicadores, clasificación, privacidad y simulación. |
| `tests/savings.spec.ts` y `tests/savings.unit.ts` | Pruebas del ciclo de vida, reservas, protección de fondos, proyecciones e importación de escenarios. |
| `tests/health.spec.ts` y `tests/health.unit.ts` | Fórmulas, datos ausentes, cortes, aislamiento, actualización del dashboard, acciones, privacidad y error recuperable. |
| `tests/assistant.spec.ts` y `tests/assistant.unit.ts` | Seis análisis, parámetros, autorización, errores, escenarios de compra, acciones permitidas, historial y privacidad. |
| `src/components/ui/` | Primitivas reutilizables para botones, campos, diálogos y avisos emergentes. |
| `src/index.css` | Tema oscuro y tokens de color y tipografía de Tailwind. |

## Probar Salud financiera

1. En la barra lateral, abre **Salud financiera** y cambia el período. **Metodología** describe el cálculo y cada tarjeta de pilar ofrece **Ver detalle**.
2. Pulsa **Simular cambios**. Ajusta los ingresos, el gasto total o una categoría. Mueve el control de gastos prescindibles, cambia el dinero libre inicial y prueba incluir o retirar un pago pendiente del flujo. La tabla compara cada pilar con la evaluación base.
3. Examina el ahorro potencial, el mínimo de caja y el primer déficit. **Restablecer escenario** recupera los valores base y **Cerrar simulador** descarta la hipótesis. Desde Gastos hormiga también se puede enviar a Salud financiera el porcentaje general aplicado a consumos prescindibles.
4. Prueba **Ocultar montos** en el simulador y abre una recomendación del **Plan de mejora**. Un pago efectivo confirmado en Cobros y pagos actualiza el pilar y la evaluación compartida con el dashboard.

La [metodología](../docs/FINANCIAL_INDICATORS.md#metodología-v2-demo-de-salud-financiera) especifica los cinco cálculos y la procedencia histórica. Los [contratos de integración](../docs/FINANCIAL_HEALTH_INTEGRATION.md) describen las operaciones GraphQL, el uso de MCP y las extensiones pendientes.

## Integración con GraphQL

**Configuración** administra las preferencias compartidas, categorías, avisos, privacidad, consentimiento y exportación CSV. Los límites y las opciones de verificación están en la [guía de Configuración](../docs/USER_SETTINGS.md) y los [contratos candidatos](../docs/SETTINGS_GRAPHQL_CONTRACT.md).

El punto de integración es `FinancialRepository`, que consume `useFinancialRecords`. `ApolloProvider` ya se inicializa en `integration`. Al aprobar el esquema, el adaptador tipado usará el cliente para las operaciones de `/graphql`. `ms-transacciones` es el responsable previsto de saldos, series históricas, autorización sobre los recursos financieros, idempotencia y atomicidad de transferencias. El contrato conserva importes CLP exactos y filtros independientes de los períodos del resumen. [Topología oficial](../docs/TOPOLOGY.md) · [Plan de GraphQL](../docs/GRAPHQL_INTEGRATION_PLAN.md)

En **Asistente IA**, el adaptador `AssistantProvider` permite integrar la futura operación `generateFinancialAnalysis` con Apollo Client. La demo conserva en memoria el consentimiento y los informes de sesión. Consulta los [pasos para probar los seis análisis](../docs/AI_ASSISTANT.md) y la [propuesta de contrato](../docs/AI_ANALYSIS_CONTRACT.md).

Para Cobros y pagos quedan por definir consultas paginadas de historial y calendario, consulta de detalle con el movimiento asociado y consulta de proyección con horizonte, fecha de corte y riesgos. Las mutaciones de alta, edición, cancelación y confirmación deberán exponer errores de dominio, control de versiones e idempotencia. La confirmación deberá devolver el compromiso y el movimiento de una misma transacción para actualizar coherentemente historial, cuentas, presupuestos y dashboard. El BFF NestJS expondrá los avisos y su estado de lectura, y la zona horaria provendrá del perfil autenticado. La demo usa `America/Santiago` del perfil de Camila. Los tipos de presentación y las hipótesis del simulador viven en el frontend. [Eventos de compromisos](../docs/DOMAIN_EVENTS.md#avisos-de-cobros-y-pagos)

Para Gastos hormiga, `ms-transacciones` tendrá la autoridad sobre detección, indicadores y proyecciones. Quedan por definir consultas GraphQL por período para resumen, series, patrones e historial paginado con referencia al movimiento, y mutaciones para guardar preferencias y clasificar gastos individualmente o en lote. Una clasificación múltiple requiere autorización sobre todos los IDs y aplicación atómica. El BFF deberá incluir el corte, la zona horaria y la versión del criterio en las respuestas derivadas.

El adaptador `FinancialHealthRepository` es el punto de integración para recibir la evaluación de `ms-transacciones` mediante Apollo Client y GraphQL. El BFF invocará a `ms-agente-mcp` mediante gRPC y el agente consultará los datos autorizados de Usuarios y Transacciones por gRPC. El planificador de **Metas de ahorro** recibe la estimación del simulador de Gastos hormiga y la usa junto con el faltante efectivo de una meta.

Para **Metas de ahorro** quedan por definir consultas GraphQL para resumen, disponibilidad por cuenta, metas, historial paginado y proyección con fecha de corte. Las mutaciones de alta con aporte inicial, edición, aporte, liberación, pausa, reactivación y cierre deben devolver el estado, el historial efectivo y la disponibilidad actualizada. `ms-transacciones` tendrá a cargo la validación de fondos, el control de concurrencia, la idempotencia y la atomicidad de cada operación. Para Salud financiera y la futura herramienta MCP `get_savings_progress`, el contrato debe incluir totales, aportes netos, estados, plan y proyecciones calculados por ese servicio. El BFF expondrá las notificaciones y el estado de lectura. [Eventos de ahorro](../docs/DOMAIN_EVENTS.md#avisos-de-metas-de-ahorro)

## Extensiones de dominio pendientes de aprobación

- **Ajuste de saldo.** La demostración guarda fecha, motivo, saldo registrado a esa fecha, saldo real y diferencia en un registro independiente. La diferencia afecta saldos y series. Los cálculos de ingresos, gastos, presupuestos y hormiga usan movimientos efectivos. Queda por aprobar el agregado o entidad de ajuste, su eventual reversión y el contrato GraphQL.
- **Archivo con saldo y relaciones.** La demostración permite archivar cuentas con saldo y avisa si hay compromisos asociados. Las reservas vigentes deben liberarse antes de archivar. El patrimonio registrado conserva el saldo de la cuenta y su historial. Esta política amplía RN-04 y requiere acordar cómo resolver compromisos asociados a cuentas archivadas.
- **Disponibilidad y reservas.** El resumen calcula el disponible no reservado como saldo registrado menos reservas. Las transferencias se validan contra el menor saldo libre de origen entre el día efectivo y hoy. Queda pendiente aprobar con Financiero la validación definitiva de reservas por cuenta bajo concurrencia.
- **Eliminación definitiva.** La demostración exige saldo cero y ausencia de referencias, incluso cuando un movimiento previo ya se eliminó del historial visible. Queda por acordar la política de auditoría y el contrato de eliminación en el BFF.
- **Planificación presupuestaria.** Los estados de consumo usan cortes fijos de 80 % y 100 %. El umbral de aviso de cada presupuesto admite enteros de 1 a 100 y comienza en 80 %. Hay que aprobar el campo opcional de descripción, el umbral por presupuesto y su precedencia frente a la regla global de RN-11.
- **Edición y copia de presupuestos.** La demo permite crear, editar y copiar hacia el mes corriente o futuro, en línea con RN-08. La eliminación confirmada retira el límite de la comparación histórica y conserva los gastos y saldos. La copia completa se procesa bajo una única operación y requiere resolver todos los conflictos antes de escribir. Quedan por aprobar los contratos de copia, eliminación y auditoría histórica.
- **Proyección y avisos.** El cálculo usa los días gregorianos del mes, incluye el día de corte y redondea hacia abajo el margen diario en CLP. La estimación lineal requiere tres días transcurridos, días por delante y gastos en al menos dos fechas. Un movimiento que concentra más del 75 % del consumo se señala en el detalle. El BFF deberá exponer el historial, las métricas, la gestión de límites y los avisos del servidor. [Propuesta de eventos presupuestarios](../docs/DOMAIN_EVENTS.md#propuesta-de-eventos-de-consumo-presupuestario)
- **Reprogramación y auditoría de compromisos.** La demo permite mover un pendiente vencido a hoy o a una fecha futura y conserva el primer vencimiento. Queda por aprobar esta ampliación de RN-06, el campo de vencimiento original y el historial de cambios de fecha, monto y cuenta.
- **Confirmación y correcciones.** La confirmación conserva el monto previsto y genera un solo movimiento. Un reintento con la misma fecha devuelve el resultado existente. Un reintento con otra fecha devuelve un conflicto. Quedan por acordar el contrato de idempotencia y una operación de reversión o corrección de fecha, monto o cuenta para compromisos confirmados. Los movimientos vinculados admiten reclasificación compatible y mantienen ambos vínculos.
- **Gastos hormiga.** La demo amplía RN-09 con umbral inicial de 5.000 CLP, agrupación por descripción normalizada y categoría, estado analítico excluido y marcas manuales de necesario o prescindible incluidas independientemente del criterio automático. Queda por acordar la versión del algoritmo, origen y fecha de la revisión, exclusiones por categoría, activación de detección, vista de frecuencia y el historial de cambios de preferencia. La clasificación pertenece al movimiento efectivo.
- **Metas de ahorro.** La demo propone asignar cada reserva a una cuenta y conservar fecha local, instante de registro y motivo. Amplía RN-10 con objetivo editable en progreso, metadatos visuales, fecha objetivo, aporte planificado, estado de pausa y cierres diferenciados por finalización o cancelación. Queda por aprobar el modelo de transiciones, la política de fechas efectivas retroactivas y la auditoría de hitos, ediciones y cierres.

Los términos y políticas aprobados previamente se encuentran en las [reglas de negocio](../docs/BUSINESS_RULES.md).
