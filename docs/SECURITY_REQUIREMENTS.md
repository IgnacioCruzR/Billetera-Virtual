# Seguridad y privacidad de Configuración

La demostración permite probar validación de contraseñas con valores ficticios y muestra el servicio como pendiente. Los campos se limpian al enviar un ejemplo válido o al cancelar. El frontend no persiste ni transmite las contraseñas de prueba. El correo mostrado es de demostración y carece de flujo de modificación.

El modo de privacidad controla la visualización en todo el frontend, incluidos campos monetarios, filtros y reportes. La exportación y el consentimiento requieren sus propias acciones. `localStorage` conserva el tamaño de texto, la densidad, el movimiento reducido, la barra compacta, la visibilidad de gráficos y la opción de ocultar montos al inicio. `sessionStorage` conserva el marcador booleano de cierre de la demo. Cuentas, historial, perfil, contraseñas de prueba, permisos, informes y escenarios solo viven en memoria.

El cierre de sesión desmonta las vistas y descarta solicitudes pendientes e informes. Al volver a la demostración se crea otro repositorio desde una copia de los datos de ejemplo. El escenario de navegador verifica que un repositorio con otra identidad rechaza un ID ajeno y conserva su saldo y su historial. La revocación de consentimiento impide iniciar solicitudes y descarta respuestas tardías.

En `integration`, `createBffClient` configura un cliente con caché en memoria y transporte fijo a `/graphql`, credenciales del mismo origen y redirecciones rechazadas. `closeBffSession` detiene el cliente y vacía la caché sin volver a consultar. Una prueba unitaria verifica la limpieza y la falta de datos en un segundo cliente. La conexión de esa función al cierre, expiración y cambio de usuario requiere la sesión real del BFF.

La revisión de `frontend/src` localizó almacenamiento del navegador en las preferencias visuales y el marcador de cierre, y el transporte HTTP de producción en `app/bff-client.ts`. La búsqueda de patrones de secretos, claves privadas y URL PostgreSQL con credenciales no arrojó coincidencias en el código y la configuración revisados. Las acciones IA se validan contra tipos de navegación conocidos y referencias del contexto. El CSV compartido escapa separadores, comillas y saltos y neutraliza fórmulas. Las simulaciones preservan los registros efectivos.

## Controles pendientes

- Autorizar cada operación por sesión y recurso en BFF y servicio propietario. Derivar la identidad del contexto autenticado. Definir transporte de sesión, expiración, revocación y defensa CSRF antes de activar mutaciones.
- Verificar la contraseña actual y la política vigente por Usuarios. Gestionar límites, almacenamiento seguro, auditoría sin secretos y revocación de sesiones si la política lo requiere.
- Verificar un cambio de correo mediante el flujo aprobado antes de exponer nuevas credenciales.
- Persistir consentimiento versionado y revocación. El BFF y el agente deben consultarlo antes de procesar. El cliente descarta la espera, mientras la cancelación y retención externas requieren confirmación del proveedor.
- Aplicar minimización a exportaciones, autorización explícita, escapado de fórmulas CSV y entrega segura. Excluir credenciales, tokens e información de otros usuarios.
- Diseñar la eliminación de cuenta con autorización reforzada, confirmación, retención, anonimización o eliminación distribuida, tratamiento contable, propagación mediante eventos y respuesta de los proveedores externos.

La aplicación conserva las políticas del [Asistente IA](AI_SECURITY_REQUIREMENTS.md) y la [topología oficial](TOPOLOGY.md).
