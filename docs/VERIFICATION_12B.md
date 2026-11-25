# Verificación de la consolidación multirepositorio

Ejecución del 25 de noviembre de 2026 en PowerShell. Los resultados describen la sesión local. Los workflows están preparados en cada clon y su ejecución en GitHub Actions queda pendiente de publicación.

## Git y archivos compartidos

| Comando o comprobación | Salida | Resultado |
| --- | ---: | --- |
| `git status --short --branch`, `git remote -v`, `git symbolic-ref --short refs/remotes/origin/HEAD` y `git rev-parse --show-toplevel --absolute-git-dir` en cada aplicación | 0 cada uno | Seis clones separados, cada uno en `main`, con `origin/main` y el remoto homónimo de `Error4144` para lectura y escritura. Los cambios de consolidación están en los árboles de trabajo. |
| Consulta de los siete repositorios en la API de GitHub | HTTP 200 cada uno | Los seis repositorios de aplicación y el repositorio original son públicos y declaran `main` como rama predeterminada. |
| `git status --short --branch` y `git rev-parse HEAD` en el checkout original | 0 cada uno | Árbol limpio y commit `292e0dfd05126a290daca225c60bae65247c3282` antes y después. |
| `git rev-parse --show-toplevel` en la raíz del workspace | 128 | La raíz está fuera de Git. |
| `git diff --check` por aplicación y análisis del script con el parser de PowerShell | 0 cada uno | Diff sin errores de espacios y script válido. |
| `tar.exe -a -cf` y `tar.exe -tf` con la lista de recursos compartidos, luego `Expand-Archive` | 0 cada uno | Archivo de prueba creado y extraído con la plantilla `.env.example`, la documentación, la configuración y el script. |
| Verificación de archivos y encabezados en enlaces relativos Markdown | 0 | 120 enlaces válidos en 29 archivos. |

El original tenía un workflow activo de frontend y tres plantillas de CI para los backends. Los cinco backends compartían el diseño de infraestructura, con sus propios manifiestos y ejemplos. Solo el frontend tenía Dockerfile antes de la consolidación. Se ajustaron los contextos y referencias al checkout agrupado. [Inventario y CI](REPOSITORY_STRUCTURE.md)

## Docker e integración local

| Comando o comprobación | Salida | Resultado |
| --- | ---: | --- |
| `docker --context desktop-linux version`, `docker compose version`, `docker ps -a`, `docker compose ls --all` y `docker volume ls` | 0 cada uno con acceso a Docker Desktop | Motor Linux 28.5.1 y Compose 2.40.3-desktop.1. El proyecto previo `billetera-local` tenía tres PostgreSQL, Kafka y Nginx saludables. Nginx ocupaba `127.0.0.1:8080`. |
| `docker compose --env-file .env.example --profile frontend --profile backend-check config --quiet` | 0 | Plantilla válida con los seis contextos. |
| `docker compose --env-file .env.example --project-name billetera-aislado --profile frontend --profile backend-check config --format json` con `FRONTEND_PORT=8081` | 0 | Se comprobaron el nombre alternativo, los cuatro nombres de volúmenes aislados y el mapeo de 8081 a 8080. |
| `docker compose --env-file $existingEnv --profile frontend up -d --no-recreate --wait --wait-timeout 180` | 0 | Los cinco contenedores existentes siguieron saludables. Compose leyó el entorno original directamente. |
| `./scripts/verify-local.ps1 -ProjectName billetera-local -EnvFile $existingEnv` | 0 | Las tres instancias aceptaron su usuario y contraseña, rechazaron una contraseña incorrecta y conservaron el aislamiento DNS y su propia base. Kafka produjo y consumió un mensaje en un tópico temporal que el script retiró. |
| `docker compose --env-file .env.example --profile frontend --profile backend-check build` | 0 | Se construyeron seis imágenes. |
| `docker compose --env-file .env.example --profile backend-check run --rm --no-deps --pull never <servicio>` | 0 para los cinco | Cada esqueleto completó su comprobación y su contenedor temporal se retiró al salir. |
| `node ./frontend/scripts/container-smoke.mjs 8080` y la misma prueba con la imagen nueva en un puerto temporal | 0 los dos | `/healthz`, caché de activos, rutas reservadas, diez pantallas y demo en Edge sin solicitudes de datos. |
| `docker rm --force $id` sobre el contenedor de Nginx usado en la prueba | 0 | Se retiró el contenedor de la imagen nueva que usaba el puerto temporal. |

El inventario final conservó el proyecto original activo en 8080 y sus cuatro volúmenes. Los contenedores de comprobación usaron una red interna `billetera-local_grpc` creada en ese mismo proyecto. La opción de aislamiento se validó renderizando Compose. La prueba de reinicio `-Persistence` quedó fuera de esta ejecución para conservar la sesión activa. [Reutilización y aislamiento](LOCAL_DEVELOPMENT.md#reutilizar-o-aislar-datos-docker)

## Compilación, pruebas y CI

| Comando | Salida | Resultado |
| --- | ---: | --- |
| `npm ci` en Frontend, BFF, Transacciones y Agente MCP | 0 los cuatro | Instalación con los lockfiles de cada clon. |
| `npm run lint`, `npm run typecheck` y `npm run build` en Frontend | 0 cada uno | ESLint, TypeScript y Vite correctos. |
| `npm run test:coverage` en Frontend | 0 | 37 pruebas unitarias aprobadas. 95,64 % de líneas y 81,98 % de ramas sobre los módulos de `src/` cargados por la suite. |
| `npm run test:coverage:statements` en Frontend | 0 | 85,40 % de sentencias en 33 archivos del mismo alcance. |
| `npm run test:e2e` con `PLAYWRIGHT_CHANNEL=msedge` en Frontend | 0 | 40 pruebas de navegador aprobadas. |
| `npm run typecheck`, `npm run build` y `node --env-file=.env.example dist/main.js` en BFF, Transacciones y Agente MCP | 0 cada uno | Tres esqueletos TypeScript compilados y comprobados. |
| `go mod download`, `go vet ./...`, `go build ./...`, `go test ./...` y `go run ./cmd/ms-usuarios` | 0 cada uno | Usuarios compiló con Go 1.27.4 y validó la configuración de ejemplo. Go informó que todavía carece de archivos de prueba. |
| `mvn --batch-mode --no-transfer-progress clean verify` y `java -jar target/ms-notificaciones-0.1.0.jar` | 0 los dos | Maven 3.9.16 y JDK 17 compilaron con análisis `javac`. El artefacto arrancó con las variables de ejemplo. Maven informó que todavía carece de pruebas. |
| `actionlint -no-color` sobre los workflows | 0 los seis | Sintaxis de GitHub Actions validada localmente. |

El primer acceso al daemon desde la sesión aislada devolvió 1. Se repitió con acceso a Docker Desktop. Maven devolvió 1 en el primer intento al abrir un JAR de dependencias en la sesión aislada y compiló al repetirlo con acceso a la misma caché temporal.

## Revisión de secretos

| Comando o comprobación | Salida | Resultado |
| --- | ---: | --- |
| `git log --all --name-only --format=` y revisión de nombres sensibles | 0 en cada clon | No aparecieron archivos de entorno privados ni nombres de claves revisados en los seis historiales. Cada aplicación tiene un `.env.example` con valores ficticios o vacíos. |
| `git check-ignore --quiet --no-index` | 0 para `.env`, `.env.local` y un nombre de clave PEM. 1 para `.env.example`. | Los seis `.gitignore` excluyen variables privadas y permiten versionar el ejemplo. |
| `gitleaks git --log-opts=--all --redact=100` con Gitleaks 8.30.1 | 0 los seis | Nueve commits locales examinados en total. Sin hallazgos. |
| `gitleaks dir --redact=100` en los archivos nuevos o modificados y en cada `.env.example` | 0 en los seis clones | Sin hallazgos en los candidatos a publicación. |
| `gitleaks dir --redact=100` en el conjunto de recursos compartidos de la raíz | 0 | Sin hallazgos en Compose, ejemplos, documentación, scripts o configuración compartida. |
