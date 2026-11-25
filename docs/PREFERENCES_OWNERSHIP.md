# Propietarios de configuración

| Configuración | Propietario futuro | Integración |
| --- | --- | --- |
| Identidad, nombre, correo, credenciales, sesión y consentimiento | `ms-usuarios` | El BFF deriva identidad de la sesión, lee preferencias y coordina autenticación. El agente verifica uso autorizado antes de interpretar. |
| Región, zona, idioma, formato y períodos iniciales | `ms-usuarios` | El frontend aplica presentación. Transacciones usa la zona correspondiente para cortes fechados. |
| Umbral presupuestario inicial, horizonte y reserva mínima deseada | `ms-usuarios` para preferencias | `ms-transacciones` valida presupuestos, preserva umbrales individuales y calcula flujo; las reservas efectivas pertenecen a su libro. |
| Categorías y referencias | `ms-transacciones` | Alta, compatibilidad, archivo, reactivación y eliminación transaccionales. |
| Criterio de gastos hormiga | `ms-usuarios` para valores del usuario | `ms-transacciones` obtiene el criterio vigente mediante gRPC y calcula candidatos; conserva clasificaciones manuales. |
| Parámetros y versiones de Salud financiera | `ms-transacciones` | Define pesos, disponibilidad, versiones y comparabilidad. El agente interpreta la evaluación calculada. |
| Habilitación global de avisos | `ms-usuarios` como preferencia general candidata | `ms-notificaciones` aplica la habilitación efectiva a la bandeja. El BFF compone la vista. |
| Reglas específicas, anticipación y estado de lectura | `ms-notificaciones` | El usuario actualiza reglas mediante GraphQL y BFF gRPC. Se evalúan avisos con observaciones de Transacciones. |
| Presentación y visualización inicial | Navegador en la demo | Una futura sincronización multidispositivo deberá definir precedencia en Usuarios. |
| Exportaciones | Servicios propietarios de cada conjunto, coordinados por el BFF | Transacciones provee conjuntos financieros autorizados. Identidad controla la sesión. |

La capa local conserva repositorios por sesión y comparte la vista guardada con todas las pantallas. Categorías financieras pertenecen a los registros compartidos; las reglas de la bandeja y las preferencias generales tienen operaciones distintas. El historial del asistente sigue siendo temporal.

## Propagación futura mediante Kafka

- `user.preferences.updated.v1` puede propagar cambios de zona o detección relevantes. Usuarios publica después de persistir. Transacciones aplica versiones en orden, ignora duplicados y puede reconciliar mediante su cliente gRPC existente.
- `user.ai_consent.updated.v1` puede registrar una transición con ID opaco, versión de política, decisión y fecha. El BFF y el agente verifican la autorización vigente por los canales síncronos aprobados. La existencia del evento no otorga permiso.
- Notificaciones consume eventos pertinentes del catálogo aprobado y conserva sus propias reglas. Los controles puramente visuales pueden permanecer en el navegador. El agente MCP conserva las conexiones gRPC y HTTPS de la topología.

Los nombres, cargas, partición, deduplicación y retención son candidatos. Los cambios iniciados por el usuario se guardan por GraphQL. [Topología](TOPOLOGY.md) · [Eventos](DOMAIN_EVENTS.md)
