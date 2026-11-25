# Desarrollo local

## Requisitos y versiones

La composición usa contenedores Linux. En Windows, abre Docker Desktop con el motor WSL 2 y usa Docker Compose V2. El frontend y los esqueletos TypeScript requieren Node 22.12 o posterior. Usuarios usa Go 1.27.4. Notificaciones compila con JDK 17 y Maven 3.9.16. El host puede ejecutar las imágenes sin instalar los compiladores de Go y Java si solo necesita probar la infraestructura y la demo.

| Componente | Versión seleccionada | Decisión |
| --- | --- | --- |
| Construcción y ejecución del frontend | `node:22.23.5-alpine` y `nginx:1.30.8-alpine` | Node 22 LTS para `npm ci` y compilación. Nginx estable sirve el paquete y reutiliza la configuración existente. |
| PostgreSQL | `postgres:17.12-bookworm` | Rama 17 con soporte. Se mantiene el volumen en `/var/lib/postgresql/data`, propio de esa versión. |
| Kafka | `apache/kafka:4.3.2` | Imagen JVM oficial. Un broker y controlador KRaft combinados para desarrollo, sin dependencia de ZooKeeper. |
| BFF y Transacciones | NestJS 12.6.1, TypeScript 5.9.3 | Nest GraphQL 14.2.1 y Apollo Server 5 en el BFF. Transacciones prepara `pg` y KafkaJS. |
| Usuarios | Go 1.27.4, gRPC Go 1.85.0, pgx 5.13.0 | Módulo propio y configuración del pool, sin abrir conexiones. |
| Notificaciones | Spring Boot 4.2.0, Java 17, gRPC Java 1.86.0 | Maven, Spring Kafka y JDBC PostgreSQL. El contexto aplica configuración local y puede cerrarse sin levantar listeners. |
| Agente | SDK oficial MCP 1.32.2, gRPC JS 1.14.7, TypeScript 5.9.3 | Configuración gRPC y HTTPS. Los bloqueos de npm están separados por aplicación. |

[Versiones de Node](https://nodejs.org/en/about/previous-releases) · [Nginx estable](https://nginx.org/en/download.html) · [Soporte PostgreSQL](https://www.postgresql.org/support/versioning/) · [Distribuciones Kafka](https://kafka.apache.org/downloads/) · [Versiones Go](https://go.dev/dl/) · [Requisitos Spring Boot](https://docs.spring.io/spring-boot/system-requirements.html)

## Configuración y uso

Desde la raíz, conserva un `.env` existente o copia `.env.example` y sustituye las tres contraseñas de ejemplo por valores distintos. Los archivos `.env` y variantes privadas están excluidos del control de versiones. Asegura que las credenciales de cada servicio coincidan con las de su base si se incorpora posteriormente a Compose. PostgreSQL aplica las variables de inicialización al crear un volumen vacío. La rotación sobre un volumen existente exige cambiar el rol explícitamente y actualizar su configuración, manteniendo el volumen.

```powershell
docker version
docker compose version
docker compose --env-file .env.example --profile frontend config --quiet
docker compose --profile frontend config --quiet
docker compose up -d --wait --wait-timeout 180
docker compose --profile frontend up -d --build --wait frontend
docker compose --profile frontend ps
```

El primer `config` verifica la plantilla con valores ficticios. El segundo revisa la configuración local sin imprimirla. La infraestructura base incluye las tres bases y Kafka. El perfil `frontend` añade Nginx y puede iniciarse por separado. Los cinco esqueletos permanecen fuera de Compose hasta que cada uno tenga una imagen ejecutable y una comprobación útil de disponibilidad.

La demo se abre en `http://127.0.0.1:8080`. `FRONTEND_PORT` permite elegir otro puerto local. `VITE_DATA_MODE=demo` o `integration` se fija durante la construcción. `integration` presenta el estado del contrato del BFF y mantiene `/graphql` reservado. Con el BFF operativo, se colocará un proxy local del mismo origen o un Ingress con `/graphql` exacto al BFF y `/` al frontend. [Configuración de Apollo](GRAPHQL_INTEGRATION_PLAN.md)

```powershell
docker compose --profile frontend stop
# Conserva los contenedores y los cuatro volúmenes.
```

## Puertos y redes

| Servicio | DNS interno, puerto y red | Publicación en el host |
| --- | --- | --- |
| Frontend | `frontend:8080` en `web` | `127.0.0.1:8080` por defecto |
| BFF | `bff-graphql:3000` futuro, red de entrada y gRPC | Por proxy o Ingress en el mismo origen |
| Usuarios | `ms-usuarios:50051` futuro, gRPC a consumidores autorizados, `usuarios-db` y `eventos` | Interna |
| Transacciones | `ms-transacciones:50052` futuro, gRPC a consumidores autorizados, `transacciones-db` y `eventos` | Interna |
| Notificaciones | `ms-notificaciones:50053` futuro, gRPC con el BFF, `notificaciones-db` y `eventos` | Interna |
| Agente | `ms-agente-mcp:50054` futuro, gRPC autorizado y salida HTTPS del propio agente | Interna |
| PostgreSQL | `postgres-usuarios`, `postgres-transacciones`, `postgres-notificaciones`, cada uno en su propia red interna y puerto 5432 | Interna |
| Kafka | `kafka:9092` en `eventos`. El controlador KRaft usa 9093 en esa red | Interna |

Nginx conserva 8080 dentro del contenedor, en coherencia con el Dockerfile, CI y la topología. Las redes de PostgreSQL y Kafka son internas. React usa HTTP de mismo origen para sus recursos y la futura conexión al BFF. Los consumidores futuros usan el DNS de Docker y se incorporan únicamente a las redes necesarias. PostgreSQL usa SCRAM por la interfaz de red del servicio. Kafka conserva el broker, ID de clúster y listener anunciados en Compose. La creación automática de tópicos está deshabilitada. El broker único usa un volumen local y está destinado a desarrollo. [Topología oficial](TOPOLOGY.md)

## Variables

| Ubicación | Configuración pública o de infraestructura | Valores privados |
| --- | --- | --- |
| `.env` de raíz | `FRONTEND_PORT`, `VITE_DATA_MODE`, `POSTGRES_USUARIOS_USER`, `POSTGRES_TRANSACCIONES_USER`, `POSTGRES_NOTIFICACIONES_USER` | `POSTGRES_USUARIOS_PASSWORD`, `POSTGRES_TRANSACCIONES_PASSWORD`, `POSTGRES_NOTIFICACIONES_PASSWORD` |
| BFF | `BFF_PORT`, `GRPC_USUARIOS_ADDRESS`, `GRPC_TRANSACCIONES_ADDRESS`, `GRPC_NOTIFICACIONES_ADDRESS`, `GRPC_AGENTE_ADDRESS` | Credenciales de sesión futuras |
| Usuarios, Transacciones y Notificaciones | `GRPC_PORT`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `KAFKA_BROKERS`. Transacciones también usa `GRPC_USUARIOS_ADDRESS`. Usuarios admite `POSTGRES_SSLMODE`. | `POSTGRES_PASSWORD` de la base propia |
| Agente MCP | `GRPC_PORT`, `GRPC_USUARIOS_ADDRESS`, `GRPC_TRANSACCIONES_ADDRESS`, `LLM_BASE_URL`, `LLM_MODEL` | `LLM_API_KEY` opcional reservado, vacío en el ejemplo |
| Vite | `VITE_DATA_MODE` se incorpora al artefacto y es visible en el navegador. | Los secretos pertenecen al entorno de cada servicio. |

Los `.env.example` por aplicación incluyen los nombres DNS internos. El `POSTGRES_SSLMODE=disable` del ejemplo de Usuarios se limita a la red interna local. En Kubernetes, las direcciones, puertos y demás valores públicos serán ConfigMaps. Las contraseñas y la futura clave LLM serán Secrets del workload propietario. El build del frontend recibe únicamente el modo público.

## Verificación y resolución de problemas

Las sondas de Compose comprueban `pg_isready` por TCP, metadatos del broker y `/healthz` de Nginx. `scripts/verify-local.ps1` va más allá y verifica credenciales, separación DNS, consultas SQL y un recorrido completo de producción y consumo Kafka. Con `-Persistence`, reinicia únicamente las cuatro dependencias y vuelve a leer su marcador de prueba. Usa un tópico y tablas con identificadores aleatorios reservados para esta comprobación y limpia esos recursos al terminar. Las bases, el tópico financiero futuro y los volúmenes conservan su ciclo normal.

Para comprobar las diez pantallas en Nginx, instala las dependencias del frontend con `npm ci`. Usa Chromium de Playwright, o selecciona Edge instalado como se muestra. Ejecuta las comprobaciones con la infraestructura y el frontend en modo `demo` iniciados.

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
./scripts/verify-local.ps1 -Persistence -Frontend
# Para verificar solo Nginx y React con el puerto configurado.
node ./frontend/scripts/container-smoke.mjs 8080
```

- **Permiso de Docker**. Abre PowerShell normal con la cuenta que ejecuta Docker Desktop. Comprueba el contexto con `docker context ls` y `docker context show`. El contexto verificado en este equipo es `desktop-linux`. Si hace falta seleccionarlo sin cambiar una configuración global, usa `docker --context desktop-linux version`. Confirma las secciones Client y Server y luego `docker compose version`.
- **Docker Desktop o WSL detenido**. Abre Docker Desktop desde Inicio, espera a que indique que el motor está listo y verifica el modo de contenedores Linux y el motor WSL 2. `wsl --version` y `wsl --list --verbose` ayudan a distinguir la instalación y el estado de la distribución. Revisa `whoami /groups` si la política local exige `docker-users`. La cuenta del equipo ya figura en ese grupo. [Permisos de Docker en Windows](https://docs.docker.com/desktop/setup/install/windows-permission-requirements/) · [Motor WSL 2](https://docs.docker.com/desktop/features/wsl/)
- **Puerto ocupado**. Revisa `netstat -ano -p tcp`. Ajusta `FRONTEND_PORT` y pasa el mismo puerto a `-FrontendPort`. Un PostgreSQL existente en el puerto 5432 del host puede convivir con los tres puertos 5432 internos.
- **Base no saludable o contraseña inválida**. Consulta `docker compose logs postgres-usuarios`, o el servicio que falle. Verifica la correspondencia entre el `.env` y el volumen inicializado. Kafka usa el DNS `kafka` para el listener anunciado y requerirá un tópico explícito para cada prueba.
- **Caché de frontend o modo incorrecto**. Reconstruye con `docker compose --profile frontend up -d --build --wait frontend`. Comprueba la ruta exacta `/graphql` y los recursos hasheados. La demo devuelve 404 en la ruta reservada.

## Equivalencia en Kubernetes

Compose corresponde al entorno de desarrollo. El diseño posterior usa el namespace `billetera`, seis Deployments y Services para las aplicaciones, tres StatefulSets PostgreSQL y un StatefulSet Kafka con PVC independientes, ConfigMaps y Secrets por workload e Ingress TLS con `/` y `/graphql`. Kubernetes necesitará probes, permisos, políticas de red y capacidad propios. [Diseño objetivo](TOPOLOGY.md#despliegue-objetivo-en-kubernetes)

## Registro del Prompt 12

Verificación del 25 de noviembre de 2026 en Windows 11, build 26200.9974, con Git 2.51.2, Node 22.21.0, npm 10.9.4, Java 17.0.12 y cliente kubectl 1.34.1. La medición dio 63,71 GiB de memoria total, 35,43 GiB libres y 110,41 GiB libres en disco. El puerto 5432 del host ya estaba en escucha y quedó fuera de la composición. Go y Maven se ejecutaron desde archivos portátiles verificados, sin cambiar la instalación del equipo.

| Comando | Salida | Evidencia |
| --- | ---: | --- |
| `docker version` desde sesión aislada | 1 | Acceso denegado a la configuración de usuario y al canal del daemon. |
| `docker version`, `docker context show`, `docker desktop status` y `docker compose version` con acceso a Docker Desktop | 0 | Docker Desktop 4.49.0, motor Linux 28.5.1, contexto `desktop-linux` y Compose 2.40.3. |
| `wsl --version` y `wsl --list --verbose` con acceso a WSL | 0 | WSL 2.6.1 y distribución `docker-desktop` en ejecución, versión 2. |
| `docker compose --env-file .env.example --profile frontend config --quiet` | 0 | Plantilla Compose válida. |
| `docker compose --profile frontend up -d --build --wait --wait-timeout 180` | 0 | Tres PostgreSQL, Kafka y Nginx iniciados con sondas saludables. |
| `./scripts/verify-local.ps1 -Persistence -Frontend` | 0 | Contraseña correcta e incorrecta por DNS interno, aislamiento, persistencia de las tres bases, mensaje Kafka antes y después de reiniciar, y diez rutas de React servidas por Nginx. |
| `docker compose --profile frontend ps` | 0 | Cinco contenedores saludables. Nginx publicado en `127.0.0.1:8080`. |
| `docker image inspect` y revisión de archivos estáticos | 0 | 35 archivos estáticos. Ausencia de los valores privados de la configuración local en el paquete y de variables privadas en la imagen. |
| `docker build --build-arg VITE_DATA_MODE=integration` y prueba en Edge sobre un contenedor temporal | 0 | Pantalla de integración cargada. Cero solicitudes de API desde React. `POST /graphql` devuelve 404 y el cuerpo queda fuera de la SPA. |
| `npm run lint`, `npm run typecheck`, `npm run test:coverage` en frontend | 0 | 37 unitarias aprobadas. 95,64 % de líneas y 81,98 % de ramas en el mismo alcance de 33 archivos. |
| `npm run test:e2e` con Edge | 0 | 40 pruebas de navegador aprobadas. |
| `npm audit --omit=dev --json` y `npm audit --json` en frontend | 0 / 1 | Cero avisos en dependencias de ejecución. Siete avisos moderados al incluir dependencias de desarrollo. |
| `npm install`, `npm run build` y `node --env-file=.env.example dist/main.js` en los tres esqueletos TypeScript | 0 | BFF, Transacciones y Agente MCP compilan. La comprobación de configuración del BFF rechaza un puerto fuera de rango con código 1. |
| `go mod tidy`, `go vet ./...`, `go build ./...`, `go test ./...` y `go run ./cmd/ms-usuarios` | 0 | Módulo Go compilado y configuración verificada. El runner informa que todavía no hay archivos de prueba. |
| `mvn --batch-mode clean verify` y `java -jar target/ms-notificaciones-0.1.0.jar` | 0 | Compilación limpia con Java 17 y verificación de arranque de configuración del artefacto Spring Boot. El runner informa que todavía no hay pruebas. |

La auditoría usó acceso acotado a Docker Desktop y WSL sin cambiar permisos ni pertenencia a grupos. La primera prueba PostgreSQL devolvió código 1 con un control que usaba la interfaz de loopback. La prueba final ejerció SCRAM por el DNS interno. `go mod tidy` y `mvn verify` devolvieron inicialmente código 1 al abrir archivos de caché desde la sesión aislada. Go pasó al mover `GOPATH` a un directorio temporal y Maven al repetir la compilación con acceso a su caché. Los cinco contenedores de desarrollo quedaron iniciados. [Estado de integración](FRONTEND_INTEGRATION_STATUS.md) · [Esqueletos y CI](REPOSITORY_STRUCTURE.md)
