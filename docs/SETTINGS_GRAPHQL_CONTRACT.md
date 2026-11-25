# Contratos GraphQL candidatos para Configuración

El modo `integration` inicializa Apollo Client con `/graphql` del mismo origen. Las operaciones de la tabla son candidatas y se habilitarán al aprobar el esquema y la sesión del BFF. Los adaptadores demo `SettingsRepository` y `FinancialRepository` devuelven modelos de pantalla asíncronos. El BFF traducirá las operaciones aprobadas a gRPC y validará la identidad desde la sesión. [Tipos, autorización y estado de todo el inventario](GRAPHQL_INTEGRATION_PLAN.md)

| Operación | Destino | Entrada y respuesta propuestas |
| --- | --- | --- |
| `viewer` | Usuarios | Perfil autenticado, fechas y datos de sesión autorizados. |
| `userPreferences` | Usuarios | Región, presentación sincronizada si aplica, preferencias financieras, detección y opción del asistente. |
| `updateUserProfile` | Usuarios | Nombre visible y versión esperada. Devuelve el perfil validado. |
| `updateUserPreferences` | Usuarios | Bloque de una sección y versión esperada. Devuelve el bloque persistido. |
| `changePassword` | Usuarios | Contraseña actual y nueva por canal autenticado. Devuelve resultado sin secretos. |
| `updateAiConsent` | Usuarios | Decisión y política vigente. Devuelve metadatos de autorización. |
| `logout` | Usuarios vía BFF | Cierre o revocación conforme al contrato de autenticación, de forma idempotente. |
| `categories` | Transacciones | Filtro por tipo y estado, referencias resumidas y catálogo autorizado. |
| `createCategory`, `updateCategory` | Transacciones | Identidad de operación o ID y versión. Nombre, tipo de alta, icono, color y descripción. Devuelven el catálogo afectado. |
| `archiveCategory`, `restoreCategory`, `deleteCategory` | Transacciones | ID, versión y confirmación para eliminar. Transacciones valida referencias de forma atómica. |
| `financialHealthMethodology`, `updateFinancialHealthPreferences` | Transacciones | Consulta de versión y pesos. La mutación candidata exige parámetros aprobados, ámbito y versionado. |
| `notificationPreferences`, `updateNotificationPreferences` | Usuarios para habilitación general, Notificaciones para su bloque | Lectura compuesta. Cada operación de escritura se enruta al propietario según el bloque aprobado. |
| `notificationRules`, `updateNotificationRule` | Notificaciones | Tipo, activación, anticipación cuando corresponda y versión. Devuelve el estado de la regla. |

El contrato de exportación persistente y de eliminación de cuenta queda pendiente. Los montos CLP viajan en formato decimal exacto. Los cortes se expresán con fechas ISO. Cada mutación devuelve el recurso o sección almacenada y errores de validación, conflicto o disponibilidad tipados. Apollo actualiza o invalida los resultados relacionados tras una escritura exitosa. La pantalla informa éxito por sección.

La publicación posterior de eventos puede sincronizar lecturas derivadas. El navegador mantiene GraphQL y el BFF mantiene gRPC con cada servicio. [Propietarios y eventos](PREFERENCES_OWNERSHIP.md)
