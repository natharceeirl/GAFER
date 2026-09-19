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

```bash
pnpm install

# Levantar Postgres local (opcional en esta etapa de scaffolding)
docker compose -f infra/docker-compose.yml up -d

# Backend
pnpm --filter @gafer/api start:dev
pnpm --filter @gafer/worker start:dev

# Frontend Web
pnpm --filter @gafer/web dev

# Mobile (Android / Expo)
pnpm --filter @gafer/mobile start

# Tests / build de todo el monorepo (respeta el orden de dependencias)
pnpm build
pnpm test
```

Los repositorios de `infrastructure/` en cada módulo son adapters en memoria (`*.repository.memory.ts`), marcados con `TODO` — se reemplazan por adapters Postgres antes de producción, sin tocar `domain/` ni `application/`.
