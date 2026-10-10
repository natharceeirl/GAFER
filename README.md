# GAFER

Sistema de automatización de informes y reportes para GAFER Saneamiento Ambiental E.I.R.L.

## Estructura del proyecto

Monorepo con pnpm workspaces. Backend en monolito modular (hexagonal + screaming architecture), frontend web backoffice (React + Vite, FSD), app móvil de campo (React Native + Expo, FSD, offline-first).

```
gafer/
├── apps/
│   ├── api/          # NestJS — 7 módulos de dominio hexagonal
│   ├── worker/       # NestJS + BullMQ — jobs asíncronos (PDF, fotos, alertas)
│   ├── web/          # React + Vite — Backoffice administrativo en PC (FSD)
│   └── mobile/       # React Native + Expo — App Android de campo offline-first (FSD)
├── packages/
│   └── contracts/    # Tipos y esquemas Zod compartidos entre api, web y mobile
├── infra/            # docker-compose (Postgres 16, Redis 7, MinIO S3)
└── docs/             # Especificaciones y notas de arquitectura (ARQUITECTURA.md)
```

### Módulos de dominio (`apps/api/src`)

Cada uno con tres capas internas: `domain/` (sin framework), `application/` (casos de uso), `infrastructure/` (adapters NestJS).

| Módulo | Fase | Responsabilidad |
|---|---|---|
| `mantenimiento` | 1 | Catálogos editables (insumos, equipos, personal) |
| `cliente-expediente` | 1 | Cliente → Proyecto → Servicio |
| `operaciones` | 1 | Formulario de campo, estados BORRADOR/CERRADO |
| `documentos` | 2 | Informe/Reporte, aprobación, numeración correlativa |
| `mapa-murino` | 3 | Estación + FSM del aura de tendencia (dominio puro) |
| `estadisticas` | 4 | Dashboard y resúmenes de solo lectura |
| `inventario` | 5 | Stock de insumos — módulo agregado en el análisis de arquitectura, no explícito en la especificación v6 |

## Cómo correr el proyecto

### 1. Instalación de Dependencias

```bash
pnpm install
```

### 2. Configuración de Entorno (12-Factor App)

Cada aplicación es **autocontenida y desacoplada**. Para desarrollo local, copia el `.env.example` en el servicio que vayas a ejecutar:

```bash
# Backend API
cp apps/api/.env.example apps/api/.env

# Worker asíncrono
cp apps/worker/.env.example apps/worker/.env

# Frontend Web
cp apps/web/.env.example apps/web/.env

# Mobile de campo
cp apps/mobile/.env.example apps/mobile/.env
```
*(En entornos de producción, contenedores Docker o CI/CD, las variables de entorno se inyectan directamente al proceso desde el sistema operativo o el orquestador, sin rutas relativas ni acoplamiento al sistema de archivos).*

### 3. Levantar Infraestructura Local (Docker)

```bash
# Levantar PostgreSQL 16, Redis 7 y MinIO S3
pnpm infra:up
```
- **PostgreSQL:** `localhost:5432` (usuario: `gafer`, pass: `gafer`, db: `gafer`)
- **Redis:** `localhost:6379`
- **MinIO Console (S3):** `http://localhost:9001` (usuario: `gafer`, pass: `gafersecret`)
- *(Para apagar los contenedores: `pnpm infra:down`)*

### 4. Migraciones de Base de Datos (PostgreSQL 16 + Kysely)

Una vez levantada la infraestructura Docker, ejecuta las migraciones para crear las tablas maestras de la Fase 1:

```bash
# Ejecutar migraciones pendientes (UP)
pnpm db:migrate

# Revertir última migración en caso de necesidad (DOWN)
pnpm db:rollback
```
*Las migraciones SQL residen en `infra/migrations/` (`NNN_nombre.up.sql` / `.down.sql`, todas idempotentes; `db:migrate` las aplica en orden y `db:rollback` las revierte en orden inverso) y los tipos TypeScript para Kysely en `apps/api/src/database/types.ts`.*

### 5. Primer administrador

La API no trae usuarios ni claves en el código: cada persona de `personal` inicia sesión con su `usuario` y la clave que se guarda (solo como hash scrypt con sal) en `personal.clave_hash`. Una fila sin clave no puede iniciar sesión. Tras migrar, crea el primer Administrador:

```bash
GAFER_CLAVE='<clave de al menos 12 caracteres>' pnpm db:crear-usuario \
  --usuario m.quispe --cargo ADMINISTRADOR --dni 45892312 \
  --nombres Maria --apellidos "Quispe Rojas" --telefono 958123456
```

- Cada dato también se puede dar por variable de entorno (`GAFER_USUARIO`, `GAFER_CARGO`, `GAFER_DNI`, `GAFER_NOMBRES`, `GAFER_APELLIDOS`, `GAFER_TELEFONO`).
- La clave **no** se acepta por argumento: usa `GAFER_CLAVE` o, si no la defines y estás en una consola interactiva, el comando la pide sin mostrarla.
- Valida con los esquemas de `@gafer/contracts` (clave de al menos 12 caracteres). Si el usuario ya existe, actualiza sus datos y cambia su clave; sirve también para restablecer una clave olvidada.
- Con ese Administrador se crea el resto del personal desde Mantenimiento; su clave se asigna con este mismo comando.

### 6. Variables obligatorias de la API

`JWT_SECRET` (mínimo 32 caracteres) firma los tokens de sesión y **no tiene valor por defecto**: sin él la API no arranca y lo dice en el log. Para desarrollo local agrega a tu `apps/api/.env` una línea como `JWT_SECRET=solo-desarrollo-local-no-usar-en-produccion-0123456789abcdef` (valor solo de desarrollo: no lo reutilices). En cualquier otro entorno genera uno propio (`openssl rand -base64 48`) e inyéctalo como variable de entorno, sin guardarlo en el repositorio.

Toda ruta de la API exige `Authorization: Bearer <token>` y un rol permitido; solo son públicos `POST /api/auth/login` y la documentación (`/docs`, `/docs-json`).

### Datos de ejemplo (demo y QA)

> **Advertencia:** son datos **ficticios**. GAFER no ha entregado sus datos reales (clientes, sedes, servicios, insumos, equipos ni textos); no los uses como si lo fueran ni los cargues en producción.

`pnpm db:seed:demo` deja una base ya migrada lista para la demo H1 (alta de un cliente con su sede y su servicio, edición de un catálogo) y para que QA entre con cada rol.

```bash
pnpm infra:up          # PostgreSQL, Redis y MinIO
pnpm db:migrate        # el seed necesita las tablas y los catálogos que siembra la migración
# JWT_SECRET (mínimo 32 caracteres) en apps/api/.env o en el entorno, como en la sección anterior
pnpm db:seed:demo      # carga los datos e imprime las claves de los usuarios, UNA sola vez
pnpm dev:api
```

**Qué carga** (todo en una transacción: o se carga todo o nada):

| Entidad | Cantidad | Clave natural (la que usa para no duplicar) |
|---|---|---|
| Clientes de rubros variados | 12 | RUC (con dígito verificador, rango ficticio `2099…`) y código corto `DEMO…` |
| Sedes | 23 (1 a 3 por cliente) | cliente + nombre de la sede |
| Servicios contratados | 56 (1 a 3 por sede) | sede + tipo; cubren los 7 tipos, varias frecuencias y algunos con certificado |
| Insumos | 12 | `registroDigesa` con prefijo `DEMO-` (nombres comerciales ficticios, principios activos genéricos) |
| Equipos | 11 | `codigoInterno` con prefijo `EQ-DEMO-` |
| Personal con usuario | 5: `demo.admin`, `demo.supervisor`, `demo.tecnico1` a `demo.tecnico3` | DNI ficticio (`99…`) y usuario |
| Textos de catálogo | 56, agregados a los que ya siembra la migración | el propio texto |

Los datos viven en `apps/api/src/database/seed/datos-demo.ts` (fuente de verdad del seed y de la limpieza) y se validan con los esquemas de `@gafer/contracts` antes de escribir. El Director Técnico de ejemplo es el que ya siembra la migración; el seed solo lo completa si la fila estuviera vacía.

**Claves:** no hay ninguna en el repositorio. Cada usuario nuevo recibe una clave al azar (32 caracteres), guardada solo como hash scrypt, y la tabla usuario/cargo/clave se imprime **una vez** en la consola (no se escribe en archivos). Si pierdes la tabla, usa `--regenerar-claves`. El `TECNICO_OPERADOR` solo puede iniciar sesión desde la app móvil (cliente `mobile`); la web lo rechaza (decisión C10).

**Idempotente:** volver a correrlo no duplica nada; informa "sin cambios" por entidad y no toca lo que ya existe ni las claves vigentes.

| Comando | Efecto |
|---|---|
| `pnpm db:seed:demo` | Carga los datos que falten |
| `pnpm db:seed:demo --regenerar-claves` | Además, genera claves nuevas para los usuarios de ejemplo que ya existen |
| `pnpm db:seed:demo --limpiar` | Elimina **solo** las filas del conjunto de datos (servicios, sedes, clientes, insumos, equipos, personal y sus textos). Sirve para cuando lleguen los datos reales |
| `pnpm db:seed:demo --confirmar-destino-remoto` | Obligatorio si `DATABASE_URL` no apunta a `localhost` ni `127.0.0.1` |

**Seguridad:** se niega a correr con `NODE_ENV=production` y sin `DATABASE_URL`; antes de escribir imprime el destino (host, puerto y base, sin credenciales). La limpieza nunca borra en cascada: si una fila de ejemplo ya tiene inspecciones, visitas o documentos, o el usuario la modificó o le agregó otras filas, la conserva y lo avisa. Una fila ajena con la misma clave natural (por ejemplo, otro cliente con el mismo RUC) hace fallar la carga sin escribir nada. Los textos que tú agregaste a un catálogo no se tocan.

### 5. Iniciar Servicios en Desarrollo

Abre terminales separadas para los servicios que vayas a ejecutar:

```bash
# Backend API (NestJS — corre en http://localhost:3000/api)
pnpm dev:api

# Worker asíncrono (NestJS + BullMQ — procesa jobs en segundo plano)
pnpm dev:worker

# Frontend Web (React + Vite Backoffice — abre en http://localhost:5173)
pnpm dev:web

# Mobile de campo (React Native + Expo SDK 57 — abre servidor Metro)
pnpm dev:mobile
```

- **Documentación Interactiva (Scalar):** `http://localhost:3000/docs`
- **Especificación OpenAPI (JSON):** `http://localhost:3000/docs-json`

### 6. Tests y Compilación

```bash
# Compilar todo el monorepo respetando dependencias
pnpm build

# Ejecutar la suite completa de 84 tests automatizados
pnpm test
```

La persistencia de la Fase 1 (Mantenimiento y Operaciones) utiliza adaptadores de PostgreSQL 16 con Kysely (`Kysely*Repository`), asegurando la regla de inmutabilidad contractual de la Sección 13 (`snapshot_catalogos`). Las fases subsiguientes cuentan con scaffolds desacoplados listos para su desarrollo en sus respectivos ciclos de SDD.
