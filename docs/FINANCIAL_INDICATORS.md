# Indicadores financieros

Financiero calcula estas consultas sobre los registros vigentes del usuario. Cada respuesta identifica la moneda, la fecha de corte o el período consultado, la zona horaria utilizada y el instante de cálculo. Cuando intervenga el criterio de gastos hormiga, también identifica la versión de preferencias. Cada consulta toma la configuración vigente y una vista consistente de sus datos financieros. Una carga tardía, anulación o reclasificación recalcula resultados históricos según los datos vigentes al consultar.

## Saldos, evolución y estadísticas

Sea `d` una fecha local hasta hoy. `movimientosVigentes(c, d)` representa las operaciones efectivas de una cuenta hasta `d`, incluidas las piernas de transferencias. El signo es positivo para ingresos y entradas de transferencia y negativo para gastos y salidas de transferencia.

```text
saldoCuenta(c, d) = saldoInicial(c) + suma(movimientosVigentes(c, d) con signo)
saldoGlobal(d) = suma(saldoCuenta(c, d) para cuentas abiertas hasta d)
saldoActual = saldoGlobal(hoy)
reservaActual = suma de reservas netas de todas las metas
saldoDisponible = saldoActual - reservaActual
```

Una cuenta aporta a la serie desde su apertura, inclusive. Se considera también el historial de cuentas posteriormente archivadas. El punto de inicio de cada día es el cierre del anterior, y el cierre de un día incluye todas las operaciones con fecha efectiva en ese día. El tramo anterior a la primera apertura se identifica como sin historial. Una serie mensual toma el cierre de cada mes, y el punto del mes corriente usa el corte de hoy y se marca parcial.

Por rango de fechas inclusivo, las estadísticas devuelven total de ingresos, total de gastos, flujo neto `ingresos - gastos`, conteo de movimientos efectivos de cada tipo y desglose de ingresos y gastos por categoría. Se excluyen saldos iniciales, compromisos pendientes, transferencias y aportes de ahorro del flujo y los desgloses. La serie de saldo por cuenta sí incluye saldos iniciales y transferencias. En un rango sin movimientos, los totales y conteos son cero y se informa que el rango carece de movimientos efectivos. Los porcentajes con denominador cero se devuelven sin valor.

## Proyección de flujo de caja

El usuario puede consultar desde hoy hasta una fecha futura inclusiva. Para cada compromiso pendiente en el horizonte, su fecha proyectada es `max(hoy, fechaVencimiento)`. Esta regla asigna a hoy los compromisos vencidos, con su vencimiento original visible. COBRO suma y PAGO resta. Los compromisos confirmados ya están reflejados en el saldo inicial de la proyección y los cancelados quedan excluidos.

```text
saldoProyectado(d) = saldoActual + suma de compromisos pendientes con signo
                                 y fecha proyectada <= d
disponibleProyectado(d) = saldoProyectado(d) - reservaActual
```

Cada punto expone cobros, pagos, saldo proyectado y disponible proyectado, con una reserva constante durante el horizonte. Los días sin compromisos conservan el saldo proyectado anterior. Un resultado negativo muestra el déficit estimado. La respuesta permite detectar el primer día con saldo proyectado negativo e identifica el vencimiento original de las partidas vencidas. La proyección utiliza compromisos registrados y supone su aplicación por el monto total. Si un cobro vencido de 10.000 y un pago futuro de 25.000 son los únicos pendientes y el saldo actual es 100.000 CLP, la proyección comienza en 110.000 CLP y baja a 85.000 CLP en la fecha del pago.

## Consumo de presupuestos

Para el presupuesto de límite `L > 0` de una categoría de gasto, `C` es la suma de sus gastos efectivos vigentes en el mes hasta la fecha de corte. Un período cerrado usa su último día y un período futuro comienza con consumo cero.

```text
restante = L - C
exceso = max(0, C - L)
porcentajeConsumido = 100 * C / L
```

Un restante negativo señala un exceso. El porcentaje puede superar `100`. La alerta compara los enteros exactos mediante `100 * C >= umbral * L` antes de redondear.

## Detección de gastos hormiga

1. Seleccionar los gastos efectivos vigentes del mes consultado hasta el corte y con `0 < monto <= montoMaximo`.
2. Excluir los gastos marcados `NECESARIO`. Las marcas `AUTOMATICA` y `PRESCINDIBLE` participan y se devuelven con su valor original.
3. Agrupar los candidatos por `categoriaId` dentro del mes calendario. Un grupo se identifica como gasto hormiga cuando su conteo es igual o superior a `frecuenciaMinima`.
4. Devolver los grupos que cumplen, con conteo, suma, movimientos que los componen y criterios utilizados. El total hormiga `A` suma una vez cada movimiento incluido.

Con criterios de 3.000 CLP y tres ocurrencias, tres gastos elegibles de 1.000, 2.000 y 3.000 CLP en la misma categoría suman 6.000 CLP. Si uno se marca `NECESARIO`, el grupo queda con dos candidatos y desaparece del resultado. Los meses y categorías se evalúan independientemente. Si hay gastos registrados y ninguno satisface los criterios, el total hormiga es cero. Cuando falten gastos registrados, la consulta conserva la indicación de ausencia de datos efectivos.

## Indicador de salud financiera

El indicador orientativo usa una fórmula versionada (`v1`) y una escala de `0` a `100`. Su finalidad es describir los registros personales disponibles. Carece de uso como evaluación crediticia. Por defecto evalúa el último mes calendario cerrado en la zona del usuario y permite seleccionar otro mes cerrado. La fecha de apertura más temprana declara el inicio del historial disponible. Un mes que comienza antes de esa fecha, un mes aún abierto o la ausencia de cuentas dan estado `DATOS_INSUFICIENTES`. Registrar movimientos de un mes completo permite medir los componentes aplicables, pero el modelo carece de una fuente externa que certifique la integridad de lo registrado.

`I` representa ingresos efectivos vigentes del mes, `G` gastos efectivos vigentes y `A` el total de gastos hormiga definido arriba. `clamp(x)` acota `x` a `[0, 1]`. `N/D` indica un componente sin datos aplicables para la fórmula.

| Componente | Peso | Fórmula y categorías límite |
| --- | --- | --- |
| Capacidad de ahorro | 30 % | Si `I > 0`, `100 * clamp((I - G) / (0,20 * I))`. Un excedente de `20 %` o más obtiene 100. Si `I = 0` y `G > 0`, obtiene 0. Si `I = G = 0`, `N/D`. Los aportes reservados quedan fuera del cálculo. |
| Cumplimiento de presupuestos | 25 % | Con al menos un presupuesto del mes y `I + G > 0`, `100 * clamp(1 - suma(max(0, Cc - Lc)) / suma(Lc))`, donde `Cc` y `Lc` son consumo y límite de cada presupuesto. Un presupuesto holgado aporta límite al denominador y su margen queda fuera de la suma de excesos. Sin presupuesto o sin actividad efectiva en el mes, `N/D`. |
| Equilibrio entre ingresos y gastos | 20 % | Si `G > 0`, `100 * clamp(I / G)`. Si `G = 0` e `I > 0`, obtiene 100. Si `I = G = 0`, `N/D`. Este componente mide cobertura de gastos y el de ahorro mide excedente sobre ingresos. |
| Control de gastos hormiga | 15 % | Si `G > 0`, `100 * clamp(1 - A / (0,20 * G))`. Si `A = 0`, obtiene 100. Una proporción hormiga de `20 %` o más obtiene 0. Con `G = 0`, `N/D`. |
| Cumplimiento de pagos | 10 % | Con uno o más pagos exigibles con vencimiento en el mes, `100 * pagosPuntuales / pagosExigibles`. Sin pagos exigibles, `N/D`. |

Se evalúan los compromisos `PAGO` por su fecha de vencimiento registrada. Un pago confirmado es puntual si su movimiento efectivo tiene fecha igual o anterior al vencimiento, aunque se haya anotado después. Un pago que siga pendiente al consultar, uno confirmado con fecha efectiva posterior al vencimiento y uno cancelado después del vencimiento cuentan como exigibles e impuntuales. Un pago cancelado hasta la fecha de vencimiento inclusive queda fuera del denominador. Los compromisos de cobro quedan fuera de este componente. Una corrección de los registros puede cambiar la lectura retrospectiva del mes.

```text
cobertura = suma de pesos de los componentes con valor
puntuacion = suma(peso * componente) / cobertura, si cobertura >= 60
```

Los pesos se expresan como enteros porcentuales. Si la cobertura es menor a 60 o el mes no cumple la condición inicial de observación, el resultado tiene puntuación nula y estado `DATOS_INSUFICIENTES`. Con cobertura entre 60 y 99, el estado es `PARCIAL`. Con cobertura de 100, el estado es `COMPLETO`. La respuesta informa componentes, valores de entrada, pesos, cobertura, razones de insuficiencia y versión. Los cocientes se calculan con aritmética exacta o decimal de precisión suficiente. Se acota antes de redondear y se redondea solo la puntuación final al entero más cercano, con mitades al entero superior. Los valores de componente pueden presentarse con dos decimales sin afectar la suma.

| Ejemplo | Resultado esperado |
| --- | --- |
| Mes observado con `I = 1.000.000`, `G = 850.000`, límites totales de 500.000, excesos sumados de 50.000, `A = 85.000` y tres pagos puntuales de cuatro exigibles | Componentes `75, 90, 100, 50, 75`, cobertura 100 y puntuación 80. |
| Mismos ingresos, gastos y hormiga, sin presupuesto ni pagos exigibles | Cobertura 65, puntuación 77 y estado `PARCIAL`. |
| Mes observado solo con ingresos y sin presupuestos ni pagos exigibles | Ahorro y equilibrio obtienen 100, cobertura 50 y puntuación nula. |
| Mes sin registros de ingresos, gastos, presupuestos ni pagos | Cobertura 0 y puntuación nula. |
