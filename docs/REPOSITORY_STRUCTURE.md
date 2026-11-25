# Organización y separación de repositorios

El workspace actual tiene un único `.git` con `origin` y la rama `main`. `frontend/` conserva las funcionalidades y los cambios locales del Prompt 11-B. Los cinco esqueletos viven en directorios hermanos, cada uno con su manifiesto, configuración de compilación y ejemplo de entorno. Compose, las guías y el script de verificación quedan en la raíz local.

| Repositorio de aplicación | Raíz local | Dependencias y herramientas |
| --- | --- | --- |
| Frontend | `frontend/` | `package.json`, `package-lock.json`, Vite, Playwright, Dockerfile y Nginx |
| BFF GraphQL | `bff-graphql/` | `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json` |
| Usuarios | `ms-usuarios/` | `go.mod`, `go.sum`, `cmd/ms-usuarios`, `internal/config` |
| Transacciones | `ms-transacciones/` | `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json` |
| Notificaciones | `ms-notificaciones/` | `pom.xml`, `src/main`, configuración Spring Boot |
| Agente MCP | `ms-agente-mcp/` | `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json` |

Las aplicaciones resuelven sus dependencias desde su propio directorio. Sus comunicaciones futuras se harán por los protocolos de la topología. Los archivos Git, los remotos y la ubicación del frontend se conservaron durante la preparación local.

## Plan de separación con autorización

1. Acordar cuáles serán los seis remotos y qué repositorio existente se reutilizará. Conservar el checkout original como respaldo local. Un `git bundle` preserva las referencias confirmadas. Respaldar aparte los cambios locales y archivos nuevos revisados, ya que un bundle omite el árbol de trabajo. Excluir `.env`, dependencias y compilaciones del respaldo que se vaya a compartir.
2. En clones desechables fuera del checkout, extraer el historial por prefijo con `git filter-repo` y ubicar el contenido en la raíz de cada clon. Para el frontend, incluir el historial de `.github/workflows/frontend-ci.yml` y ajustar las rutas del workflow a la nueva raíz. La extracción conserva autores, fechas y el historial relativo del componente. Los identificadores Git reescritos difieren de los originales, que quedan en el respaldo. Si un esqueleto aún carece de historial confirmado, incorporarlo como punto de partida al autorizar su primer commit.
3. Comparar las exportaciones con los directorios fuente, aplicar el respaldo de cambios locales donde corresponda y verificar que cada aplicación compile desde su raíz. Revisar historial y archivos con `git log --all` y `git diff --no-index` antes de cambiar referencias o publicar.
4. Ubicar la composición local y la documentación compartida en uno de los seis repositorios acordados, por ejemplo en `bff-graphql`, ajustando las rutas para apuntar a los clones hermanos. Mantener secretos y cachés fuera de Git. Cualquier creación de remoto, cambio de `origin`, commit y push requiere autorización.

## CI por repositorio

El workflow activo del frontend conserva instalación reproducible, ESLint, TypeScript, pruebas con umbral de líneas, Playwright y construcción y comprobación de la imagen. Los esqueletos tienen comprobaciones de compilación que se pueden ejecutar hoy. Las plantillas de GitHub Actions en `docs/ci/` describen los pasos de la aplicación definitiva y se adoptarán cuando existan los artefactos que requieren.

| Tecnología | Comprobación del esqueleto | CI al implementar el servicio |
| --- | --- | --- |
| TypeScript de BFF, Transacciones y Agente | `npm ci`, `npm run typecheck`, `npm run build`. `node --env-file=.env.example dist/main.js` comprueba configuración. | ESLint, pruebas reales, 60 % de líneas medibles y `docker build` con un Dockerfile del servicio. |
| Go de Usuarios | `go mod download`, `go vet ./...`, `go build ./...`, `go test ./...`. | Pruebas, 60 % de sentencias de aplicación y construcción Docker. |
| Java de Notificaciones | `mvn --batch-mode verify` con Java 17. | Checkstyle, JUnit, 60 % de líneas con JaCoCo y construcción Docker. |

Los esqueletos todavía carecen de lógica de dominio medible. El frontend mantiene pendientes la actualización de ESLint y la cobertura del total de fuentes. El informe de desarrollo local registra siete avisos moderados detectados al incluir dependencias de desarrollo. [Workflow actual](../.github/workflows/frontend-ci.yml) · [Plan de implementación](IMPLEMENTATION_PLAN.md#integración-continua) · [Auditoría del frontend](FRONTEND_AUDIT.md) · [Verificación local](LOCAL_DEVELOPMENT.md#registro-del-prompt-12)
