# Seguridad y privacidad de Configuración

La demostración permite probar validación de contraseñas con valores ficticios y muestra el servicio como pendiente. Los campos se limpian al enviar un ejemplo válido o al cancelar. El frontend no persiste ni transmite las contraseñas de prueba. El correo mostrado es de demostración y carece de flujo de modificación.

El modo de privacidad controla la visualización. No modifica los datos subyacentes, no cifra los registros y es independiente de exportar o consentir procesamiento. Se conservan localmente las preferencias visuales. El marcador de sesión cerrada es un booleano sin credenciales.

El cierre de sesión desmonta la vista, el repositorio financiero y el estado de preferencias de sesión, descarta solicitudes e informes y muestra una pantalla de entrada a la demostración. No existe autenticación remota ni una caché Apollo activa en la demo. Cuando se integre la sesión real, la secuencia debe cerrar o revocar según el contrato de Usuarios, limpiar las credenciales, cancelar las solicitudes, vaciar la caché con la API de Apollo y redirigir al ingreso autenticado. La caducidad, el cambio de usuario y el retroceso del navegador deben respetar las mismas fronteras.

## Controles pendientes

- Autorizar cada operación por sesión y recurso en BFF y servicio propietario. Nunca usar un ID arbitrario del cliente como autoridad de identidad.
- Verificar la contraseña actual y la política vigente por Usuarios. Gestionar límites, almacenamiento seguro, auditoría sin secretos y revocación de sesiones si la política lo requiere.
- Verificar un cambio de correo mediante el flujo aprobado antes de exponer nuevas credenciales.
- Persistir consentimiento versionado y revocación. El BFF y el agente deben consultarlo antes de procesar. El cliente descarta la espera, mientras la cancelación y retención externas requieren confirmación del proveedor.
- Aplicar minimización a exportaciones, autorización explícita, escapado de fórmulas CSV y entrega segura. Excluir credenciales, tokens e información de otros usuarios.
- Diseñar la eliminación de cuenta con autorización reforzada, confirmación, retención, anonimización o eliminación distribuida, tratamiento contable, propagación mediante eventos y respuesta de los proveedores externos.

La aplicación conserva las políticas del [Asistente IA](AI_SECURITY_REQUIREMENTS.md) y la [topología oficial](TOPOLOGY.md).
