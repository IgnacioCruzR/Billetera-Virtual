# Plan de implementación

El objetivo es construir seis repositorios independientes con entregas verificables. El workspace local reúne el frontend, cinco esqueletos y Compose para desarrollo. El diseño objetivo se rige por [Arquitectura](../ARCHITECTURE.md) y [Topología](TOPOLOGY.md). [Entorno local](LOCAL_DEVELOPMENT.md) · [Plan de separación](REPOSITORY_STRUCTURE.md)

| Etapa | Entrega | Aceptación |
| --- | --- | --- |
| 0. Corrección y frontend existente | Alinear documentación, añadir imagen Docker/Nginx y pipeline local del frontend. | Compilación y pruebas de la demo. El pipeline debe validar la imagen y el servicio estático en un runner con Docker. |
| 1. Contratos y repositorios | Preparar los seis repositorios si falta alguno. Acordar contratos GraphQL, Protobuf y Kafka, versiones, error e identidad, sin depender de bases ajenas. | Diagramas coherentes, revisión de contrato y pruebas de serialización de CLP, fechas y límites. |
| 2. Identidad | Implementar `ms-usuarios` en Go con gRPC, PostgreSQL propio y publicación Kafka. | Alta, sesión y preferencias, pruebas de aislamiento y entrega repetida. |
| 3. Finanzas | Implementar `ms-transacciones` en NestJS. Empezar por cuentas, categorías y movimientos. Añadir transferencias, compromisos, presupuestos, indicadores y reservas en entregas sucesivas. | Reglas preservadas, operaciones atómicas e idempotentes, compatibilidad monetaria y validación de eventos. Probar el consumo de eventos de Usuario y la consulta gRPC de preferencias. |
| 4. Entrada y datos de la interfaz | Implementar `bff-graphql` en NestJS, enlazar los servicios disponibles por gRPC y conectar Apollo al BFF mediante el repositorio de datos. | Las pantallas y la privacidad conservan su comportamiento. Hay pruebas de contrato y de acceso por usuario. La demo continúa disponible mientras se habilita cada integración. |
| 5. Notificaciones | Implementar `ms-notificaciones` en Spring Boot después de acordar la observación versionada de datos y su frescura. | Evaluación conforme a RN-11, control de eventos repetidos, seguimiento de lectura y reintentos. |
| 6. Asistencia | Implementar `ms-agente-mcp` con TypeScript, SDK oficial MCP, entrada gRPC y herramientas gRPC autorizadas. | Lectura de datos propios, minimización del contexto enviado por HTTPS, errores trazables y explicación de insuficiencia de datos. |
| 7. Despliegue integrado | Preparar el namespace `billetera`, StatefulSets, PVC, configuración, secretos, Services e Ingress en un clúster autorizado. | Rutas `/` y `/graphql`, acceso a backend por red interna, persistencia verificada, separación de datos y recuperación de Kafka. |

## Contratos pendientes

- GraphQL público del BFF con identidad autenticada, errores y paginación. Endpoint previsto en `/graphql` del mismo host que Nginx.
- Protobuf gRPC versionado, propagación de identidad y correlación, idempotencia, fechas ISO e importes conforme a RN-01. Definir pruebas cruzadas para Go, TypeScript y Java.
- Eventos Kafka con propiedad, versión, partición, reintentos y replay. Acordar el contrato de vigencia usado por Notificaciones.
- Catálogo y límites de las herramientas MCP, semántica de cobertura y salida hacia el LLM por HTTPS.

## Integración continua

El [workflow del frontend](../.github/workflows/frontend-ci.yml) corresponde a la estructura actual, que mantiene el código en `frontend/`. Si el componente se extrae a un checkout con su código en la raíz, ajustar los filtros de ruta, el directorio de ejecución y la ruta del lockfile. En Ubuntu, la verificación compila TypeScript y Vite, ejecuta Playwright Chromium y construye y prueba el contenedor Nginx. La cobertura unitaria mínima aplica a los módulos de `src/` cargados por las pruebas Node. Incorporar medición de componentes al ampliar esa suite.

Las plantillas se incorporarán como `.github/workflows/ci.yml` en cada repositorio cuando existan las pruebas de aplicación, las herramientas de análisis y el Dockerfile requeridos. Los esqueletos se comprueban desde su raíz con los comandos de compilación documentados. [CI por repositorio](REPOSITORY_STRUCTURE.md#ci-por-repositorio)

| Repositorio | Plantilla | Prerrequisitos |
| --- | --- | --- |
| `bff-graphql` | [TypeScript](ci/typescript-service.yml) | `.nvmrc`, lockfile de npm, scripts `lint`, `build`, `test:coverage` y Dockerfile. |
| `ms-transacciones` | [TypeScript](ci/typescript-service.yml) | Los mismos scripts. Incluir pruebas de dominio, persistencia y contratos gRPC al implementarlos. |
| `ms-agente-mcp` | [TypeScript](ci/typescript-service.yml) | Los mismos scripts. Usar dobles del LLM para verificar herramientas y autorización en CI. |
| `ms-usuarios` | [Go](ci/ms-usuarios.yml) | `go.mod`, `go.sum`, pruebas y Dockerfile. El perfil incluye los paquetes de aplicación y valida por sentencias. |
| `ms-notificaciones` | [Java](ci/ms-notificaciones.yml) | `pom.xml` con Java 17 y Maven. Incorporar Checkstyle y JUnit junto con el reporte JaCoCo `target/site/jacoco/jacoco.xml` al implementar la aplicación. |

Los scripts de cobertura TypeScript deben fallar por debajo del 60 % de líneas y cubrir el código de aplicación. Preservar un umbral equivalente en Go y Java con sus métricas nativas. Construir las imágenes después de las verificaciones. La publicación y el despliegue son etapas separadas.

## Preparación del despliegue

El checkout cuenta con el empaquetado frontend. Los manifiestos de Kubernetes se definen cuando se disponga de imágenes, rutas de salud, clúster y un mecanismo autorizado de secretos. Quedan por acordar el controlador Ingress, la clase de almacenamiento, los parámetros operativos de Kafka y las políticas de red. La disposición de recursos se documenta en [Topología de despliegue](TOPOLOGY.md#despliegue-objetivo-en-kubernetes).

El inventario local encontró referencias históricas a .NET únicamente en documentación. No se requiere un plan de migración de código para este checkout. Antes de cambiar la ubicación del frontend o dividir repositorios, se deberá inventariar las ramas y remotos que el equipo decida incorporar.
