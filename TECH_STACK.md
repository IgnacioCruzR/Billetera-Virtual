# Stack oficial y matriz de cumplimiento

El workspace reúne seis clones independientes y Docker Compose en la raíz. Cada clon contiene sus dependencias, configuración de compilación y workflow. [Organización y CI](docs/REPOSITORY_STRUCTURE.md) · [Desarrollo local](docs/LOCAL_DEVELOPMENT.md)

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
| Empaquetado y despliegue | Docker y Kubernetes en el namespace `billetera`. | Compose local con Nginx y cinco imágenes de comprobación de configuración. Topología Kubernetes documentada. | Preparar el clúster y los manifiestos cuando estén disponibles los servidores. |
| Automatización | GitHub Actions por repositorio y cobertura mínima objetivo del 60 % con herramientas del lenguaje. | Workflow de frontend con cobertura y workflows de compilación y análisis para los cinco esqueletos. | Ampliar la cobertura a componentes de interfaz y añadir pruebas y métricas de los servicios con lógica implementada. |

## Herramientas de verificación

| Repositorio | Dependencias, análisis, compilación y pruebas | Cobertura de aplicación |
| --- | --- | --- |
| `frontend` | `npm ci`, ESLint con Hooks, TypeScript `--noEmit`, Vite, Node Test Runner, Playwright Chromium y smoke test de Nginx. | Umbral de líneas del 60 % sobre los módulos de `src/` cargados por la suite unitaria. La ejecución E2E es independiente. |
| `bff-graphql`, `ms-transacciones`, `ms-agente-mcp` | `npm ci`, `typecheck` y `build`. | Objetivo del 60 % de líneas cuando haya pruebas de aplicación. |
| `ms-usuarios` | `go mod download`, `go vet`, `go build` y `go test`. | Objetivo del 60 % de sentencias con el perfil de Go. |
| `ms-notificaciones` | Maven `clean verify` y `javac -Xlint:all`. | Objetivo del 60 % de líneas con JaCoCo cuando haya pruebas de aplicación. |

Los workflows construyen las imágenes Docker después de verificar el código. El [plan de implementación](docs/IMPLEMENTATION_PLAN.md#integración-continua) detalla los pasos para ampliar las pruebas. [Node Test Runner](https://nodejs.org/download/release/v22.21.0/docs/api/test.html#collecting-code-coverage) · [Cobertura de Go](https://go.dev/doc/build-cover) · [JaCoCo para Maven](https://www.jacoco.org/jacoco/trunk/doc/maven.html)
