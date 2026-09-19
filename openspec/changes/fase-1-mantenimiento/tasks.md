# Tasks: Fase 1 — Mantenimiento y Operaciones

## Role: Ivan (Líder / Full Stack)
- [ ] **T1.1: Esquemas de Contratos en `@gafer/contracts`** <!-- id: 1.1 -->
  - Definir esquemas Zod con validaciones exactas para `Cliente`, `Proyecto`, `ServicioContratado`, `Insumo`, `Equipo`, `Personal`.
  - Exportar tipos TypeScript inferidos.
  - DoD: Pruebas unitarias de esquemas pasando en vitest (`pnpm --filter @gafer/contracts test`).
- [ ] **T1.2: Vistas de Mantenimiento en Web (`apps/web`)** <!-- id: 1.2 -->
  - Implementar páginas y componentes FSD para gestión de Clientes, Sedes y Servicios.
  - Vistas de catálogos para Insumos, Equipos y Personal.
  - DoD: Formularios conectados a endpoints REST con manejo de estados de error y carga.
- [ ] **T1.3: Hook de Sincronización Móvil en Expo (`apps/mobile`)** <!-- id: 1.3 -->
  - Integrar OutboxQueue para almacenar acciones de inspección offline.
  - Enviar lote de operaciones cuando `NetInfo` detecte conexión.
  - DoD: Simulación offline en Vitest verificando encolado y reintento.

## Role: Cristian (Backend & Database / Integraciones) — *ACTIVE DEVELOPER*
- [x] **T2.1: Migración PostgreSQL Inicial en `infra` / `apps/api`** <!-- id: 2.1 -->
  - Crear script SQL de migración inicial con tablas maestras: `clientes`, `proyectos`, `servicios_contratados`, `insumos`, `equipos`, `personal`, `inspecciones`, `inspecciones_auditoria`.
  - Crear índices en RUC, código corto, DNI y claves foráneas.
  - DoD: Migración se ejecuta limpiamente sobre PostgreSQL 16 local con script `up` y `down`.
- [x] **T2.2: Repositorios y Servicios Hexagonales en `apps/api`** <!-- id: 2.2 -->
  - Implementar puertos y adaptadores para el módulo de Mantenimiento.
  - Screaming architecture: `src/modules/maintenance/` (domain, application, infrastructure).
  - Validaciones de negocio: unicidad de código corto, validación estricta de 11 dígitos para RUC.
  - DoD: Tests unitarios de servicios con mocks en Jest (`pnpm --filter @gafer/api test`).
- [ ] **T2.3: Endpoints REST y Validación de Inmutabilidad Sección 13** <!-- id: 2.3 -->
  - Implementar controladores REST para Clientes, Sedes, Servicios, Insumos, Equipos, Personal.
  - Implementar lógica de guardado de `snapshot_catalogos` en `inspecciones`.
  - Integración básica con MinIO para carga y firma de URLs de fichas técnicas y MSDS.
  - DoD: Pruebas de integración verificando que actualizar un insumo en el catálogo no modifica el `snapshot_catalogos` de una inspección cerrada.

## Role: Andre (QA / Testing)
- [ ] **T3.1: Suite de Pruebas de Integración de Inmutabilidad (Sección 13)** <!-- id: 3.1 -->
  - Crear tests E2E / Integración con Supertest validando que cambios en catálogos no mutan inspecciones históricas.
  - DoD: Pipeline de test pasando con reporte de cobertura.
- [ ] **T3.2: Pruebas de Concurrencia y Sincronización de Campo** <!-- id: 3.2 -->
  - Simular dos técnicos enviando datos de inspección concurrentes y verificar resolución de colisión sin pérdida de datos.
  - DoD: Test suite automatizada con reporte de pruebas de estrés.
