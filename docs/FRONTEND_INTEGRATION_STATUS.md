# Estado de integración del frontend

| Superficie | Disponible | Pendiente de integración |
| --- | --- | --- |
| Layout, dashboard y módulos financieros | React, TypeScript, Tailwind CSS, componentes shadcn/ui, Lucide y Recharts sobre registros compartidos locales. | Apollo Client con el esquema de BFF y repositorios de producción. |
| Configuración | Perfil simulado, región, categorías, detección compartida, preferencias, bandeja local, privacidad, consentimiento, CSV y cierre limpio de sesión. | Identidad y validación remotas, persistencia por propietario, notificaciones del servidor y exportación autorizada de registros persistentes. |
| Seguridad | Formulario de prueba, validación de experiencia y cierre de demo. | Cambio efectivo de contraseña, correo verificado, revocación y limpieza de la caché Apollo real. |
| Salud financiera | Metodología local v2-demo, valores compartidos y parámetros visibles. | Cálculo definitivo, resultados versionados y política aprobada de edición de referencias. |
| Asistente | Informes deterministas de seis tipos, estado de consentimiento de sesión y descarte de esperas. | Solicitudes reales por BFF a MCP, proveedor HTTPS, consentimiento auditable y política de persistencia. |
| Infraestructura | Empaquetado frontend Nginx/Docker y archivos de CI existentes. | Ingress y servicios según la topología oficial, fuera del alcance de Configuración. |

El frontend incorpora un catálogo financiero único y operaciones asíncronas reemplazables. Los otros repositorios conservan sus responsabilidades. El BFF será el único origen de datos de red de React. Las llamadas entre microservicios usarán gRPC y la mensajería se mantendrá en los productores y consumidores autorizados.

[Guía de Configuración](USER_SETTINGS.md) · [Auditoría del frontend](FRONTEND_AUDIT.md) · [Stack oficial](../TECH_STACK.md) · [Topología](TOPOLOGY.md)
