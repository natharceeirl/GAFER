# Documentación del Sistema GAFER

Este directorio concentra las especificaciones y decisiones de arquitectura tomadas para el proyecto de automatización de informes y reportes de GAFER Saneamiento Ambiental E.I.R.L.

---

## Documentos clave

1. **[ARQUITECTURA.md](./ARQUITECTURA.md):** 
   Documento formal con la topología del monorepo, la matriz de componentes y los **12 Principios Rectores** consensuados (Outbox idempotente, snapshots inmutables, almacenamiento de fotos fuera del JSON, PostgreSQL como fuente de verdad y resolución de conflictos en backend).
2. **Pliego de Especificaciones (v6):**
   Ubicado en la raíz del repositorio (`GAFER_Especificaciones_Sistema_v6_Actualizado.pdf`), define el alcance funcional, reglas del Mapa Murino, inmutabilidad y los criterios de aceptación por fase.
3. **[Especificación Canónica Fase 1](../specs/fase-1-mantenimiento-operaciones.spec.md):**
   Fuente de verdad técnica para el Sprint 1: diccionario de datos, entidades de Mantenimiento, inmutabilidad y criterios de aceptación.

