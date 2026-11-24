# Billetera Virtual · Dashboard, Movimientos, Mis cuentas y Presupuestos

Frontend de demostración en React, TypeScript, Tailwind CSS y shadcn/ui, con iconos Lucide y gráficos Recharts. Usa pesos chilenos y toma la fecha de corte en `America/Santiago`.

## Ejecutar en local

Usa Node.js 22.12 o superior. Desde la raíz del repositorio ejecuta:

```sh
cd frontend
npm ci
npm run dev
```

Abre la URL que imprime Vite. `npm run build` comprueba TypeScript y genera `dist/`. `npm run preview` sirve esa compilación.

Dashboard, Movimientos, Mis cuentas y Presupuestos comparten los registros de demostración en memoria. Al recargar se restablecen los datos iniciales. Las alertas presupuestarias se calculan desde los límites y gastos registrados. Las reservas para metas de ahorro, la salud financiera y las respuestas del asistente se basan en los datos de demostración.

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

Para ejecutar las pruebas de integración con Chromium, instala el navegador de Playwright una vez:

```sh
npx playwright install chromium
npm test
```

Puedes ejecutar las mismas pruebas con un Edge instalado usando `PLAYWRIGHT_CHANNEL=msedge`. [Navegadores compatibles con Playwright](https://playwright.dev/docs/browsers)

`npm run test:unit` ejecuta solo las pruebas de cálculo de presupuestos con Node.js.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `src/features/dashboard/dashboard.tsx` | Composición del dashboard y controles compartidos. |
| `src/features/dashboard/` | Navegación, tarjetas, gráficos, vistas y formulario de registro. |
| `src/features/dashboard/mock-data.ts` | Cuentas, categorías, movimientos, presupuestos, compromisos y datos de análisis de ejemplo. |
| `src/features/dashboard/use-dashboard.ts` | Derivación de saldos, actividad, presupuestos y gastos hormiga desde los movimientos compartidos. |
| `src/features/dashboard/movement-dialog.tsx` | Formulario reutilizado para registrar y editar. |
| `src/features/movements/transactions-page.tsx` | Pantalla, resumen e interacción del historial. |
| `src/features/movements/transaction-filters.tsx` y `transaction-history.tsx` | Filtros, tabla, tarjetas móviles, acciones y paginación. |
| `src/features/movements/transaction-dialogs.tsx` | Detalle y confirmación de eliminación. |
| `src/features/movements/movement-data.ts` y `history.ts` | Validaciones, detección, filtros y CSV. |
| `src/features/accounts/accounts-page.tsx`, `account-cards.tsx` y `account-charts.tsx` | Resumen, cuentas activas y archivadas, acciones y gráficos de distribución y evolución. |
| `src/features/accounts/account-dialogs.tsx` | Alta, vista previa, edición, detalle, ajuste y confirmaciones. |
| `src/features/accounts/account-data.ts` y `account-balances.ts` | Repositorio simulado compartido y cálculo de saldos. |
| `src/features/budgets/` | Planificación mensual, validaciones, consumo, ritmo, alertas, detalle y gráficos. |
| `tests/movements.spec.ts` | Pruebas de integración en navegador. |
| `tests/accounts.spec.ts` | Pruebas de saldos compartidos, transferencias, ajustes, archivo, eliminación y privacidad. |
| `tests/budgets.spec.ts` y `tests/budget-calculations.unit.ts` | Pruebas de flujos de presupuesto, calendario, estados, consumo y proyecciones. |
| `src/components/ui/` | Primitivas reutilizables para botones, campos, diálogos y avisos emergentes. |
| `src/index.css` | Tema oscuro y tokens de color y tipografía de Tailwind. |

## Integración con GraphQL

El punto de integración es `FinancialRepository`, que consume `useFinancialRecords`. Cuando exista el esquema del BFF, configura Apollo Client y `ApolloProvider` en `src/main.tsx` y conecta el repositorio a consultas y mutaciones tipadas. El servicio financiero tendrá a cargo los saldos y series históricas, la autorización, la idempotencia y la ejecución atómica de cada transferencia. Los importes CLP se mapearán sin pérdida de precisión. El historial y el período de análisis conservarán su independencia al pasar a consultas del servidor. [Documentación de Apollo Client](https://www.apollographql.com/docs/react/get-started)

## Extensiones de dominio pendientes de aprobación

- **Ajuste de saldo.** La demostración guarda fecha, motivo, saldo registrado a esa fecha, saldo real y diferencia en un registro independiente. La diferencia afecta saldos y series. Los cálculos de ingresos, gastos, presupuestos y hormiga usan movimientos efectivos. Queda por aprobar el agregado o entidad de ajuste, su eventual reversión y el contrato GraphQL.
- **Archivo con saldo y relaciones.** La demostración permite archivar después de avisar sobre reservas o compromisos. El patrimonio registrado conserva el saldo de la cuenta y su historial. Las nuevas operaciones requieren reactivarla. Esta política amplía RN-04 y requiere acordar cómo resolver compromisos asociados a cuentas archivadas.
- **Disponibilidad y reservas.** El resumen calcula el disponible no reservado como saldo registrado menos reservas. Para validar una transferencia se usa el menor saldo entre la fecha efectiva y hoy, descontando la reserva asociada al origen. Las metas existentes de demostración se atribuyen a la cuenta de ahorro. Queda pendiente aprobar con Financiero la asignación y liberación de reservas por cuenta, así como la validación definitiva frente a concurrencia.
- **Eliminación definitiva.** La demostración exige saldo cero y ausencia de referencias, incluso cuando un movimiento previo ya se eliminó del historial visible. Queda por acordar la política de auditoría y el contrato de eliminación en el BFF.
- **Planificación presupuestaria.** Los estados de consumo usan cortes fijos de 80 % y 100 %. El umbral de aviso de cada presupuesto admite enteros de 1 a 100 y comienza en 80 %. Hay que aprobar el campo opcional de descripción, el umbral por presupuesto y su precedencia frente a la regla global de RN-11.
- **Edición y copia de presupuestos.** La demo permite crear, editar y copiar hacia el mes corriente o futuro, en línea con RN-08. La eliminación confirmada retira el límite de la comparación histórica y conserva los gastos y saldos. La copia completa se procesa bajo una única operación y requiere resolver todos los conflictos antes de escribir. Quedan por aprobar los contratos de copia, eliminación y auditoría histórica.
- **Proyección y avisos.** El cálculo usa los días gregorianos del mes, incluye el día de corte y redondea hacia abajo el margen diario en CLP. La estimación lineal requiere tres días transcurridos, días por delante y gastos en al menos dos fechas. Un movimiento que concentra más del 75 % del consumo se señala en el detalle. El BFF deberá exponer el historial, las métricas, la gestión de límites y los avisos del servidor. [Propuesta de eventos presupuestarios](../docs/DOMAIN_EVENTS.md#propuesta-de-eventos-de-consumo-presupuestario)

Los términos y políticas aprobados previamente se encuentran en las [reglas de negocio](../docs/BUSINESS_RULES.md).
