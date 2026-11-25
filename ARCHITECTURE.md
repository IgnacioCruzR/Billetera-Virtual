# Arquitectura de Billetera Virtual

Esta página reúne las decisiones del encargo correctivo del 25 de noviembre de 2026. La [topología](docs/TOPOLOGY.md) y el [stack](TECH_STACK.md) definen el diseño objetivo. El [modelo de dominio](docs/DOMAIN_MODEL.md), las [reglas de negocio](docs/BUSINESS_RULES.md) y los [indicadores financieros](docs/FINANCIAL_INDICATORS.md) definen los conceptos y cálculos del producto. Las [decisiones de arquitectura](docs/ARCHITECTURE_DECISIONS.md) explican las correcciones. El [plan de implementación](docs/IMPLEMENTATION_PLAN.md) registra el orden de trabajo y sus condiciones de aceptación.

## Fuentes y alcance de la revisión

El prompt correctivo fija repositorios, tecnologías, flujos e infraestructura. Los archivos `Stack.jpeg` y `Topologia.jpeg` estaban ausentes del workspace y de los adjuntos locales examinados por nombre. La revisión cubrió el checkout, los archivos versionados, las dependencias declaradas, los puntos de entrada y la capa de datos del frontend. La existencia de otros repositorios remotos queda sin verificar.

## Diagnóstico del workspace

| Componente | Estado observado |
| --- | --- |
| Repositorios | Un checkout Git local con `frontend/` como subdirectorio del proyecto. Los otros cinco componentes objetivo carecen de código en el workspace revisado. |
| Frontend | Aplicación React y TypeScript con Vite, Tailwind CSS, primitivas shadcn/ui, Lucide React y Recharts. Apollo Client está declarado como dependencia. La entrada React monta el dashboard y el repositorio en memoria alimenta las pantallas. |
| Funcionalidades | Dashboard, Movimientos, Mis cuentas, Presupuestos, Cobros y pagos, Gastos hormiga, Metas de ahorro, Salud financiera, Asistente IA y Configuración. La aplicación comparte registros financieros y preferencias a través de adaptadores locales de sesión. |
| Backend y contratos | Faltan servidores y clientes de los cinco servicios, esquemas GraphQL efectivos, archivos Protobuf, persistencia implementada y clientes de Kafka. |
| Conectividad del navegador | La revisión de la capa de datos, el punto de entrada y la configuración de Vite encontró un flujo local en memoria. Apollo queda listo para integrar cuando exista el endpoint público del BFF. |
| Entrega | Se añadieron empaquetado Docker/Nginx y CI para el frontend. Las plantillas de CI para servicios se conservan en el workspace para su incorporación futura. Kubectl está instalado y carece de contexto configurado. El daemon Docker no respondió localmente. |

## Inconsistencias y correcciones

| Impacto | Hallazgo | Corrección |
| --- | --- | --- |
| Alto | Los documentos y los README atribuían el dominio financiero a .NET y C#. | El propietario oficial es `ms-transacciones`, implementado a futuro en NestJS y TypeScript. Se conservaron las reglas de dominio y el catálogo de eventos. |
| Alto | El diagrama omitía la consulta del agente a Usuarios y el consumo Kafka de Transacciones. | Ambos flujos constan en la topología obligatoria y en la matriz de cumplimiento. |
| Alto | Los diagramas y las descripciones de alertas suponían llamadas directas desde Notificaciones a Usuarios o Finanzas. | El diseño síncrono usa exclusivamente las conexiones del prompt. La verificación de vigencia para alertas se documenta como un contrato asíncrono pendiente de cerrar con los propietarios. |
| Medio | La aplicación se construía y servía con Vite en desarrollo. Faltaban empaquetado Nginx y automatización CI. | Docker genera una imagen Nginx desde `dist`. El workflow compila, ejecuta las comprobaciones TypeScript y las pruebas, aplica el umbral unitario y valida la imagen. |
| Medio | Existían referencias históricas que podían interpretarse como contratos instalados. | Las matrices distinguen código local, dependencias instaladas, plantillas y diseño pendiente. Los contratos futuros se mantienen como propuestas. |

La búsqueda de código o proyectos en .NET, C#, ASP.NET y Entity Framework encontró referencias documentales. Tampoco se encontraron usos de NATS, RabbitMQ, REST entre el BFF y el agente, ni acceso directo del frontend a los servicios internos, datos, Kafka o LLM. Por el alcance observado, corresponde una corrección documental y de empaquetado, sin una migración de código .NET.

## Distribución de responsabilidades

```mermaid
flowchart TB
    WEB["frontend · interfaz, sesión visual y Apollo Client"]
    BFF["bff-graphql · frontera pública, autenticación de la solicitud y adaptación de contratos"]
    USR["ms-usuarios · identidad y preferencias"]
    FIN["ms-transacciones · dominio financiero y cálculos oficiales"]
    NOT["ms-notificaciones · reglas, bandeja y deduplicación"]
    MCP["ms-agente-mcp · herramientas autorizadas de solo lectura"]
    WEB --> BFF
    BFF --> USR
    BFF --> FIN
    BFF --> NOT
    BFF --> MCP
    FIN --- REC["Cuentas, movimientos, ingresos, gastos, transferencias y categorías"]
    FIN --- PLA["Presupuestos, compromisos y flujo de caja"]
    FIN --- ANA["Gastos hormiga, metas, reservas y salud financiera"]
    FIN --- EVT["Reglas financieras, escrituras atómicas y eventos"]
```

Los grupos del contexto financiero se implementarán como módulos internos de NestJS en un solo servicio. Cada microservicio con persistencia tendrá su PostgreSQL y sus credenciales. Los identificadores entre contextos son referencias de contrato. El BFF fija la identidad de la solicitud y la propaga a los servicios autorizados. El agente consulta únicamente por gRPC, limita los datos enviados al proveedor HTTPS y basa sus explicaciones en los indicadores calculados por el propietario.

## Verificación del checkout

| Comprobación | Resultado |
| --- | --- |
| TypeScript y compilación de Vite | Aprobadas. |
| Pruebas unitarias y cobertura | 18 aprobadas. Cobertura de líneas del 93,08 % en los módulos de `src/` cargados por la suite unitaria. |
| Pruebas de navegador | 25 aprobadas en Microsoft Edge. |
| Archivos de CI y documentación | YAML y sintaxis de los comandos verificados localmente. Los enlaces internos y los 16 arcos del diagrama lógico coinciden con el inventario. La ejecución en GitHub Actions queda pendiente. |
| Lint independiente | El proyecto carece de script `lint`. CI utiliza la comprobación estática de TypeScript. |
| Docker/Nginx y Kubernetes | La imagen no pudo construirse localmente porque el daemon Docker no estaba disponible. El contexto de kubectl estaba sin configurar. |
