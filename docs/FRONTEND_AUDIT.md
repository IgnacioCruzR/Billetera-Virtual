# Auditoría de integración del frontend

## Dictamen del Prompt 11-B

**APROBADO CON OBSERVACIONES.** La demo compila, sus diez pantallas funcionan y el escenario financiero aislado coincide con los resultados esperados. El frontend queda preparado para incorporar los contratos del BFF. La cobertura cuantitativa de la UI, la ejecución del contenedor y la integración autenticada se verifican por separado.

La verificación del Prompt 12 posterior confirmó Docker Desktop y la imagen Nginx con las diez rutas. El resultado de Docker de este informe corresponde al Prompt 11-B. [Evidencia histórica](https://github.com/IgnacioCruzR/Billetera-Virtual/blob/292e0dfd05126a290daca225c60bae65247c3282/docs/LOCAL_DEVELOPMENT.md#registro-del-prompt-12) · [Verificación multirepositorio](VERIFICATION_12B.md)

## Diagnóstico técnico

Se revisaron el checkout que contiene `frontend/`, los modelos y reglas del dominio, las dependencias, el empaquetado y la topología escrita. `Stack.jpeg`, `Topologia.jpeg` y `Arquitecturajpeg.jpeg` no aparecieron en el workspace ni en los adjuntos examinados. [Stack](../TECH_STACK.md) · [Topología](TOPOLOGY.md)

| Severidad | Hallazgo y evidencia | Corrección o decisión |
| --- | --- | --- |
| Crítica | Las 12 invariantes financieras se contrastaron con pruebas unitarias y de navegador. También se comprobó el aislamiento demo y la compilación. | Sin hallazgos críticos en el alcance verificado. |
| Alta | En `dashboard.tsx` y `use-settings-session.ts`, la UI construía proveedores demo. Apollo estaba declarado en el manifiesto. | `src/app` selecciona `demo` o `integration`. La raíz demo inyecta fuentes propias de sesión. En integración, Apollo usa `/graphql` del mismo origen y espera el esquema. |
| Alta | `account-data.ts` tomaba referencias de los datos de ejemplo al construir el repositorio. La autorización remota, la concurrencia y la persistencia aún dependen del BFF y de los servicios. | Cada instancia recibe su propia copia del libro. E2E confirma que el otro repositorio rechaza un compromiso ajeno. El plan de GraphQL registra controles transaccionales y de sesión pendientes. |
| Media | `package.json` carecía de lint. ESLint detectó dependencias innecesarias en tres llamadas a `useMemo`. | Reglas recomendadas JS y TS y reglas de Hooks, con cero desactivaciones para silenciar esos errores. Presupuestos recibe el corte del Dashboard. El análisis y su identificador se derivan del mismo contexto. CI ejecuta `npm run lint`. |
| Media | El fallback estático servía la aplicación en `/movimientos`, pero la UI solo reconocía el hash. | `dashboard.tsx` interpreta las rutas internas directas, conserva su consulta y usa la navegación hash existente. El paquete de producción abrió las diez rutas. |
| Media | El 60 % de CI medía únicamente archivos cargados por la suite unitaria. | Se reprodujo el indicador y se registró el alcance exacto. Se añadió medición de sentencias sobre el mismo conjunto con Istanbul. |
| Media | `docker version` no alcanzó el servidor y `com.docker.service` estaba detenido. | Revisión estática del Dockerfile, `.dockerignore`, Nginx y CI, más verificación del paquete de producción con Vite. Prueba del contenedor pendiente de entorno. |
| Baja | ESLint 9.39.5 conserva compatibilidad con Node 22.12. La línea 9 está fuera de soporte. | Versión de desarrollo fijada. Revisar el salto a ESLint 10 junto con el mínimo de Node, ya que requiere al menos 22.13 dentro de esa línea. |

`src/features/` agrupa modelos, cálculos, hooks y pantallas por dominio. Las primitivas compartidas están en `components/ui/` y las fechas, formato y CSV en `lib/`. `FinancialRepository` entrega un libro común para cuentas, movimientos, presupuestos, compromisos, metas, reservas y categorías. Las proyecciones y los indicadores se derivan de ese libro. Configuración comparte las preferencias guardadas y las pantallas conservan estados de interfaz como filtros o modales. Los adaptadores de acceso tienen interfaces separadas de los modelos de presentación.

Node 22.21.0 ejecutó la verificación. El lockfile mantiene React 19.3.1, TypeScript 5.9.3, Apollo Client 4.3.8, Recharts 3.11.1, Tailwind 4.3.5 y Vite 8.3.8. La comparación con el lockfile previo dio cero cambios de versión en dependencias de ejecución. El cambio de herramientas se limita a ESLint, TypeScript ESLint, el plugin Hooks y el medidor de sentencias. [Alcance de versiones ESLint](https://eslint.org/version-support/) · [Versiones de Node para ESLint 10](https://eslint.org/docs/latest/use/migrate-to-10.0.0) · [Reglas de dependencias de Hooks](https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps)

Se conservaron las correcciones previas de períodos comparables con el mismo día de corte, omisión cuando falta historial equivalente, filtros monetarios ocultos y separación de ajustes y movimientos efectivos. Los umbrales guardados de cada presupuesto se mantienen independientes del valor inicial de Configuración. [Seguridad comprobada y controles pendientes](SECURITY_REQUIREMENTS.md)

## Comandos y resultados

Ejecutados desde `frontend/`, salvo la consulta al daemon. Playwright usó `PLAYWRIGHT_CHANNEL=msedge`.

| Comando | Código | Resultado |
| --- | ---: | --- |
| `npm run typecheck` | 0 | TypeScript estricto |
| `npm run build` | 0 | Paquete demo generado con Vite |
| `npm run lint` | 0 | 0 errores y 0 advertencias |
| `npm run test:unit` | 0 | 37 aprobadas, 0 fallidas y 0 omitidas |
| `npm run test:e2e -- financial-integration.spec.ts` | 0 | Escenario obligatorio aprobado en Edge |
| `npm run test:e2e` | 0 | 40 aprobadas en Edge, 0 fallidas. Incluye las 39 pruebas anteriores y el nuevo escenario |
| `npm run test:coverage` | 0 | 37 aprobadas. Líneas 95,64 %, ramas 81,98 % y funciones 89,96 % |
| `npm run test:coverage:statements` | 0 | 1.568 de 1.836 sentencias JavaScript instrumentadas, 85,40 % |
| `npm audit --omit=dev --json` | 0 | 0 avisos en dependencias de ejecución en el registro consultado |
| Vite `build --outDir <temporal>` con `VITE_DATA_MODE=integration` y `preview` de ambos paquetes con Edge | 0 | 60 aperturas directas en demo. Integración cargó su pantalla sin solicitudes de API. |
| `docker version` | 1 | Cliente 28.5.1 disponible. Acceso denegado al canal del daemon. |

El escenario de cobertura anterior se reejecutó con Node y el mismo filtro de `src/`, omitiendo solo `bff-client.unit.ts`. Dio código 0, 35 aprobadas, 95,60 % de líneas, 81,86 % de ramas y 89,89 % de funciones.

### Cobertura

Node mide líneas, ramas y funciones del código de `src/` cargado por `tests/*.unit.ts`. Con `--test-reporter=lcov`, las 33 entradas `SF` coinciden con esta lista. El comando de Istanbul transpila ese mismo conjunto con TypeScript, suma contadores de sentencias de los procesos de prueba y conserva su propio denominador. Las cifras de Istanbul describen el JavaScript instrumentado.

| Directorio bajo `src/` | Archivos medidos, con extensión `.ts` |
| --- | --- |
| `app` | `bff-client`, `data-mode` |
| `features/accounts` | `account-balances` |
| `features/assistant` | `assistant-actions`, `assistant-analysis`, `assistant-model`, `assistant-provider`, `assistant-request`, `assistant-response`, `purchase-impact` |
| `features/budgets`, `features/categories` | `budget-calculations`, `category-model` |
| `features/commitments`, `features/dashboard` | `cash-flow`, `commitment-model`, `commitment-records`, `financial-period` |
| `features/health` | `health-assessment`, `health-data`, `health-model`, `health-recommendations` |
| `features/micro-expenses`, `features/movements` | `micro-expense-analysis`, `micro-expense-detection`, `micro-expense-model`, `movement-csv` |
| `features/savings` | `savings-ledger`, `savings-model`, `savings-planning`, `savings-records` |
| `features/settings`, `lib` | `preferences-model`, `settings-data`, `settings-export`, `calendar`, `csv` |

Quedan fuera 74 de los 107 archivos TypeScript de `src/`, incluidos los 59 `.tsx` y los 15 `.ts` de la lista.

- `app/demo-sources.ts`, `components/ui/use-dialog-submission.ts`, `features/accounts/account-data.ts` y `lib/utils.ts`.
- `features/assistant/{assistant-result-labels,use-assistant-session}.ts`, `features/budgets/budget-model.ts` y `features/categories/category-context.ts`.
- `features/dashboard/{demo-notifications,mock-data,model,use-dashboard}.ts`, `features/movements/{history,movement-data}.ts` y `features/settings/use-settings-session.ts`.

El filtro excluye también estilos, recursos, scripts, configuraciones, dependencias y el código de las pruebas. La orquestación del libro y el historial, las raíces por modo, el cierre de sesión, la revocación de IA y los diálogos se ejercitan en navegador. Esas ejecuciones quedan fuera de los porcentajes. Entre los archivos medidos, `account-balances.ts` tiene 63,79 % de líneas y el escapado `lib/csv.ts` tiene 58,33 %. El mínimo de 60 % de CI se verifica para la suite unitaria. Queda pendiente medir un mínimo equivalente para todo el frontend.

## Escenario financiero integrado

La prueba `financial-integration.spec.ts` inyecta un libro temporal en su contexto de Playwright, con banco de 400.000 CLP, efectivo de 100.000 CLP y presupuesto de Alimentación de 100.000 CLP. Registra ingreso de 300.000, gasto de 50.000, transferencia interna de 100.000, reserva de 80.000, alta y confirmación de un pago de 40.000, reintento de esa confirmación y liberación de 20.000. Una ventana independiente verifica que la demo original conserva su saldo de 2.485.600 CLP.

| Indicador final | Esperado y observado, CLP | Evidencia UI |
| --- | ---: | --- |
| Banco | 510.000 | Mis cuentas |
| Efectivo | 200.000 | Mis cuentas |
| Saldo total | 710.000 | Dashboard, Cobros y pagos, Salud y Asistente |
| Reservado | 60.000 | Metas, Salud y Asistente |
| Libre | 650.000 | Dashboard, Metas, Salud y Asistente |
| Ingresos | 300.000 | Dashboard, Movimientos y Asistente |
| Gastos | 90.000 | Dashboard, Movimientos y Asistente |
| Neto | 210.000 | Movimientos, Salud y Asistente |
| Pagos pendientes | 0 | Cobros y pagos |
| Alimentación | 50.000 de 100.000 (50 %) | Presupuestos y Salud |

La confirmación deja un solo movimiento vinculado y la exportación contiene cuatro registros efectivos. El análisis de Gastos hormiga presenta cero candidatos para ese libro. La prueba verifica que el segundo repositorio conserva ambos saldos iniciales y carece de movimientos y compromisos del otro usuario.

### Invariantes y pruebas

| Invariante | Evidencia automatizada aprobada |
| --- | --- |
| Saldos iniciales fuera de ingresos | `financial-integration.spec.ts` verifica 500.000 de saldo y cero efectivos antes de operar |
| Transferencias neutrales al saldo total | `financial-integration.spec.ts` mantiene 750.000 tras transferir y `accounts.spec.ts` compara las cuentas |
| Aportes fuera de gastos | `financial-integration.spec.ts` conserva el saldo tras aportar y termina con solo 90.000 de gastos efectivos |
| Liberaciones fuera de ingresos | `financial-integration.spec.ts` libera 20.000 y conserva 300.000 de ingreso efectivo |
| Compromisos pendientes fuera de saldos actuales | `financial-integration.spec.ts` y `commitments.spec.ts` comparan antes de confirmar |
| Confirmación sin duplicados | `financial-integration.spec.ts` reintenta en el repositorio y `cash-flow.unit.ts` verifica el vínculo único |
| Presupuestos basados en gastos efectivos | `budget-calculations.unit.ts`, `budgets.spec.ts` y escenario integrado |
| Gastos hormiga sin duplicados | `micro-expenses.unit.ts` y `micro-expenses.spec.ts` combinan patrones y selección individual sobre el movimiento original |
| Simulaciones aisladas | `cash-flow.unit.ts`, `micro-expenses.spec.ts`, `savings.spec.ts` y `health.spec.ts` comprueban cambios hipotéticos y registros originales |
| Salud explicita datos insuficientes | `health.unit.ts` verifica denominadores, historial, disponibilidad y puntuación nullable |
| Reserva por cuenta sin doble uso entre metas | `savings.unit.ts` y `savings.spec.ts` rechazan reservas y operaciones por encima del saldo libre |
| Aislamiento entre usuarios y sesiones | `financial-integration.spec.ts`, `settings.spec.ts` y `bff-client.unit.ts` verifican ID ajeno, repositorio nuevo al reingresar y caché nueva |

## Matriz de pantallas

Las diez rutas abrieron a 320, 390, 768, 1024, 1440 y 1920 px en el paquete demo, sin desbordamiento horizontal de la página, errores de ejecución ni solicitudes externas. En cada ancho se comprobó recurso estático, gráfico de evolución, menú, lista o tabla de Movimientos, campo de monto y apertura/cierre de diálogo con teclado y retorno de foco. Son comprobaciones representativas de accesibilidad.

| Pantalla | Ruta | Evidencia funcional |
| --- | --- | --- |
| Dashboard | `/` | `movements.spec.ts`, `dashboard-period.unit.ts` y escenario integrado. Totales, corte comparable y gráficos |
| Movimientos | `/movimientos` | `movements.spec.ts` (7). Registro, edición, historial, filtros, transferencia, CSV y privacidad |
| Mis cuentas | `/cuentas` | `accounts.spec.ts` (4). Ajustes, historial, fondos reservados y estados |
| Presupuestos | `/presupuestos` | `budgets.spec.ts` (4). Consumo efectivo, reclasificación, copia y detalle |
| Cobros y pagos | `/compromisos` | `commitments.spec.ts` (4). Calendario, confirmación, proyección y déficit hipotético |
| Gastos hormiga | `/hormiga` | `micro-expenses.spec.ts` (3). Detección compartida, clasificación y simulación deduplicada |
| Metas de ahorro | `/metas` | `savings.spec.ts` (4). Reservas, liberación, estados y planificador |
| Salud financiera | `/salud` | `health.spec.ts` (4) y `health.unit.ts`. Pilares, metodología, error y simulación |
| Asistente IA | `/asistente` | `assistant.spec.ts` (4) y `assistant.unit.ts`. Seis informes, consentimiento, navegación y cancelación |
| Configuración | `/configuracion` | `settings.spec.ts` (5) y `settings.unit.ts`. Preferencias, catálogo, avisos, CSV, privacidad y cierre |

Las nueve suites previas suman 39 casos de navegador. El escenario integrado es el caso 40 y atraviesa las diez pantallas. Las cifras de la tabla indican casos por suite, con evidencia compartida para Dashboard.

## Empaquetado y etapa siguiente

El Dockerfile usa Node 22 Alpine para `npm ci` y la compilación. La etapa Nginx copia `dist/` y escucha en el puerto 8080. El contexto limita los archivos y excluye `.env*`, `.key` y `.pem`. Nginx configura `/healthz`, caché inmutable en recursos con hash, revalidación de `index.html` y fallback de rutas internas. `/graphql` y sus subrutas quedan reservadas con 404 en Nginx. El futuro Ingress enruta `/graphql` exacto al BFF. El workflow comprueba salud, recursos, fallback y el 404 reservado cuando ejecuta el contenedor.

En la siguiente etapa local, habilitar primero Docker y comprobar la imagen de demo con las diez rutas y los recursos. Acordar luego los contratos de sesión, autorización, libros y eventos entre propietarios, con pruebas reproducibles usando fixtures aislados. La preparación de servicios, PostgreSQL, Kafka e Ingress se rige por la topología oficial. [Pendientes y orden de integración](FRONTEND_INTEGRATION_STATUS.md) · [Operaciones candidatas](GRAPHQL_INTEGRATION_PLAN.md)
