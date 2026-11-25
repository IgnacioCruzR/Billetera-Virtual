# Topología oficial

La aplicación React se descarga desde Nginx. El cliente Apollo en el navegador usa el BFF como única entrada a datos del sistema. Las flechas describen orígenes y destinos de las solicitudes o entregas, con sus respuestas implícitas. Este documento describe el diseño objetivo. La [matriz de cumplimiento](#matriz-de-cumplimiento) registra qué se observó en el workspace.

## Topología lógica

```mermaid
flowchart LR
    WEB["frontend · React y Apollo Client"] -->|"GraphQL /graphql"| BFF["bff-graphql"]
    BFF -->|gRPC| USR["ms-usuarios"]
    BFF -->|gRPC| FIN["ms-transacciones"]
    BFF -->|gRPC| NOT["ms-notificaciones"]
    BFF -->|gRPC| MCP["ms-agente-mcp"]
    FIN -->|gRPC| USR
    MCP -->|"herramientas · gRPC"| USR
    MCP -->|"herramientas · gRPC"| FIN
    MCP -->|HTTPS| LLM["LLM externo"]
    USR -->|publica| K["Kafka"]
    FIN -->|publica| K
    K -->|entrega| FIN
    K -->|entrega| NOT
    USR --> UDB[("postgres-usuarios")]
    FIN --> FDB[("postgres-transacciones")]
    NOT --> NDB[("postgres-notificaciones")]
```

## Comunicación síncrona

```mermaid
sequenceDiagram
    participant FE as frontend · navegador
    participant BFF as bff-graphql
    participant U as ms-usuarios
    participant T as ms-transacciones
    participant N as ms-notificaciones
    participant A as ms-agente-mcp
    participant L as LLM externo
    alt Identidad o preferencias
        FE->>BFF: GraphQL
        BFF->>U: gRPC
        U-->>BFF: Respuesta
    else Operación financiera
        FE->>BFF: GraphQL
        BFF->>T: gRPC con identidad
        opt La operación requiere datos de identidad o preferencias
            T->>U: gRPC
            U-->>T: Datos autorizados
        end
        T-->>BFF: Resultado financiero
    else Bandeja de notificaciones
        FE->>BFF: GraphQL
        BFF->>N: gRPC con identidad
        N-->>BFF: Avisos o estado de lectura
    else Asistencia
        FE->>BFF: GraphQL
        BFF->>A: gRPC con identidad
        opt Herramientas necesarias
            A->>U: gRPC, datos autorizados
            U-->>A: Identidad o preferencias
            A->>T: gRPC, consultas de solo lectura
            T-->>A: Indicadores calculados
        end
        A->>L: HTTPS, contexto mínimo
        L-->>A: Respuesta
        A-->>BFF: Interpretación con período y cobertura
    end
    BFF-->>FE: Respuesta GraphQL
```

El BFF actúa como servidor GraphQL y cliente gRPC. El agente implementa gRPC para la comunicación con el BFF y usa el SDK MCP para sus herramientas. La identidad del usuario proviene del contexto autenticado del servidor. Los contratos de errores, tiempos máximos e idempotencia deberán acordarse en la implementación.

## Comunicación asíncrona

```mermaid
flowchart LR
    U["ms-usuarios"] -->|"publicación"| UTOP["Kafka · hechos de usuarios"]
    T["ms-transacciones"] -->|"publicación"| FTOP["Kafka · hechos financieros"]
    UTOP -->|"consumo"| T
    UTOP -->|"consumo"| N["ms-notificaciones"]
    FTOP -->|"consumo"| N
```

La topología permite que Transacciones consuma eventos de usuarios. La asignación por tópico, filtrado, versionado y recuperación quedan documentados en el [catálogo de eventos](DOMAIN_EVENTS.md). Para RN-11, la vigencia financiera se obtiene de observaciones producidas por el dueño de los datos y entregadas por Kafka. El contrato de observación y su frescura aún requieren una decisión de diseño. [Decisiones de arquitectura](ARCHITECTURE_DECISIONS.md#adr-04-eventos-y-evaluación-de-alertas)

## Despliegue objetivo en Kubernetes

```mermaid
flowchart LR
    B["Navegador"] -->|HTTPS| ING
    subgraph NS["Namespace billetera"]
        ING["Ingress"]
        WEB["frontend · Service ClusterIP + Deployment Nginx"]
        BFF["bff-graphql · Service ClusterIP + Deployment"]
        U["ms-usuarios · Service ClusterIP + Deployment"]
        T["ms-transacciones · Service ClusterIP + Deployment"]
        N["ms-notificaciones · Service ClusterIP + Deployment"]
        A["ms-agente-mcp · Service ClusterIP + Deployment"]
        ING -->|"Prefix /"| WEB
        ING -->|"Exact /graphql"| BFF
        BFF -->|gRPC| U
        BFF -->|gRPC| T
        BFF -->|gRPC| N
        BFF -->|gRPC| A
        T -->|gRPC| U
        A -->|gRPC| U
        A -->|gRPC| T
        U --> P1[("postgres-usuarios · StatefulSet + PVC")]
        T --> P2[("postgres-transacciones · StatefulSet + PVC")]
        N --> P3[("postgres-notificaciones · StatefulSet + PVC")]
        U --> K[("Kafka · StatefulSet + PVC")]
        T --> K
        K --> T
        K --> N
        CM["ConfigMaps · configuración no sensible"]
        SEC["Secrets · credenciales y clave LLM"]
        CM -.-> BFF
        SEC -.-> A
        SEC -.-> U
        SEC -.-> T
        SEC -.-> N
    end
    A -->|HTTPS| L["LLM externo"]
```

| Recurso | Diseño previsto |
| --- | --- |
| Namespace | `billetera` contiene los componentes de la aplicación y sus recursos internos. |
| `frontend` | Deployment de Nginx con artefactos estáticos y Service ClusterIP. La imagen propuesta escucha en 8080 y expone `/healthz`. |
| `bff-graphql` | Deployment y Service ClusterIP HTTP para GraphQL. Los destinos internos se resuelven por Service de Kubernetes. |
| Cuatro servicios internos | Un Deployment y un Service ClusterIP por servicio con gRPC. Los Services se alcanzan dentro del clúster. |
| PostgreSQL | Tres StatefulSets independientes con PVC y Services internos para sus dueños. Credenciales separadas y referencias externas por identificador. |
| Kafka | StatefulSet, almacenamiento persistente por broker mediante PVC y Service interno. La cantidad de réplicas y la política de operación quedan por definir. |
| Ingress | TLS en un mismo host. `/graphql` de tipo `Exact` al BFF y `/` de tipo `Prefix` a Nginx. Se conserva la ruta recibida por el BFF. |
| ConfigMaps | Configuración no sensible, como direcciones internas, puertos, nivel de logs y nombres de tópicos acordados. |
| Secrets | Credenciales de cada PostgreSQL y clave del proveedor LLM entregadas al workload correspondiente por el mecanismo del entorno. Los valores reales se administran fuera de Git. |

Los puertos internos de los servicios, las imágenes, el controlador Ingress, el almacenamiento, los probes de backend y las políticas de red se definen cuando exista un entorno de despliegue. El diagrama describe recursos futuros. [Ingress en Kubernetes](https://kubernetes.io/docs/concepts/services-networking/ingress/) · [StatefulSets y almacenamiento](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)

El entorno local define los puertos de desarrollo y redes aisladas de PostgreSQL y Kafka. Publica únicamente Nginx por loopback. Los cinco esqueletos están preparados para configurar las conexiones aprobadas en esta topología. [Compose, puertos y redes locales](LOCAL_DEVELOPMENT.md#puertos-y-redes)

## Matriz de cumplimiento

| Origen | Destino | Protocolo o sentido | Estado observado |
| --- | --- | --- | --- |
| `frontend` | `bff-graphql` | GraphQL | Apollo Client preparado en modo de integración con `/graphql`. Esquema, sesión y operaciones remotas pendientes. La demo usa memoria. |
| `bff-graphql` | `ms-usuarios` | gRPC | Diseño. Implementación y contrato pendientes. |
| `bff-graphql` | `ms-transacciones` | gRPC | Diseño. Implementación y contrato pendientes. |
| `bff-graphql` | `ms-notificaciones` | gRPC | Diseño. Implementación y contrato pendientes. |
| `bff-graphql` | `ms-agente-mcp` | gRPC | Diseño. Implementación y contrato pendientes. |
| `ms-transacciones` | `ms-usuarios` | gRPC | Diseño. Implementación y contrato pendientes. |
| `ms-agente-mcp` | `ms-usuarios` | Herramientas mediante gRPC | Diseño. Implementación y autorización pendientes. |
| `ms-agente-mcp` | `ms-transacciones` | Herramientas mediante gRPC | Diseño. Implementación y autorización pendientes. |
| `ms-agente-mcp` | LLM externo | HTTPS | Diseño. Proveedor e integración pendientes. |
| `ms-usuarios` | Kafka | Publicación | Diseño y catálogo. Productor pendiente. |
| `ms-transacciones` | Kafka | Publicación | Diseño y catálogo. Productor pendiente. |
| Kafka | `ms-transacciones` | Consumo | Diseño. Consumidor y suscripciones pendientes. |
| Kafka | `ms-notificaciones` | Consumo | Diseño y catálogo. Consumidor pendiente. |
| Usuarios, Transacciones y Notificaciones | PostgreSQL de cada propietario | Acceso local del servicio | Instancias separadas en Compose. Conexión de los servicios y migraciones pendientes. |
| Navegador | Servicios internos, Kafka, bases y LLM | Acceso directo fuera de la topología | Sin conexiones observadas. Aislamiento de red del despliegue pendiente. |
| `ms-notificaciones` | Servicios de dominio | Llamadas directas fuera de la topología | Diagrama corregido. Las observaciones de vigencia quedan pendientes por Kafka. |
| Ingress | Frontend y BFF | HTTP interno mediante Services | Rutas documentadas. Ingress y clúster pendientes. |
