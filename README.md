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

### 1. Instalación y Variables de Entorno

```bash
# 1. Instalar dependencias de todo el monorepo
pnpm install

# 2. Crear archivo de variables de entorno desde la plantilla
cp .env.example .env
```
*(Tanto la Web como el Backend y el Worker leen este `.env` central automáticamente en desarrollo).*

### 2. Levantar Infraestructura Local (Docker)

```bash
# Levantar PostgreSQL 16, Redis 7 y MinIO S3
pnpm infra:up
```
- **PostgreSQL:** `localhost:5432` (usuario: `gafer`, pass: `gafer`, db: `gafer`)
- **Redis:** `localhost:6379`
- **MinIO Console (S3):** `http://localhost:9001` (usuario: `gafer`, pass: `gafersecret`)
- *(Para apagar los contenedores: `pnpm infra:down`)*

### 3. Iniciar Servicios en Desarrollo

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

### 4. Tests y Compilación

```bash
# Compilar todo el monorepo respetando dependencias
pnpm build

# Ejecutar la suite completa de 41 tests unitarios
pnpm test
```

Los repositorios de `infrastructure/` en cada módulo son adapters en memoria (`*.repository.memory.ts`), marcados con `TODO` — se reemplazan por adapters Postgres antes de producción, sin tocar `domain/` ni `application/`.
