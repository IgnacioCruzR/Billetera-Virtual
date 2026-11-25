# Repositorios y recursos compartidos

Cada clon tiene su propio `.git`, remoto `origin`, rama principal `main` y manifiestos de dependencias. Las aplicaciones se construyen con su propio contexto. La raíz `Billetera-Workspace` es una carpeta de trabajo compartida con Compose, guías y scripts.

| Repositorio | Carpeta local | Dependencias y configuración del build |
| --- | --- | --- |
| [billetera-frontend](https://github.com/Error4144/billetera-frontend) | `frontend` | `package-lock.json`, Vite, TypeScript, Playwright, Nginx |
| [billetera-bff-graphql](https://github.com/Error4144/billetera-bff-graphql) | `bff-graphql` | `package-lock.json`, `.nvmrc`, `tsconfig.json` |
| [billetera-ms-usuarios](https://github.com/Error4144/billetera-ms-usuarios) | `ms-usuarios` | `go.mod`, `go.sum` |
| [billetera-ms-transacciones](https://github.com/Error4144/billetera-ms-transacciones) | `ms-transacciones` | `package-lock.json`, `.nvmrc`, `tsconfig.json` |
| [billetera-ms-notificaciones](https://github.com/Error4144/billetera-ms-notificaciones) | `ms-notificaciones` | `pom.xml`, configuración Spring Boot |
| [billetera-ms-agente-mcp](https://github.com/Error4144/billetera-ms-agente-mcp) | `ms-agente-mcp` | `package-lock.json`, `.nvmrc`, `tsconfig.json` |

La extracción mediante `git subtree split` conservó el historial por aplicación y ubicó su código en la raíz de cada clon. Los identificadores de commits pueden diferir entre el repositorio original y cada historial extraído. Las aplicaciones no comparten directorios de dependencias ni importan código desde un clon hermano. La coordinación se hace mediante contratos GraphQL, Protobuf y eventos Kafka. [Topología](TOPOLOGY.md)

## CI por repositorio

Los workflows de aplicación se ejecutan en los pull requests, los cambios en `main` y las ejecuciones manuales. Las imágenes de CI se construyen localmente en el runner. El [registro de consolidación](VERIFICATION_12B.md) conserva la verificación local previa a la publicación.

| Repositorio | Controles |
| --- | --- |
| Frontend | `npm ci`, ESLint, TypeScript, build de Vite, pruebas unitarias con umbral del 60 % de líneas en módulos cargados, Playwright Chromium en Ubuntu 24.04 y comprobación de la imagen Nginx. |
| BFF, Transacciones y Agente MCP | `npm ci`, `npm run typecheck`, compilación, arranque con el ejemplo y empaquetado Docker. |
| Usuarios | Dependencias Go, `go vet ./...`, compilación, `go test ./...`, arranque con el ejemplo y empaquetado Docker. |
| Notificaciones | Java 17, análisis de `javac` con `-Xlint:all` y fallo por advertencias, `mvn clean verify`, arranque con el ejemplo y empaquetado Docker. |

La cobertura backend se incorporará con pruebas de dominio o de contrato. Los YAML de `docs/ci/` conservan las propuestas de cobertura para esa etapa. [Plan de implementación](IMPLEMENTATION_PLAN.md#integración-continua)

La configuración de Notificaciones pasa `-Xlint:all` al compilador a través del plugin de Maven. [Argumentos de javac en Maven](https://maven.apache.org/plugins/maven-compiler-plugin/examples/pass-compiler-arguments.html)

## Distribución versionada

La rama `workspace-integration` de Billetera-Virtual reúne Compose, ejemplos y documentación técnica, scripts, contratos y el manifiesto de aplicaciones. Los cambios compartidos se revisan mediante PR a esa rama. `main` del repositorio original conserva la referencia histórica de la extracción. El código, las imágenes y el CI de cada aplicación se revisan en los seis repositorios de `Error4144`. [Rama de coordinación](https://github.com/IgnacioCruzR/Billetera-Virtual/tree/workspace-integration)

Cada etiqueta `workspace-vX.Y.Z` fija el ZIP, su checksum y los seis SHAs de `workspace.lock.json`. Las versiones posteriores deben fijar commits publicados y reflejar los cambios de contratos en las notas de la versión. Las fuentes de contratos aprobados se alojan bajo `contracts/`. [Contratos](../contracts/README.md) · [Guía de descarga y clonación](LOCAL_DEVELOPMENT.md#obtener-los-recursos-compartidos)

`workspace-v1.0.1` es la versión estable y fija los commits de `main` verificados después de fusionar los seis PR. La versión preliminar `workspace-v1.0.0` conserva los commits usados durante la revisión. [Versión estable](https://github.com/IgnacioCruzR/Billetera-Virtual/releases/tag/workspace-v1.0.1) · [Versión preliminar](https://github.com/IgnacioCruzR/Billetera-Virtual/releases/tag/workspace-v1.0.0)

Para preparar el ZIP desde el checkout de coordinación, crea una etiqueta sobre el commit revisado y genera el ZIP con la lista de recursos:

```powershell
$version = 'workspace-v1.0.1'
$asset = "billetera-recursos-$version.zip"
git archive --format=zip --output=$asset $version -- .env.example .gitattributes .gitignore compose.yaml README.md ARCHITECTURE.md TECH_STACK.md docs scripts contracts workspace.lock.json
if ($LASTEXITCODE -ne 0) { throw 'No se pudo exportar la versión' }
(Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash.ToLowerInvariant() |
    Set-Content -Encoding ASCII -LiteralPath "$asset.sha256"
```

Publica ambos archivos en la release de la etiqueta. Para una actualización, usa una etiqueta nueva para que el equipo pueda seguir reproduciendo versiones anteriores.
