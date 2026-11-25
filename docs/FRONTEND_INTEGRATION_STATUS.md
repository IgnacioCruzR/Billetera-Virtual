# Estado de integración del frontend

| Superficie | Disponible | Pendiente de integración |
| --- | --- | --- |
| Layout, dashboard y módulos financieros | React, TypeScript, Tailwind CSS, shadcn/ui, Lucide y Recharts. Libro compartido, diez rutas directas y escenario financiero aprobado. | Operaciones aprobadas del BFF, persistencia por propietario y adaptadores remotos. |
| Configuración | Perfil simulado, región, categorías, detección compartida, preferencias, bandeja local, privacidad, consentimiento, CSV y cierre limpio de sesión. | Identidad y validación remotas, reglas de avisos del servidor y exportación autorizada de registros persistentes. |
| Seguridad | Libro nuevo por sesión demo. Transporte Apollo de mismo origen, caché en memoria y limpieza verificada por prueba unitaria. | Sesión real, validación y autorización por recurso, expiración, revocación y conexión de la limpieza al ciclo de autenticación. |
| Salud financiera | Metodología local v2-demo, valores compartidos y parámetros visibles. | Cálculo definitivo, resultados versionados y política aprobada de edición de referencias. |
| Asistente | Informes deterministas de seis tipos, estado de consentimiento de sesión y descarte de esperas. | Solicitudes reales por BFF a MCP, proveedor HTTPS, consentimiento auditable y política de persistencia. |
| Infraestructura | `VITE_DATA_MODE` para demo y preparación de integración. La imagen Nginx se construyó y se ejecutó con Compose. Se verificaron `/healthz`, recursos y las diez rutas en Edge. | Ingress y servicios según la topología oficial. |

## Pendientes y condición de avance

| Clasificación | Pendiente | Condición de cierre |
| --- | --- | --- |
| Bloqueante | Sin bloqueos de compilación, integridad o aislamiento de demo detectados en esta fase. | Mantener los resultados automatizados durante la integración. |
| No bloqueante | Medir cobertura del frontend completo y actualizar ESLint cuando se acuerde el mínimo de Node. | Incluir orquestación, hooks y TSX en un denominador completo. Mantener 60 % en CI sobre el alcance actual. |
| Dependiente de backend | Esquema GraphQL, sesión, autorización, CSRF según el transporte elegido, partición por usuario, persistencia, idempotencia y control de concurrencia. | Probar reintentos simultáneos, identidades cruzadas, expiración y atomicidad con los contratos reales. |
| Dependiente de backend | Versionado de Salud, datos de fondo de emergencia, límites de edición contable, exportación persistente y eliminación de cuenta. | Aprobar los cambios de dominio, evidencias históricas y retención por propietario. |
| Dependiente de backend | Notificaciones persistentes y consentimiento de IA auditable. | Probar deduplicación, revocación y minimización con Usuarios, Notificaciones y Agente MCP. |
| Dependiente del entorno | Kubernetes e Ingress. | Validar rutas y políticas de red en el clúster autorizado cuando el BFF tenga una imagen disponible. |

## Siguiente etapa de infraestructura local

1. Usar el entorno Compose verificado en el Prompt 12. Antes de conectar servicios, repetir las comprobaciones de salud, persistencia y rutas cuando cambien las imágenes. [Guía de desarrollo local](LOCAL_DEVELOPMENT.md)
2. Acordar el contrato de sesión y los primeros flujos de lectura con `bff-graphql`, `ms-usuarios` y `ms-transacciones`. Usar el escenario aislado para acordar saldos, reservas, gastos, fechas e idempotencia.
3. Preparar los entornos independientes con sus propias bases PostgreSQL y el Kafka autorizado por la topología. Acordar los productores, consumidores, esquemas, reintentos y manejo de duplicados antes de conectar notificaciones. Acordar consentimiento y permisos antes de conectar el agente.
4. Con los contratos aprobados, completar los adaptadores Apollo y validar ambos modos bajo un host con `/graphql` reservado al BFF. El futuro Ingress conserva `/graphql` exacto para el BFF y el prefijo `/` para Nginx.

Las responsabilidades y el orden de integración permanecen definidos en el stack oficial. [Comandos del frontend](../frontend/README.md) · [Auditoría](FRONTEND_AUDIT.md) · [Operaciones candidatas](GRAPHQL_INTEGRATION_PLAN.md) · [Stack](../TECH_STACK.md) · [Topología](TOPOLOGY.md)

[Guía de Configuración](USER_SETTINGS.md) · [Auditoría del frontend](FRONTEND_AUDIT.md) · [Stack oficial](../TECH_STACK.md) · [Topología](TOPOLOGY.md)
