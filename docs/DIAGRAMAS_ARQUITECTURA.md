# Catálogo Oficial de Diagramas de Arquitectura — GAFER v1
**Proyecto:** Sistema de Gestión de Operaciones de Campo y Certificación Ambiental  
**Curso:** Prácticas Preprofesionales (Fase 1 / Hito 1)  
**Fuente de verdad técnica:** Monorepo GAFER (`apps/api`, `apps/web`, `apps/mobile`, `packages/contracts`)  

> [!NOTE]  
> **Modelo Entidad-Relación (DER) de Base de Datos:**  
> El modelo físico y relacional de PostgreSQL 16 (tablas, claves foráneas `ON DELETE RESTRICT`, tipos enum y triggers de inmutabilidad) se gestiona de manera centralizada en [dbdiagram.io](https://dbdiagram.io) y se versiona en las migraciones SQL del repositorio (`infra/migrations/001_initial_schema.up.sql` y `002_personal_clave_hash.up.sql`). No se duplica en este catálogo para evitar desincronizaciones de esquema.

---

## Índice de Diagramas
1. [Diagrama 1: Arquitectura General del Sistema (Nivel 0 — Visión Macro)](#diagrama-1-arquitectura-general-del-sistema-nivel-0)
2. [Diagrama 2: Backend — Arquitectura Hexagonal y Puertos/Adaptadores (Nivel 1)](#diagrama-2-backend--arquitectura-hexagonal-y-puertosadaptadores-nivel-1)
3. [Diagrama 3: Frontend Web — Arquitectura de Capas y Flujo de Datos](#diagrama-3-frontend-web--arquitectura-de-capas-y-flujo-de-datos)
4. [Diagrama 4: Flujo de Sincronización Offline y Resiliencia de Campo](#diagrama-4-flujo-de-sincronización-offline-y-resiliencia-de-campo)
5. [Diagrama 5: Flujo de Seguridad y Autorización (Deny-by-Default)](#diagrama-5-flujo-de-seguridad-y-autorización-deny-by-default)

---

## Diagrama 1: Arquitectura General del Sistema (Nivel 0)

### Propósito
Proporcionar una vista ejecutiva de alto nivel que responda rápidamente: *¿cuáles son las grandes partes del sistema y cómo se comunican?* Ideal para el informe ejecutivo, la portada de entregables y la introducción ante el Product Owner (PO).

```mermaid
flowchart TB
    %% ============================================================
    %% 1. CLIENTES EXTERNOS
    %% ============================================================
    subgraph CLIENTS ["1. Clientes y Entradas Externas"]
        WEB["Web App (Backoffice Administrativo)\nReact 18 + Vite"]
        MOBILE["Mobile App (Operaciones en Campo)\nReact Native + Offline Outbox"]
        CLI["Admin CLI (Herramienta de Bootstrap)\npnpm db:crear-usuario"]
    end

    %% ============================================================
    %% CONTRATOS COMPARTIDOS
    %% ============================================================
    subgraph CONTRACTS_PKG ["Single Source of Truth"]
        CONTRACTS["@gafer/contracts\nContratos compartidos (Zod + DTOs)"]
    end

    %% ============================================================
    %% 2. API / ADAPTADORES DE ENTRADA
    %% ============================================================
    subgraph API ["2. API / Adaptadores de Entrada"]
        SECURITY["Seguridad y Control de Acceso\nAPP_GUARD (AuthGuard + RolesGuard)"]
        REST["API REST (NestJS Core)\nControladores y Filtros de Excepción"]
    end

    %% ============================================================
    %% 3. CAPA DE APLICACIÓN
    %% ============================================================
    subgraph APPLICATION ["3. Capa de Aplicación"]
        USE_CASES["Casos de Uso de Negocio\n• Autenticación y Credenciales\n• Catálogos Maestros de Saneamiento\n• Configuración y Gobernanza\n• Operaciones e Inmutabilidad de Campo"]
    end

    %% ============================================================
    %% 4. NÚCLEO DE DOMINIO
    %% ============================================================
    subgraph DOMAIN ["4. Núcleo de Dominio"]
        BUSINESS["Entidades y Reglas de Dominio Puro\n(Sin dependencias de frameworks)"]
        PORTS["Puertos de Salida (Interfaces TypeScript)\nRepositorios · Storage · Auditoría"]
    end

    %% ============================================================
    %% 5. ADAPTADORES DE SALIDA
    %% ============================================================
    subgraph ADAPTERS ["5. Adaptadores de Salida"]
        DB_ADAPTER["Persistencia Relacional\nAdaptadores Kysely"]
        STORAGE_ADAPTER["Object Storage\nAdaptador MinIO / S3 SDK"]
    end

    %% ============================================================
    %% 6. RECURSOS EXTERNOS
    %% ============================================================
    subgraph INFRA ["6. Recursos de Persistencia"]
        DB[("PostgreSQL 16\nMotor Relacional")]
        STORAGE[("MinIO S3 / Cloudflare R2\nAlmacenamiento de Archivos")]
    end

    %% ============================================================
    %% RELACIONES
    %% ============================================================
    WEB -->|HTTPS REST + Bearer Token| SECURITY
    MOBILE -->|HTTPS REST + Bearer Token| SECURITY
    CLI -.->|Bootstrap Inicial (Admin)| DB

    SECURITY -->|Autoriza acceso| REST
    REST -->|Invoca| USE_CASES

    USE_CASES -->|Aplica reglas sobre| BUSINESS
    USE_CASES -->|Invoca| PORTS

    DB_ADAPTER -.->|implementa| PORTS
    STORAGE_ADAPTER -.->|implementa| PORTS

    DB_ADAPTER -->|SQL Type-Safe| DB
    STORAGE_ADAPTER -->|S3 Protocol| STORAGE

    CONTRACTS -.->|contratos compartidos| WEB
    CONTRACTS -.->|contratos compartidos| MOBILE
    CONTRACTS -.->|contratos compartidos| REST
```

---

## Diagrama 2: Backend — Arquitectura Hexagonal y Puertos/Adaptadores (Nivel 1)

### Propósito
Detallar la estructura interna del backend (`apps/api`). Demuestra la aplicación estricta del principio de Inversión de Dependencias (DIP), la separación de capas limpias y la organización de los 4 pilares de casos de uso y puertos del Hito 1.

```mermaid
flowchart TB
    %% =============================================================
    %% PAQUETE COMPARTIDO TRANSVERSAL
    %% =============================================================
    subgraph SHARED ["Paquete Compartido (Single Source of Truth)"]
        CONTRACTS["@gafer/contracts\n• Esquemas Zod & DTOs de Transporte\n• Tipos de Autenticación y Roles"]
    end

    %% =============================================================
    %% 1. CLIENTES Y ACTORES
    %% =============================================================
    subgraph CLIENTES ["1. Clientes y Adaptadores Externos"]
        WEB["Frontend Web (React 18 / Vite)\nBackoffice Administrativo"]
        MOB["App Móvil Android (React Native)\nOperaciones en Campo (Outbox Offline)"]
        CLI["CLI de Administración (Node.js)\npnpm db:crear-usuario"]
    end

    %% =============================================================
    %% 2. INFRAESTRUCTURA DE ENTRADA (DRIVING ADAPTERS)
    %% =============================================================
    subgraph INFRA_IN ["2. Adaptadores de Entrada (NestJS HTTP)"]
        direction TB
        subgraph CROSS_CUTTING ["Componentes Transversales"]
            AUTH_GUARD["APP_GUARD Global (Deny-by-Default)\nAuthGuard (JWT) + RolesGuard"]
            FILTER["DomainExceptionFilter (HTTP 400 / 404 / 409)"]
        end

        DOCS["Documentación OpenAPI / Scalar (/docs)"]

        subgraph CONTROLLERS ["Controladores REST"]
            C_AUTH["AuthController (/api/auth)"]
            C_MANT["MantenimientoController (/api/mantenimiento)"]
            C_OPER["OperacionesController (/api/operaciones)"]
        end
    end

    %% =============================================================
    %% 3. CAPA DE APLICACIÓN (CASOS DE USO)
    %% =============================================================
    subgraph APP ["3. Capa de Aplicación (Casos de Uso)"]
        direction TB
        UC_AUTH["Casos de Uso de Autenticación\n(Login, scrypt + salt)"]
        UC_MAESTROS["Casos de Uso de Catálogos Maestros\n(Clientes, Sedes, Insumos, Equipos, Personal)"]
        UC_CONF["Casos de Uso de Configuración\n(Catálogos de Texto, Parámetros, Auditoría)"]
        UC_OPS["Casos de Uso de Operaciones\n(Sincronización, Congelamiento de Snapshot)"]
    end

    %% =============================================================
    %% 4. NÚCLEO DE DOMINIO (DOMAIN CORE)
    %% =============================================================
    subgraph DOMAIN ["4. Núcleo de Dominio (Domain Core)"]
        direction TB
        subgraph ENTITIES ["Entidades y Reglas de Negocio"]
            E_MAESTRAS["Entidades Maestras:\nCliente, Proyecto, Insumo, Equipo, Personal"]
            E_SISTEMA["Entidades de Configuración:\nCatalogoTexto, ConfiguracionSistema"]
            E_INSP["Entidad Inspección:\nInvariante de Inmutabilidad de Acta Cerrada"]
        end

        subgraph PORTS ["Puertos de Salida (Interfaces)"]
            P_MAESTROS["«interface» Repositorios Maestros\n(ClienteRepo, InsumoRepo, EquipoRepo, PersonalRepo)"]
            P_CONF["«interface» Repositorios de Sistema\n(ConfiguracionRepo, AuditoriaRepo)"]
            P_SEC["«interface» UsuarioRepository"]
            P_INSP["«interface» InspeccionRepository"]
            P_STORAGE["«interface» StoragePort (Archivos)"]
        end
    end

    %% =============================================================
    %% 5. INFRAESTRUCTURA DE SALIDA (DRIVEN ADAPTERS)
    %% =============================================================
    subgraph INFRA_OUT ["5. Adaptadores de Salida (Driven Adapters)"]
        direction TB
        ADAPT_MAESTROS["Adaptadores Kysely Maestros\n(Pool de Conexiones PostgreSQL)"]
        ADAPT_CONF["Adaptadores Kysely de Sistema"]
        ADAPT_SEC["KyselyUsuarioRepository"]
        ADAPT_INSP["KyselyInspeccionRepo"]
        ADAPT_STORAGE["MinioS3StorageAdapter\n(Cliente S3 SDK / URLs Prefirmadas)"]
    end

    %% =============================================================
    %% 6. PERSISTENCIA FÍSICA
    %% =============================================================
    subgraph STORAGE ["6. Persistencia Física y Recursos"]
        PG[("PostgreSQL 16\n• Tablas Relacionales (FK Restrictivas)\n• Snapshots JSONB\n• Triggers de Motor para Inmutabilidad")]
        S3[("Object Storage (MinIO / S3)\n• Bucket: Fichas Técnicas, MSDS y Fotos")]
    end

    %% =============================================================
    %% RELACIONES Y FLUJO DE DATOS
    %% =============================================================
    CONTRACTS -.->|contratos compartidos| WEB
    CONTRACTS -.->|contratos compartidos| MOB
    CONTRACTS -.->|contratos compartidos| CONTROLLERS

    WEB -->|HTTP REST + Bearer Token| AUTH_GUARD
    MOB -->|HTTP REST + Bearer Token| AUTH_GUARD
    CLI -.->|Bootstrap Inicial (Admin)| PG

    AUTH_GUARD -->|autoriza acceso a| CONTROLLERS
    DOCS -.->|documenta endpoints de| CONTROLLERS

    C_AUTH --> UC_AUTH
    C_MANT --> UC_MAESTROS
    C_MANT --> UC_CONF
    C_OPER --> UC_OPS

    UC_AUTH --> P_SEC
    UC_MAESTROS --> P_MAESTROS
    UC_MAESTROS -->|aplica reglas de| E_MAESTRAS
    UC_CONF --> P_CONF
    UC_CONF -->|aplica reglas de| E_SISTEMA
    UC_OPS --> P_INSP
    UC_OPS --> P_STORAGE
    UC_OPS -->|aplica reglas de| E_INSP

    ADAPT_MAESTROS -.->|implementa| P_MAESTROS
    ADAPT_CONF -.->|implementa| P_CONF
    ADAPT_SEC -.->|implementa| P_SEC
    ADAPT_INSP -.->|implementa| P_INSP
    ADAPT_STORAGE -.->|implementa| P_STORAGE

    ADAPT_MAESTROS --> PG
    ADAPT_CONF --> PG
    ADAPT_SEC --> PG
    ADAPT_INSP --> PG
    ADAPT_STORAGE --> S3
```

---

## Diagrama 3: Frontend Web — Arquitectura de Capas y Flujo de Datos

### Propósito
Ilustrar la arquitectura de la aplicación web administrativa (`apps/web`), basada en React 18, Vite y TanStack Query. Refleja cómo la interfaz consume la API mediante un cliente HTTP compartido gobernado por `@gafer/contracts`.

```mermaid
flowchart TD
    subgraph UI_LAYER ["1. Capa de Presentación (UI & Vistas)"]
        direction TB
        ROUTER["React Router DOM\n(Rutas Protegidas por Rol)"]
        subgraph PAGES ["Páginas / Vistas Principales"]
            P_LOGIN["LoginPage\n(Inicio de Sesión)"]
            P_CLIENTES["ClientesListPage & NuevoClientePage\n(Gestión de Expedientes)"]
            P_OPERACIONES["OperacionesPage\n(Supervisión de Servicios)"]
        end
        subgraph ATOMS ["Componentes Compartidos (Design System)"]
            COMP_UI["Botones · Formularios · Modales · Tablas · Badges"]
        end
    end

    subgraph STATE_LAYER ["2. Capa de Estado y Caché Remoto"]
        QUERY_CLIENT["TanStack Query (React Query Client)\n• Caché en Memoria\n• Revalidación Automática\n• Estados Loading / Error / Empty"]
        CUSTOM_HOOKS["Custom Hooks:\n• useClientes (Listado & Detalle)\n• useLogin & useSesion\n• useOperaciones"]
    end

    subgraph API_LAYER ["3. Capa de Comunicación HTTP"]
        HTTP_CLIENT["HTTP Client Compartido (Fetch API / Axios Wrapper)\n• Interceptor Bearer Token (JWT)\n• Parseo Automático de Respuestas (204 No Content Seguro)\n• Manejador Unificado de Errores (401, 403, 409)"]
        SESSION_STORE["Gestor de Sesión (SessionStorage / LocalStorage)\n• Token JWT\n• Perfil de Usuario y Rol Activo"]
    end

    subgraph CONTRACTS_REF ["4. Contratos Tipados"]
        ZOD_CLIENT["@gafer/contracts\n• Validación de Formularios Zod\n• DTOs Tipados de Respuesta API"]
    end

    %% Relaciones
    ROUTER --> PAGES
    PAGES --> COMP_UI
    PAGES --> CUSTOM_HOOKS
    CUSTOM_HOOKS --> QUERY_CLIENT
    CUSTOM_HOOKS --> HTTP_CLIENT
    HTTP_CLIENT <--> SESSION_STORE
    ZOD_CLIENT -.->|valida en| CUSTOM_HOOKS
    ZOD_CLIENT -.->|valida formularios en| PAGES
    HTTP_CLIENT -->|Peticiones HTTP REST| API_REMOTE["NestJS API Core (Backend)"]
```

---

## Diagrama 4: Flujo Previsto de Sincronización Offline (Diseño Preparado para Hito 2)

### Propósito
Diagrama de secuencia que describe el flujo arquitectónico diseñado y preparado en el backend para la sincronización de la app móvil en campo (Fase 1 / Hito 2). Ilustra cómo se registran actas sin señal utilizando el patrón Outbox local, y cómo la arquitectura hexagonal del backend orquesta el guardado respetando la inmutabilidad (Sección 13), la inversión de dependencias y el almacenamiento de evidencias.

```mermaid
sequenceDiagram
    autonumber
    actor Tecnico as Técnico de Campo
    participant Mobile as App Móvil (React Native)
    participant SQLite as SQLite Local (Outbox)
    participant API as Backend API (NestJS)
    participant UC as SincronizarInspeccionUseCase
    participant Dominio as Entidad Inspección (Sec. 13)
    participant Repo as «port» InspeccionRepository
    participant Adapter as KyselyInspeccionRepo
    participant DB as PostgreSQL 16
    participant S3 as MinIO / S3 Storage

    Note over Tecnico, SQLite: ESCENARIO 1: Registro en campo sin conectividad (Offline)
    Tecnico->>Mobile: Llena formulario de servicio, consumo de insumos y firma
    Mobile->>Mobile: Genera operation_id = UUIDv4() (Idempotencia)
    Mobile->>SQLite: Guarda acta con estado 'PENDIENTE_SINCRONIZACION'
    SQLite-->>Mobile: Confirmación de guardado local seguro
    Mobile-->>Tecnico: Muestra "Inspección guardada localmente"

    Note over Mobile, DB: ESCENARIO 2: Reconexión a Internet y Sincronización Outbox
    Mobile->>Mobile: Detector de red: Conexión recuperada (Online)
    Mobile->>SQLite: Consulta registros en cola 'PENDIENTE_SINCRONIZACION'
    SQLite-->>Mobile: Retorna lote de operaciones pendientes

    opt Subida de Fotografías / Evidencias (URLs Prefirmadas S3)
        Mobile->>API: GET /api/mantenimiento/documentos/upload-url (solicita presigned URL)
        API->>S3: Genera presigned PUT URL temporal
        API-->>Mobile: Retorna uploadUrl y objectKey
        Mobile->>S3: PUT fotos comprimidas directamente al storage
        S3-->>Mobile: 200 OK (Evidencia subida)
    end

    Mobile->>API: POST /api/operaciones/inspecciones/sincronizar (Bearer JWT + Lote)
    activate API
    API->>API: AuthGuard valida token Bearer
    API->>API: Valida esquema de lote con @gafer/contracts

    API->>UC: ejecutar(datosLote)
    activate UC

    alt Inspección o Acta ya fue cerrada previamente (Conflicto / Concurrencia)
        UC-->>API: DomainException (409 Conflict - Invariante violado)
        API-->>Mobile: HTTP 409 Conflict (Operación rechazada)
        Mobile->>SQLite: Marca registro como 'CONFLICTO_REVISION'
    else Cierre Exitoso con Congelamiento de Datos
        UC->>Dominio: cerrarConSnapshot(insumos, equipos, catalogoActual)
        activate Dominio
        Dominio->>Dominio: Construye Snapshot inmutable
        Dominio-->>UC: Entidad Inspección Cerrada
        deactivate Dominio

        UC->>Repo: guardar(inspeccionCerrada)
        activate Repo
        Repo->>Adapter: persistirSnapshot(inspeccionCerrada)
        activate Adapter
        Adapter->>DB: INSERT INTO inspecciones (snapshot_jsonb, estado='CERRADO')
        DB->>DB: Trigger trg_proteger_snapshot_inspeccion activo
        DB-->>Adapter: Confirmación de persistencia inmutable
        Adapter-->>Repo: OK
        deactivate Adapter
        Repo-->>UC: OK
        deactivate Repo

        UC-->>API: Resultado: Inspección sincronizada
        deactivate UC
        API-->>Mobile: HTTP 200 OK { sincronizados: [operation_id] }
        deactivate API

        Mobile->>SQLite: UPDATE outbox SET estado = 'SINCRONIZADO'
        Mobile-->>Tecnico: Notificación: "Servicio sincronizado con éxito"
    end
```

---

## Diagrama 5: Flujo de Seguridad y Autorización (Deny-by-Default)

### Propósito
Mostrar el flujo de ejecución de la seguridad global introducida en el PR #16 (GAF-93), explicando cómo toda ruta de la API está cerrada por defecto y requiere token y rol explícito para ejecutarse.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Cliente (Web / Mobile / Postman)
    participant GuardAuth as AuthGuard (APP_GUARD Global)
    participant GuardRoles as RolesGuard (APP_GUARD Global)
    participant Reflector as NestJS Reflector
    participant Controller as Controlador REST (Mantenimiento / Operaciones)
    participant UseCase as Caso de Uso de Aplicación

    Cliente->>GuardAuth: Petición HTTP (ej. GET /api/mantenimiento/insumos)
    activate GuardAuth

    GuardAuth->>Reflector: ¿Ruta decorada con @Public()?
    alt Es ruta pública (ej. /api/auth/login o /docs)
        Reflector-->>GuardAuth: true
        GuardAuth-->>Controller: Pasa directo sin token
    else Ruta requiere autenticación (Deny-by-Default)
        Reflector-->>GuardAuth: false
        GuardAuth->>GuardAuth: Extrae y verifica 'Authorization: Bearer <token>'
        alt Token ausente o firma JWT inválida / expirada
            GuardAuth-->>Cliente: HTTP 401 Unauthorized
        else Token JWT válido
            GuardAuth->>GuardAuth: Adjunta request.user = { id, usuario, cargo }
            GuardAuth->>GuardRoles: Pasa al siguiente Guard
            deactivate GuardAuth
            activate GuardRoles

            GuardRoles->>Reflector: Consulta roles requeridos con @Roles(...)
            alt Controlador/Ruta no tiene @Roles(...) o rol del usuario no coincide
                Reflector-->>GuardRoles: Rol no admitido (o ruta sin roles asignados)
                GuardRoles-->>Cliente: HTTP 403 Forbidden (Acceso denegado)
            else Rol del usuario coincide (ej. ADMINISTRADOR)
                Reflector-->>GuardRoles: Rol autorizado
                GuardRoles->>Controller: Pasa al Controlador REST
                deactivate GuardRoles
                activate Controller

                Controller->>UseCase: Invoca Caso de Uso correspondiente
                activate UseCase
                UseCase-->>Controller: Retorna DTO de respuesta
                deactivate UseCase
                Controller-->>Cliente: HTTP 200 / 201 OK con payload tipado
                deactivate Controller
            end
        end
    end
```
