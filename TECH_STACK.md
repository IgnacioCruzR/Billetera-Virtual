# Stack oficial y matriz de cumplimiento

El stack objetivo tiene seis repositorios independientes. El checkout local reúne las seis raíces de aplicación y Compose. La separación Git se hará con autorización conforme al plan de conservación de historial. [Organización y CI](docs/REPOSITORY_STRUCTURE.md) · [Versiones locales](docs/LOCAL_DEVELOPMENT.md)

| Repositorio o capa | Stack obligatorio | Estado del workspace | Pendiente |
| --- | --- | --- | --- |
| `frontend` | React, TypeScript, Apollo Client, Nginx. Tailwind CSS, shadcn/ui, Lucide React y Recharts para la interfaz. | Demo funcional. Apollo se inicializa en modo de integración con `/graphql`. Imagen Nginx construida para Compose. | Conectar Apollo al esquema del BFF. |
| `bff-graphql` | NestJS, TypeScript, GraphQL y clientes gRPC. | Esqueleto Nest y validación de direcciones para los cuatro servicios. | Implementar entrada GraphQL, autenticación, delegación gRPC y pruebas de contrato. |
| `ms-usuarios` | Go, servidor gRPC, PostgreSQL propio y publicación Kafka. | Módulo Go, configuración de gRPC, PostgreSQL y direcciones Kafka. | Implementar identidad y preferencias, migraciones y publicación confiable de eventos. |
| `ms-transacciones` | NestJS, TypeScript, servidor gRPC, PostgreSQL propio, publicación y consumo Kafka, cliente gRPC de Usuarios. | Esqueleto Nest modular con configuración de gRPC, PostgreSQL y Kafka. | Implementar el dominio financiero y sus módulos internos, persistencia, eventos y contratos de consulta. |
| `ms-notificaciones` | Java, Spring Boot, servidor gRPC, PostgreSQL propio y consumo Kafka. | Esqueleto Spring Boot con Maven y configuración por entorno. | Implementar reglas, deduplicación, bandeja y lectura, después de acordar el contrato de observación financiera. |
| `ms-agente-mcp` | TypeScript, SDK oficial MCP, servidor gRPC para el BFF, clientes gRPC de Usuarios y Transacciones, HTTPS con LLM externo. | Esqueleto con SDK oficial MCP y configuración de transportes. La UI dispone de respuestas de demostración. | Implementar herramientas y permisos de lectura, errores de proveedor y minimización de datos. |
| Mensajería | Apache Kafka. Publicadores en Usuarios y Transacciones, consumidores en Transacciones y Notificaciones. | Broker local KRaft con almacenamiento persistente y catálogo propuesto. | Acordar esquemas de dominio, partición, reintentos y recuperación. |
| Persistencia | `postgres-usuarios`, `postgres-transacciones`, `postgres-notificaciones`. | Tres bases en Compose con usuarios, volúmenes y redes propios. | Migraciones de cada propietario. |
| Empaquetado y despliegue | Docker y Kubernetes en el namespace `billetera`. | Compose local y topología Kubernetes documentada. | Preparar el clúster y los manifiestos una vez disponibles los servicios. |
| Automatización | GitHub Actions por repositorio y cobertura mínima del 60 % con herramientas del lenguaje. | Workflow de frontend y plantillas adaptables para los cinco servicios. | Activar cada pipeline en su repositorio y ampliar la medición de frontend para cubrir los componentes de interfaz. |

## Herramientas de verificación

| Repositorio | Dependencias, análisis, compilación y pruebas | Cobertura de aplicación |
| --- | --- | --- |
| `frontend` | `npm ci`, ESLint con Hooks, TypeScript `--noEmit`, Vite, Node Test Runner, Playwright Chromium y smoke test de Nginx. | Umbral de líneas del 60 % sobre los módulos de `src/` cargados por la suite unitaria. La ejecución E2E es independiente. |
| `bff-graphql`, `ms-transacciones`, `ms-agente-mcp` | `npm ci`, scripts `lint`, `build` y `test:coverage` del servicio. | Mínimo de líneas del 60 % sobre código de aplicación, con un runner compatible con TypeScript. |
| `ms-usuarios` | `go mod download`, `go vet`, `go build` y `go test` con `-coverpkg=./...`. | Mínimo del 60 % de sentencias, calculado desde bloques del perfil de Go. |
| `ms-notificaciones` | Maven, Checkstyle, JUnit y JaCoCo. | Mínimo de líneas del 60 % medido desde el reporte JaCoCo de `mvn verify`. |

Los workflows construyen imágenes Docker después de verificar el código. La adopción de plantillas, la versión de runtime y las convenciones de cobertura se detallan en el [plan de implementación](docs/IMPLEMENTATION_PLAN.md#integración-continua). [Node Test Runner](https://nodejs.org/download/release/v22.21.0/docs/api/test.html#collecting-code-coverage) · [Cobertura de Go](https://go.dev/doc/build-cover) · [JaCoCo para Maven](https://www.jacoco.org/jacoco/trunk/doc/maven.html)
