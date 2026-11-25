# Desarrollo local y guía del equipo

Necesitas Git, PowerShell y Docker Desktop con el motor de contenedores Linux y Compose V2. Para trabajar fuera de Docker, usa Node 22.12 o posterior dentro de la rama 22, Go según `ms-usuarios/go.mod` o JDK 17 con Maven 3.9.16 según tu componente.

## Obtener los recursos compartidos

Desde la carpeta donde crearás `Billetera-Workspace`, descarga el ZIP de la versión estable y su archivo SHA-256. El manifiesto `workspace.lock.json` fija los seis commits de `main` verificados por GitHub Actions tras la consolidación. [Descarga de workspace-v1.0.1](https://github.com/IgnacioCruzR/Billetera-Virtual/releases/tag/workspace-v1.0.1)

```powershell
$version = 'workspace-v1.0.1'
$asset = "billetera-recursos-$version.zip"
$download = "https://github.com/IgnacioCruzR/Billetera-Virtual/releases/download/$version"
$zip = Join-Path (Get-Location).Path $asset
$checksum = "$zip.sha256"
Invoke-WebRequest -UseBasicParsing -Uri "$download/$asset" -OutFile $zip -ErrorAction Stop
Invoke-WebRequest -UseBasicParsing -Uri "$download/$asset.sha256" -OutFile $checksum -ErrorAction Stop
```

En la misma sesión, verifica el SHA-256 y extrae los recursos en una carpeta nueva.

```powershell
$expected = (Get-Content -Raw -LiteralPath $checksum).Trim()
if ($expected -notmatch '^[a-fA-F0-9]{64}$' -or
    (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash -ne $expected) {
    throw 'El ZIP descargado no coincide con el SHA-256 de la versión'
}
$workspace = New-Item -ItemType Directory -Path Billetera-Workspace -ErrorAction Stop
Expand-Archive -LiteralPath $zip -DestinationPath $workspace.FullName -ErrorAction Stop
Set-Location -LiteralPath $workspace.FullName
```

Si ya tienes un workspace, extrae el ZIP en una carpeta temporal y revisa los cambios antes de incorporar los recursos a tu raíz. Conserva tus clones y tu archivo `.env` local. [Cómo se versionan los recursos](REPOSITORY_STRUCTURE.md#distribución-versionada)

## Clonar las aplicaciones

Desde el workspace recién extraído, clona las seis aplicaciones en las rutas de Compose. Git deja cada clon en el commit exacto de la versión. Después de verificar el entorno, vuelve a `main`, actualízala con `git pull --ff-only` y crea tu rama de trabajo. [Ramas y pull requests](#ramas-y-pull-requests)

```powershell
$lock = Get-Content -Raw -LiteralPath workspace.lock.json | ConvertFrom-Json
foreach ($app in $lock.applications) {
    git clone --no-checkout -- $app.repository $app.path
    if ($LASTEXITCODE -ne 0) { throw "Falló la clonación de $($app.path)" }
    git -C $app.path fetch --no-tags origin $app.commit
    if ($LASTEXITCODE -ne 0) { throw "No se pudo obtener el commit de $($app.path)" }
    git -C $app.path switch --detach $app.commit
    if ($LASTEXITCODE -ne 0) { throw "No se pudo activar el commit de $($app.path)" }
    $head = git -C $app.path rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $head -ne $app.commit) {
        throw "El checkout de $($app.path) difiere de la versión"
    }
}
```

## Configurar variables y arrancar por primera vez

Esta secuencia inicializa cuatro volúmenes si el proyecto aún carece de ellos. Si ya existe un proyecto o alguno de sus volúmenes, usa la sección de reutilización antes de arrancar.

```powershell
docker version
docker compose version
docker compose ls --all
docker volume ls --filter 'label=com.docker.compose.project=billetera-local'
Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
docker compose --env-file .env.example --profile frontend --profile backend-check config --quiet
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
```

Edita el `.env` de raíz y reemplaza las tres contraseñas ficticias por valores locales distintos. Deja `VITE_DATA_MODE=demo` y `FRONTEND_PORT=8080` para abrir la demo en la URL indicada. Edita o crea el `.env` de una aplicación a partir de su `.env.example` cuando vayas a arrancarla con su herramienta local. Mantén las contraseñas del servicio alineadas con las de su base si necesita conectarse a Docker. El agente reserva `LLM_API_KEY` para una integración futura y el ejemplo lo deja vacío.

```powershell
docker compose --profile frontend --profile backend-check config --quiet
docker compose --profile frontend up -d --build --wait --wait-timeout 180
docker compose --profile frontend ps
Invoke-RestMethod http://127.0.0.1:8080/healthz
```

Abre `http://127.0.0.1:8080/`. Nginx escucha en el puerto interno 8080. PostgreSQL y Kafka usan redes internas, con tres instancias PostgreSQL y un broker Kafka KRaft. El navegador carga los datos de demostración en memoria. `VITE_DATA_MODE=integration` selecciona la entrada de Apollo durante el build. La ruta `/graphql` queda reservada para el BFF cuando se implemente su servidor. [Plan GraphQL](GRAPHQL_INTEGRATION_PLAN.md)

Para parar este proyecto conservando sus contenedores y datos:

```powershell
docker compose --profile frontend stop
```

## Reutilizar o aislar datos Docker

- **Reutilizar el proyecto original.** Conserva el contexto Docker y el nombre `billetera-local`. Usa el mismo entorno con el que se inicializaron las bases. Puedes pasar el archivo existente directamente a Compose desde el workspace nuevo. La primera comprobación usa `--no-recreate` para dejar los cinco contenedores existentes en servicio. Si la demo anterior ocupa 8080, compruébala primero. Para cambiar deliberadamente a la imagen nueva en ese puerto, reconstruye y recrea solo `frontend` con el segundo comando.
- **Aislar la infraestructura.** Elige un nombre nuevo con `--project-name`, un archivo de entorno propio con tres contraseñas nuevas y un `FRONTEND_PORT` libre, por ejemplo 8081. Esta opción crea otras tres bases vacías y otro volumen Kafka. Usa el mismo nombre de proyecto y archivo de entorno en todos sus comandos, incluido `stop`.
- **Probar solo la imagen del frontend.** Construye `frontend` desde su clon y publica un puerto libre como 8081. Esta prueba deja la demo original en 8080 y prescinde de volúmenes PostgreSQL o Kafka.

```powershell
# Desde el workspace nuevo, reemplaza la ruta por la del entorno original.
$existingEnv = '..\Billetera Virtual\.env'
docker compose --env-file $existingEnv --project-name billetera-local --profile frontend up -d --no-recreate --wait --wait-timeout 180
# Ejecuta esta línea solo para cambiar el frontend que sirve en 8080.
docker compose --env-file $existingEnv --project-name billetera-local --profile frontend up -d --no-deps --build --wait frontend
```

```powershell
# Opción de aislamiento. Edita .env.aislado y elige un puerto libre antes del up.
if (-not (Test-Path -LiteralPath .env.aislado)) { Copy-Item .env.example .env.aislado }
docker compose --env-file .env.aislado --project-name billetera-aislado --profile frontend up -d --build --wait --wait-timeout 180
docker compose --env-file .env.aislado --project-name billetera-aislado --profile frontend stop
```

```powershell
# Opción para probar solo la imagen, desde la raíz del workspace.
docker build --tag billetera-frontend:prueba ./frontend
docker run --rm --publish 127.0.0.1:8081:8080 billetera-frontend:prueba
```

Los volúmenes reutilizables son `billetera-local_postgres-usuarios`, `billetera-local_postgres-transacciones`, `billetera-local_postgres-notificaciones` y `billetera-local_kafka`. PostgreSQL solo aplica las variables de inicialización al crear un directorio de datos vacío. Cambiar las variables de un proyecto existente requiere coordinar una rotación del rol. Usa `stop` para conservar los datos. [Nombres de proyecto en Compose](https://docs.docker.com/compose/how-tos/project-name/)

## Puertos y redes

| Servicio | Puerto interno y red | Acceso desde el host |
| --- | --- | --- |
| Nginx | 8080 en `web` | `127.0.0.1:8080` por defecto |
| PostgreSQL | 5432 en cada red interna propia: `usuarios-db`, `transacciones-db` y `notificaciones-db` | Mediante `docker compose exec` |
| Kafka | 9092 para clientes y 9093 para el controlador KRaft en la red interna `eventos` | Mediante `docker compose exec` |
| Backends de comprobación | Red interna `grpc`. Usuarios, Transacciones y Notificaciones también tienen acceso a `eventos` y a su propia red de datos. | Ejecución puntual con Compose |

## Ejecutar cada aplicación y sus pruebas

**Frontend.** Desde su clon, ejecuta los comandos siguientes. Detén Vite con Ctrl+C antes de pasar a las pruebas si lo estás ejecutando en esa misma terminal.

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:coverage
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Si pruebas con Edge instalado, configura `$env:PLAYWRIGHT_CHANNEL = 'msedge'` en esa terminal. El umbral unitario se mide sobre los módulos de `src/` cargados por esa suite. [Repositorio del frontend](https://github.com/Error4144/billetera-frontend)

**Backends.** Desde la raíz, elige el nombre de tu servicio. El perfil `backend-check` ejecuta un contenedor que valida configuración y sale. Usa el `.env.example` de la aplicación y el usuario y la contraseña de su base desde el entorno raíz. Para el proyecto original, pasa también `--env-file $existingEnv` antes del perfil.

```powershell
$service = 'ms-transacciones'
docker compose --profile backend-check run --rm --build --no-deps $service
```

Puedes elegir `bff-graphql`, `ms-usuarios`, `ms-transacciones`, `ms-notificaciones` o `ms-agente-mcp`. Son esqueletos de aplicación. Los cinco puntos de entrada terminan después de comprobar su arranque o configuración. Los nombres DNS de los ejemplos sirven en Docker y las comprobaciones no requieren abrir conexiones. [Perfiles de Compose](https://docs.docker.com/compose/how-tos/profiles/)

| Repositorio | Comandos nativos desde su clon |
| --- | --- |
| BFF GraphQL, Transacciones y Agente MCP | `npm.cmd ci`, `npm.cmd run typecheck`, `npm.cmd run build` y `npm.cmd run check:config` con `.env` local. |
| Usuarios | `go mod download`, `go vet ./...`, `go build ./...` y `go test ./...`. Con las variables del servicio disponibles en la sesión, ejecuta `go run ./cmd/ms-usuarios`. |
| Notificaciones | `mvn.cmd --batch-mode clean verify`. Con las variables disponibles en la sesión, ejecuta `java -jar target/ms-notificaciones-0.1.0.jar`. |

Go y Java leen variables del proceso. Si ya tienes Node 22 y quieres cargar un `.env` de forma local para esos comandos, puedes lanzar el proceso desde el clon con este ejemplo:

```powershell
$runWithEnv = "const r=require('node:child_process').spawnSync(process.argv[1], process.argv.slice(2), {stdio:'inherit'}); if(r.error) console.error(r.error.message); process.exitCode=r.status ?? 1"
# Desde ms-usuarios.
node --env-file=.env -e $runWithEnv go run ./cmd/ms-usuarios
# Desde ms-notificaciones, tras Maven.
node --env-file=.env -e $runWithEnv java -jar target/ms-notificaciones-0.1.0.jar
```

Para verificar las tres bases, Kafka y las diez pantallas servidas por Nginx desde la raíz, instala primero las dependencias y el navegador de Playwright en el frontend. El script comprueba credenciales, aislamiento, producción y consumo en un tópico temporal, y disponibilidad de la demo. Usa `-FrontendPort`, `-EnvFile` y `-ProjectName` si tu entorno lo requiere. `-Persistence` reinicia PostgreSQL y Kafka para comprobar sus datos, por lo que se reserva para una sesión coordinada.

```powershell
./scripts/verify-local.ps1 -Frontend
```

## Ramas y pull requests

Una distribución inicial para tres integrantes puede agrupar Frontend y BFF, Usuarios y Notificaciones, y Transacciones y Agente MCP. Revisen los cambios de contratos con las personas que mantienen el productor y sus consumidores. Crea una rama en cada repositorio afectado y enlaza los PR dependientes.

Parte de `main` para nuevos cambios de aplicación. Si tu cambio requiere una rama pendiente de revisión, acuerda esa dependencia con su autor y enlaza ambos PR.

```powershell
# Desde el workspace, cambia el nombre de carpeta y de rama según tu tarea.
Set-Location ms-transacciones
git switch main
git pull --ff-only
git switch -c feature/contrato-movimientos

# Después de implementar y probar, agrega solo los archivos revisados.
git status --short
git add -- src/archivo.ts
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Revisa el diff preparado' }
gitleaks git --staged --redact .
if ($LASTEXITCODE -ne 0) { throw 'Revisa el resultado de Gitleaks' }
git commit -m "Define el contrato de movimientos"
git push -u origin HEAD
```

Sustituye `src/archivo.ts` por los archivos reales. Abre un PR a `main` en GitHub e incluye alcance, pruebas ejecutadas y enlaces a los PR relacionados. Quien carezca de permisos de escritura puede usar un fork como remoto de publicación y abrir el PR hacia `Error4144`. Conserva las variables privadas en los `.env` ignorados. [Repositorios y CI](REPOSITORY_STRUCTURE.md)
