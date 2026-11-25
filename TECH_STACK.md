# Stack oficial y matriz de cumplimiento

El stack objetivo tiene seis repositorios independientes. El único checkout auditado aloja `frontend/` como subdirectorio. Los componentes marcados como pendientes corresponden al diseño objetivo.

| Repositorio o capa | Stack obligatorio | Estado del workspace | Pendiente |
| --- | --- | --- | --- |
| `frontend` | React, TypeScript, Apollo Client, Nginx. Tailwind CSS, shadcn/ui, Lucide React y Recharts para la interfaz. | React, TypeScript y dependencias visuales implementados. Apollo Client presente en dependencias. Dockerfile y configuración Nginx preparados. Vite compila y ejecuta el desarrollo local. | Conectar Apollo al esquema del BFF y verificar la imagen en un daemon disponible. |
| `bff-graphql` | NestJS, TypeScript, GraphQL y clientes gRPC. | Diseño documentado. | Implementar entrada GraphQL, autenticación, delegación gRPC y pruebas de contrato. |
| `ms-usuarios` | Go, servidor gRPC, PostgreSQL propio y publicación Kafka. | Diseño documentado. | Implementar identidad y preferencias, base propia y publicación confiable de sus eventos. |
| `ms-transacciones` | NestJS, TypeScript, servidor gRPC, PostgreSQL propio, publicación y consumo Kafka, cliente gRPC de Usuarios. | Diseño documentado. El frontend contiene cálculos y reglas de demostración en TypeScript. | Implementar el dominio financiero y sus módulos internos, persistencia, eventos y contratos de consulta. |
| `ms-notificaciones` | Java, Spring Boot, servidor gRPC, PostgreSQL propio y consumo Kafka. | Diseño documentado. | Implementar reglas, deduplicación, bandeja y lectura, después de acordar el contrato de observación financiera. |
| `ms-agente-mcp` | TypeScript, SDK oficial MCP, servidor gRPC para el BFF, clientes gRPC de Usuarios y Transacciones, HTTPS con LLM externo. | Diseño documentado. La UI dispone de respuestas de demostración. | Implementar herramientas y permisos de lectura, errores de proveedor y minimización de datos. |
| Mensajería | Apache Kafka. Publicadores en Usuarios y Transacciones, consumidores en Transacciones y Notificaciones. | Catálogo propuesto documentado. | Elegir configuración de brokers y acordar esquemas, partición, reintentos y recuperación. |
| Persistencia | `postgres-usuarios`, `postgres-transacciones`, `postgres-notificaciones`. | Propiedad y separación documentadas. | Crear instancias, migraciones y credenciales independientes. |
| Empaquetado y despliegue | Docker y Kubernetes en el namespace `billetera`. | Imagen de frontend definida y topología Kubernetes documentada. | Validar imagen, preparar clúster e implementar los manifiestos una vez disponibles los servicios. |
| Automatización | GitHub Actions por repositorio y cobertura mínima del 60 % con herramientas del lenguaje. | Workflow de frontend y plantillas adaptables para los cinco servicios. | Activar cada pipeline en su repositorio y ampliar la medición de frontend para cubrir los componentes de interfaz. |

## Herramientas de verificación

| Repositorio | Dependencias, análisis, compilación y pruebas | Cobertura de aplicación |
| --- | --- | --- |
| `frontend` | `npm ci`, TypeScript `--noEmit`, Vite, Node Test Runner, Playwright Chromium y smoke test de Nginx. | Umbral de líneas del 60 % sobre los módulos de `src/` cargados por la suite unitaria. La ejecución E2E es independiente. |
| `bff-graphql`, `ms-transacciones`, `ms-agente-mcp` | `npm ci`, scripts `lint`, `build` y `test:coverage` del servicio. | Mínimo de líneas del 60 % sobre código de aplicación, con un runner compatible con TypeScript. |
| `ms-usuarios` | `go mod download`, `go vet`, `go build` y `go test` con `-coverpkg=./...`. | Mínimo del 60 % de sentencias, calculado desde bloques del perfil de Go. |
| `ms-notificaciones` | Maven, Checkstyle, JUnit y JaCoCo. | Mínimo de líneas del 60 % medido desde el reporte JaCoCo de `mvn verify`. |

Los workflows construyen imágenes Docker después de verificar el código. La adopción de plantillas, la versión de runtime y las convenciones de cobertura se detallan en el [plan de implementación](docs/IMPLEMENTATION_PLAN.md#integración-continua). [Node Test Runner](https://nodejs.org/download/release/v22.21.0/docs/api/test.html#collecting-code-coverage) · [Cobertura de Go](https://go.dev/doc/build-cover) · [JaCoCo para Maven](https://www.jacoco.org/jacoco/trunk/doc/maven.html)
