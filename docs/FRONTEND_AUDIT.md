# Auditoría de integración del frontend

## Alcance y referencias revisadas

Se inspeccionó el checkout que contiene `frontend/`, la documentación de dominio y arquitectura, el README, los manifiestos, los módulos React y la configuración de pruebas y empaquetado. El adjunto disponible del Prompt 11 se interrumpe en el punto 8 de la Etapa A. La auditoría documenta el alcance verificable del texto recibido. Los archivos `Stack.jpeg`, `Topologia.jpeg` y `Arquitecturajpeg.jpeg` no estaban disponibles en el workspace ni en los adjuntos examinados. Se aplicaron el stack escrito y la topología documentada. [Stack](../TECH_STACK.md) · [Topología](TOPOLOGY.md)

| Superficie | Estado observado |
| --- | --- |
| Estructura | Un checkout local con `frontend/src/features`, primitivas en `components/ui`, utilidades en `lib` y pruebas en `frontend/tests`. Los servicios previstos son repositorios independientes y quedan fuera de esta implementación. |
| Dependencias | Node 22.21.0 en la verificación local. El lockfile fija React 19.3.1, Apollo Client 4.3.8, Recharts 3.11.1 y Lucide React 0.554.0. El frontend compila TypeScript con Vite y usa Tailwind y las primitivas compartidas de shadcn/ui. |
| Navegación | Layout compartido con Sidebar, Header, bandeja, perfil y registro rápido. Rutas hash, parámetros controlados para detalles y carga diferida de Configuración, Salud financiera y Asistente. |
| Estado y modelos | El repositorio financiero de sesión contiene cuentas, movimientos, transferencias, presupuestos, compromisos, metas, reservas y categorías. Configuración administra preferencias, avisos y consentimiento desde el mismo layout. El modo visual se aplica globalmente. |
| Comunicación efectiva | Demo en memoria. Las llamadas de la aplicación y las solicitudes de análisis usan adaptadores locales. Apollo Client figura como dependencia y el esquema GraphQL sigue pendiente. La entrada de red prevista de React es el BFF GraphQL con Apollo. |
| Empaquetado | El Dockerfile y Nginx sirven la SPA, reservan `/graphql` y exponen `/healthz`. El workflow incluye compilación, cobertura, Playwright y prueba del contenedor. El daemon Docker local carecía de un socket disponible para repetir el smoke test en este workspace. |

## Correcciones del alcance recibido

- El dashboard comparaba un acumulado parcial con meses anteriores completos. Los totales comparables usan el mismo día de corte. Si el mes comparable es más corto o el historial es insuficiente, la variación se omite. Movimientos, Mis cuentas y el dashboard usan el mismo cálculo de ventanas. Gastos hormiga aplica el mismo criterio para cortes abiertos.
- Los filtros de monto mostraban el mínimo y máximo en texto aun con privacidad activa. Los filtros y editores monetarios usan el mismo campo con ocultamiento. Se mantienen filtros y cifras efectivas al cambiar el modo visual.
- El umbral de presupuesto se toma al crear un registro. Los límites existentes mantienen su propio umbral. La proyección del dashboard muestra el horizonte configurado y los recordatorios usan el plazo de la bandeja.
- Las categorías dependen de los registros financieros. Se preservan los IDs históricos, se validan referencias al archivar o eliminar y los formularios nuevos filtran por estado. La exportación de Movimientos y de Configuración usa el mismo escapado CSV.
- La revocación de IA bloquea nuevas solicitudes y descarta la espera. La limpieza de informes y el cierre de sesión descartan respuestas tardías. La demo reconstruye el repositorio al volver a entrar.

## Integración y consistencia verificadas

| Módulo | Evidencia |
| --- | --- |
| Dashboard y Movimientos | Registro de los tres tipos, totales compartidos, filtros, CSV, privacidad y comparación temporal. Una transferencia cambia dos cuentas y conserva el saldo agregado. |
| Mis cuentas | Alta, ajustes de saldo sin modificar ingresos o gastos, edición, historial, transferencias, archivo, reservas y privacidad. |
| Presupuestos | Límites y consumo del libro, reclasificaciones, copia atómica, detalle, prevención de duplicados y categorías archivadas. |
| Cobros y pagos | Calendario, confirmación única, vínculo con movimiento, vencimientos, proyección, déficit temporal y simulación aislada. |
| Gastos hormiga | Candidatos por criterio compartido, marcas manuales conservadas, filtros y escenarios de reducción. |
| Metas de ahorro | Aportes y liberaciones, cambios de estado, disponibilidad por cuenta, planificador y uso de escenarios. |
| Salud financiera | Cinco pilares, fórmula versionada, ausencia explícita de datos, histórico reconstruido, simulación sin mutaciones y lectura compartida con dashboard. |
| Asistente IA | Seis informes estructurados, consentimiento, acciones de navegación validadas, privacidad, error, cancelación e historial temporal. |
| Configuración | Perfil y región, descarte y recuperación tras error, reglas de avisos, catálogo compartido, exportación, revocación y limpieza de sesión. |

Compilación y TypeScript aprobados. El runner de Node aprobó 35 pruebas y obtuvo 95,60 % de cobertura de líneas en los módulos de `src` que carga la suite unitaria. Playwright aprobó 39 pruebas en Edge. La revisión del paquete de producción abrió las diez rutas a 320 y 1440 px, con ancho de página dentro del viewport, sin errores de ejecución y sin solicitudes a otro origen. También se comprobó el cambio de corte a UTC en el registro rápido y la visibilidad inicial de montos después de recargar. El proyecto carece de un script de lint. [README y comandos](../frontend/README.md)

## Brechas para la integración

- Las reglas de la demo operan sobre datos volátiles. Los servicios deberán asumir persistencia, autenticación, autorización por recurso, concurrencia, idempotencia y auditoría histórica en sus respectivos límites.
- El dominio requiere revisar diferencias de la demo ya documentadas, como archivar cuentas con saldo bajo condiciones locales, la edición directa de registros y la política de anulación y conservación histórica. Se mantienen como decisiones a resolver con Transacciones.
- Salud financiera conserva `v2-demo` como método local. Los parámetros editables, las instantáneas originales, el fondo de emergencia verificable y la comparabilidad entre versiones requieren contrato.
- La bandeja reconstruye alertas de demostración. Notificaciones deberá persistir referencias, lectura y deduplicación. Identidad real, consentimiento auditable y gestión de credenciales siguen pendientes.
- Las consultas y mutaciones candidatas se aprobarán en el BFF. Los adaptadores de registros, preferencias, salud y análisis son los puntos de sustitución. La ruta pública será `/graphql`. Los servicios internos mantienen gRPC, Kafka y HTTPS conforme a la topología.
- Queda por completar la parte del procedimiento contenida en el adjunto íntegro del Prompt 11. [Estado de integración](FRONTEND_INTEGRATION_STATUS.md) · [Contratos de Configuración](SETTINGS_GRAPHQL_CONTRACT.md) · [Contratos de IA](AI_ANALYSIS_CONTRACT.md)
