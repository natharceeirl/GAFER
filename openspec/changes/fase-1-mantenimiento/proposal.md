# Proposal: Fase 1 — Mantenimiento y Operaciones de Campo

## Summary
Implementación de los cimientos del sistema GAFER según el pliego contractual `GAFER_Especificaciones_Sistema_v6_Actualizado.pdf`. Cubre el módulo administrativo de **Mantenimiento** (Clientes, Sedes/Proyectos, Servicios Contratados, Insumos, Equipos, Personal) y el motor de **Operaciones de Campo** (inspecciones colaborativas offline-first, resolución de conflictos e inmutabilidad estricta según Sección 13).

## Motivation
GAFER requiere digitalizar sus operaciones de saneamiento ambiental en Arequipa garantizando validez legal y técnica. Las inspecciones deben ser inmutables a cambios en los catálogos y permitir que múltiples operadores trabajen simultáneamente en terreno sin pérdida de datos.

## Scope & Capabilities
1. **Mantenimiento Administrativo**:
   - Gestión jerárquica: `Cliente` (RUC 11 dígitos, código corto) -> `Proyecto` (Sede) -> `Servicio Contratado` (7 tipos oficiales).
   - Catálogos técnicos: Insumos (con fichas DIGESA y MSDS), Equipos (estados operativos), Personal (DNI 8 dígitos, cargos).
2. **Operaciones Colaborativas**:
   - Registro de inspecciones en estado borrador con edición concurrente.
   - Resolución de colisiones mediante `server_received_at` y versionado monótono.
3. **Inmutabilidad Contractual (Sección 13)**:
   - Persistencia de Snapshot JSON para cada insumo, dosis y personal asignado en una inspección.
   - Garantía de que la edición posterior de un insumo en el catálogo no altere reportes pasados.

## Rollback Plan
- Migraciones reversibles en PostgreSQL con scripts `down` explícitos.
- Contratos versionados en `@gafer/contracts` con compatibilidad hacia atrás.
- En caso de falla crítica en despliegue, retroceso a imagen previa de Docker mediante rollback en `infra/docker-compose.yml`.
