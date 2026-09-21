-- =============================================================================
-- Migración Reversa: 001_initial_schema.down.sql
-- Dominio: Mantenimiento y Operaciones de Campo (Fase 1)
-- Base de Datos: PostgreSQL 16
-- =============================================================================

DROP TABLE IF EXISTS inspecciones_auditoria CASCADE;
DROP TRIGGER IF EXISTS trg_proteger_snapshot_inspeccion ON inspecciones;
DROP FUNCTION IF EXISTS fn_proteger_snapshot_inspeccion_cerrada();
DROP INDEX IF EXISTS idx_inspecciones_servicio_borrador_unico;
DROP TABLE IF EXISTS inspecciones CASCADE;
DROP TABLE IF EXISTS personal CASCADE;
DROP TABLE IF EXISTS equipos CASCADE;
DROP TABLE IF EXISTS insumos CASCADE;
DROP TABLE IF EXISTS servicios_contratados CASCADE;
DROP TABLE IF EXISTS proyectos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
