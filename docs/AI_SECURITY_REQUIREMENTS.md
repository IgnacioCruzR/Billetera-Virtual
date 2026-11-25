# Privacidad y seguridad del Asistente financiero

## Demostración

El consentimiento y los informes viven en memoria de la sesión. Se puede aceptar o rechazar una futura integración desde la vista previa, y revisar la opción desde la pantalla o Configuración. El proveedor de demostración procesa registros locales. El modo de privacidad enmascara valores monetarios, retira gráficos de importes y oculta narrativa externa sin clasificar y textos de usuario marcados como sensibles. La autorización externa y el modo de visualización son controles independientes.

La interfaz valida parámetros y existencia de referencias, permite una solicitud activa, cancela la espera y descarta respuestas fuera de esa solicitud. El plazo inicial de espera de la demo es de 15 segundos. El cliente reconoce fallos del proveedor y conserva informes anteriores, con opción explícita de reintento cuando corresponde.

La interfaz muestra texto escapado por React. Solo crea enlaces desde acciones reconocidas y verifica los IDs y fechas antes de navegar. El formulario de compra es independiente y conserva las validaciones normales de movimientos, incluida la confirmación del usuario.

## Controles pendientes para producción

| Control | Requisito |
| --- | --- |
| Identidad y autorización | Validar la sesión en el BFF, propagar el contexto autenticado de forma segura y volver a autorizar cada cuenta, movimiento, presupuesto, meta y compromiso en el servicio propietario. Probar aislamiento entre usuarios. |
| Consentimiento | Persistir versión, decisión, fecha y revocación en Usuarios. Aplicar la decisión vigente antes de llamar al LLM. Revalidar si cambia la política o el proveedor. |
| Minimización | Enviar la menor parte suficiente del informe financiero, con agregados y referencias opacas. Excluir tokens, claves, credenciales bancarias, contraseñas, identificadores personales innecesarios y datos ajenos al análisis. Mantener la clave LLM en el backend y gestionarla con Kubernetes Secrets. |
| Instrucciones embebidas en datos | Mantener texto de usuario y salidas de herramientas como datos delimitados. Aplicar plantillas versionadas y un catálogo de herramientas y acciones por tipo. Validar la estructura, límites, recursos y evidencia fuera del LLM. Probar entradas adversarias en nombres, categorías, descripciones y respuestas. |
| Integridad financiera | Resolver valores, montos, fechas calculadas y puntuaciones desde Transacciones. Limitar al agente a lectura. El BFF valida las referencias y descarta contenido ejecutable o acciones desconocidas. |
| Presupuesto de ejecución | Limitar por usuario, tipo y proveedor, propagar tiempos máximos por etapa, limitar volumen y controlar concurrencia. Deduplicar por solicitud, usuario y parámetros. La cancelación del cliente termina la espera; definir aparte si el BFF puede cancelar trabajo remoto. |
| Observabilidad | Registrar ID técnico, tipo, duración, versión y código de error. Revisar acceso y retención de logs. Evitar contenido financiero, credenciales, instrucciones o respuestas del proveedor en registros y trazas. |
| Retención | Acordar política de exportación, borrado, almacenamiento y retención del proveedor. La persistencia de informes de análisis requiere decisión arquitectónica. |

Kafka conserva los productores, consumidores y responsabilidades de la [topología oficial](TOPOLOGY.md). Las recomendaciones del agente son interpretaciones de lectura y la solicitud de análisis sigue GraphQL y gRPC. Las notificaciones financieras siguen siendo responsabilidad de `ms-notificaciones`.
