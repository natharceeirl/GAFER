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

### 4. Iniciar Servicios en Desarrollo

Abre terminales separadas para los servicios que vayas a ejecutar:

```bash
# Backend API (NestJS — corre en http://localhost:3000)
pnpm dev:api

# Worker asíncrono (NestJS + BullMQ — procesa jobs en segundo plano)
pnpm dev:worker

# Frontend Web (React + Vite Backoffice — abre en http://localhost:5173)
pnpm dev:web

# Mobile de campo (React Native + Expo SDK 57 — abre servidor Metro)
pnpm dev:mobile
```

### 5. Tests y Compilación

```bash
# Compilar todo el monorepo respetando dependencias
pnpm build

# Ejecutar la suite completa de 41 tests unitarios
pnpm test
```

Los repositorios de `infrastructure/` en cada módulo son adapters en memoria (`*.repository.memory.ts`), marcados con `TODO` — se reemplazan por adapters Postgres antes de producción, sin tocar `domain/` ni `application/`.
