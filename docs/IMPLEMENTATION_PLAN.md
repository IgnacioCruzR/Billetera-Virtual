# Plan de implementación

El objetivo es entregar seis aplicaciones independientes con verificaciones reproducibles. El workspace reúne el frontend, cinco esqueletos y Compose para desarrollo. El diseño objetivo se rige por [Arquitectura](../ARCHITECTURE.md) y [Topología](TOPOLOGY.md). [Entorno local](LOCAL_DEVELOPMENT.md) · [Repositorios](REPOSITORY_STRUCTURE.md)

| Etapa | Entrega | Aceptación |
| --- | --- | --- |
| 0. Corrección y frontend existente | Alinear documentación, añadir imagen Docker/Nginx y pipeline local del frontend. | Compilación y pruebas de la demo. El pipeline debe validar la imagen y el servicio estático en un runner con Docker. |
| 1. Contratos y repositorios | Acordar contratos GraphQL, Protobuf y Kafka, versiones, error e identidad entre los seis repositorios. | Diagramas coherentes, revisión de contrato y pruebas de serialización de CLP, fechas y límites. |
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

El workflow vive en `frontend/.github/workflows/frontend-ci.yml` dentro del workspace. Desde la raíz del clon, GitHub Actions ejecuta ESLint, compila TypeScript y Vite, ejecuta Playwright Chromium y prueba el contenedor Nginx. La cobertura unitaria mínima se aplica a los módulos de `src/` cargados por las pruebas Node. Incorporar medición de componentes al ampliar esa suite.

Cada backend tiene `.github/workflows/ci.yml` para compilación, análisis estático, comprobación de configuración y empaquetado. Las plantillas siguientes documentan la ampliación prevista cuando se agreguen pruebas de dominio. [CI por repositorio](REPOSITORY_STRUCTURE.md#ci-por-repositorio)

| Repositorio | Plantilla | Prerrequisitos |
| --- | --- | --- |
| `bff-graphql` | [TypeScript](ci/typescript-service.yml) | Añadir ESLint y pruebas de contrato GraphQL y gRPC. |
| `ms-transacciones` | [TypeScript](ci/typescript-service.yml) | Añadir ESLint y pruebas de dominio, persistencia y contratos gRPC. |
| `ms-agente-mcp` | [TypeScript](ci/typescript-service.yml) | Añadir ESLint y usar dobles del LLM para verificar herramientas y autorización en CI. |
| `ms-usuarios` | [Go](ci/ms-usuarios.yml) | Añadir pruebas y medir sentencias de los paquetes de aplicación. |
| `ms-notificaciones` | [Java](ci/ms-notificaciones.yml) | Incorporar Checkstyle y JUnit junto con el reporte JaCoCo `target/site/jacoco/jacoco.xml`. |

Los scripts de cobertura TypeScript deben fallar por debajo del 60 % de líneas y cubrir el código de aplicación. Preservar un umbral equivalente en Go y Java con sus métricas nativas. Construir las imágenes después de las verificaciones. La publicación y el despliegue son etapas separadas.

## Preparación del despliegue

El frontend tiene una imagen Nginx y los cinco backends tienen imágenes de comprobación de configuración. Los manifiestos de Kubernetes se definen cuando estén disponibles los servidores, las sondas, el clúster y el mecanismo de secretos. Quedan por acordar el controlador Ingress, la clase de almacenamiento, los parámetros operativos de Kafka y las políticas de red. [Topología de despliegue](TOPOLOGY.md#despliegue-objetivo-en-kubernetes)

La revisión previa encontró referencias históricas a .NET en la documentación. El código y los cambios de tecnología de cada aplicación se revisan en su repositorio.
