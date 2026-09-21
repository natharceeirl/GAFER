# Arquitectura del Sistema GAFER

Este documento formaliza las decisiones de arquitectura consensuadas para el proyecto de automatización de informes, reportes y mapa murino de **GAFER Saneamiento Ambiental E.I.R.L.**

---

## 1. Topología del Monorepo

Monorepo administrado con **pnpm workspaces**:

```text
gafer/
├── apps/
│   ├── api/          # NestJS — Backend modular (Hexagonal + Screaming Architecture)
│   ├── worker/       # NestJS + BullMQ — Procesamiento asíncrono (PDFs, hashes, compresión)
│   ├── web/          # React + Vite — Backoffice para Administrador y Supervisor (FSD)
│   └── mobile/       # React Native + Expo — App Android de campo offline-first (FSD)
├── packages/
│   └── contracts/    # Esquemas Zod y tipos compartidos entre backend, web y mobile
├── infra/            # docker-compose (PostgreSQL 16, Redis 7, MinIO S3)
└── docs/             # Especificaciones y notas de arquitectura
```

---

## 2. Los 12 Principios Rectores

1. **PostgreSQL es la fuente de verdad del servidor:** Persistencia relacional para clientes, sedes, servicios, auditoría y snapshots.
2. **SQLite es la fuente de verdad del cliente móvil:** Almacenamiento local en disco para garantizar operación 100% offline en minas y plantas industriales.
3. **Escritura offline mediante Outbox idempotente:** Toda acción en el dispositivo móvil genera una operación local con `operation_id` UUID único. El servidor procesa idempotentemente evitando duplicados.
4. **Las fotografías NUNCA viajan en el JSON de sincronización:** Las fotos se comprimen en el móvil y se suben como archivos independientes a Object Storage (S3/MinIO) mediante uploads reanudables/multipart. El JSON de inspección solo guarda los `objectKey`.
5. **Inmutabilidad estricta (Sección 13):** Agregar o editar catálogos jamás altera inspecciones anteriores. Los datos históricos se congelan en **Snapshots de ejecución** al momento del servicio y no se recalculan.
6. **Los PDFs aprobados son inmutables:** Se almacenan como objetos finales con hash SHA-256. Nunca se regeneran al descargarse.
7. **Resolución de conflictos en el servidor:** El criterio de "último dato ingresado" se resuelve mediante la hora de recepción en el servidor (`server_received_at + monotonic_version`), nunca por el reloj del teléfono móvil.
8. **Numeración correlativa atómica:** La numeración de informes y reportes se asigna exclusivamente en PostgreSQL durante la aprobación mediante una operación atómica (`NumeradorCorrelativoPort`), jamás en el cliente ni con `MAX(n)+1`.
9. **Generación de PDFs asíncrona:** La API no renderiza PDFs. Encola un trabajo en Redis/BullMQ para que el `apps/worker` lo procese sin degradar la respuesta HTTP.
10. **Dominio puro y desacoplado:** La lógica del Mapa Murino (máquina de estados de auras de calor y niveles de consumo) reside en clases de dominio puro, sin I/O, testeables en milisegundos.
11. **Feature-Sliced Design (FSD) unificado:** Tanto la Web como la App Móvil organizan su código frontend en capas (`app`, `pages`, `widgets`, `features`, `entities`, `shared`), separando estado local de borrador del cache remoto.
12. **Contratos Zod versionados:** Los esquemas de `@gafer/contracts` validan entradas/salidas y evolucionan con compatibilidad hacia atrás (`sync.v1`, etc.).

---

## 3. Matriz de Componentes y Responsabilidades

| Componente | Plataforma / Tecnología | Rol en el Sistema |
|---|---|---|
| **`apps/api`** | NestJS, TypeScript, PostgreSQL | API REST, orquestación de casos de uso, autenticación, control de concurrencia y snapshots. |
| **`apps/worker`** | NestJS, BullMQ, Redis | Renderizado de PDFs pesados, compresión de imágenes, subida a MinIO/S3 y cálculo de hashes. |
| **`apps/web`** | React 18, Vite, Tailwind, FSD | Backoffice administrativo en PC/Laptop: mantenimiento de catálogos, aprobación de informes, dashboards y visualización. |
| **`apps/mobile`** | React Native, Expo (Bridgeless), FSD | Aplicación de campo para técnicos en Android: formularios dinámicos, operación offline, firma en pantalla y captura de fotos. |
| **`packages/contracts`** | Zod, TypeScript | Definición de tipos y validadores canónicos para todo el monorepo. |
| **`infra`** | Docker Compose | Postgres 16 (datos), Redis 7 (colas/locks), MinIO (object storage local para PDFs y fotos). |
