# Decisiones de arquitectura

Las decisiones aceptadas aplican al diseño oficial del 25 de noviembre de 2026. La implementación de servicios y los contratos de integración se revisan en las etapas indicadas en el [plan de implementación](IMPLEMENTATION_PLAN.md).

## ADR-01. Propiedad del dominio financiero

Decisión aceptada.

`ms-transacciones` es un servicio NestJS y TypeScript con servidor gRPC, cliente gRPC de `ms-usuarios`, PostgreSQL propio y publicación y consumo en Kafka. Las cuentas, movimientos, planificación, reservas, análisis y salud financiera son módulos internos del mismo servicio. Las operaciones que coordinan varias entidades conservan su atomicidad dentro de `postgres-transacciones`.

Las antiguas referencias a .NET y C# se originaron en documentación. El checkout revisado carece de una implementación que migrar. Los ejemplos de precisión de dinero, fórmulas financieras y reglas del dominio siguen sirviendo para verificar la implementación en TypeScript.

## ADR-02. Entrada GraphQL y agente por gRPC

Decisión aceptada.

El navegador usa Apollo Client para enviar operaciones GraphQL a `bff-graphql`. El BFF se comunica por gRPC con Usuarios, Transacciones, Notificaciones y el agente. `ms-agente-mcp` utiliza TypeScript y el SDK oficial de MCP para herramientas de solo lectura. Sus llamadas a Usuarios y Transacciones usan gRPC, y la conexión al proveedor LLM usa HTTPS. El BFF propaga un contexto autenticado que las herramientas usan para acotar los datos.

La demo conserva el repositorio en memoria. El adaptador Apollo se implementará cuando exista un esquema GraphQL versionado. El protocolo gRPC entre el BFF y el agente es parte de la topología oficial.

## ADR-03. Datos bajo propiedad de cada microservicio

Decisión aceptada.

`ms-usuarios`, `ms-transacciones` y `ms-notificaciones` administran `postgres-usuarios`, `postgres-transacciones` y `postgres-notificaciones`, respectivamente. Las referencias externas son identificadores opacos validados por contratos. Los servicios con base usan credenciales propias y las migraciones pertenecen al dueño. El agente obtiene datos mediante herramientas autorizadas.

## ADR-04. Eventos y evaluación de alertas

Topología aceptada. El contrato de observación está pendiente.

Usuarios y Transacciones publican en Kafka. Transacciones y Notificaciones consumen desde Kafka. La bandeja se expone al BFF por gRPC. La topología del prompt excluye las antiguas llamadas directas desde Notificaciones hacia Usuarios o Transacciones.

Para preservar la evaluación de RN-11, se propone que Transacciones observe sus agregados con la zona horaria y las preferencias obtenidas de Usuarios por los canales autorizados. Transacciones podría publicar una observación versionada del estado de cada candidato a alerta, incluidas las transiciones que invalidan una candidatura y las reevaluaciones por calendario. Notificaciones aplicaría sus reglas y deduplicación sobre la última observación utilizable disponible en su persistencia local. Los eventos de Usuario también podrían actualizar su proyección mínima de preferencias.

Una observación asíncrona puede retrasarse respecto de una confirmación o una reprogramación. Antes de implementar, se acordarán las reglas de frescura y orden por agregado, la reacción ante datos ausentes u obsoletos, la reobservación periódica y la deduplicación. Las ventanas, umbrales y reglas financieras de RN-11 conservan sus valores. El nombre y contenido de la observación y la distribución del programador se mantienen como propuestas.

## ADR-05. Nginx, Kubernetes y control de calidad

Decisión aceptada para diseño y empaquetado. Despliegue pendiente.

Vite compila el frontend. Nginx sirve el resultado en el contenedor. Kubernetes usará el namespace `billetera`, los Services internos y un Ingress para `/` y `/graphql`. Los workloads, la persistencia y el acceso al proveedor LLM se ajustan al [diseño de despliegue](TOPOLOGY.md#despliegue-objetivo-en-kubernetes).

GitHub Actions ejecuta el pipeline de cada repositorio. La primera medición de frontend aplica el umbral de 60 % a sus módulos cargados en las pruebas unitarias, mientras Playwright cubre interacciones en el navegador. La medición de código de interfaz y las comprobaciones de contrato se incorporarán en etapas posteriores. [Matriz de stack](../TECH_STACK.md#herramientas-de-verificación)
