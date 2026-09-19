-- =============================================================================
-- Migración Reversa: 001_initial_schema.down.sql
-- Dominio: Mantenimiento y Operaciones de Campo (Fase 1)
-- Base de Datos: PostgreSQL 16
-- =============================================================================

DROP TABLE IF EXISTS inspecciones_auditoria CASCADE;
DROP TABLE IF EXISTS inspecciones CASCADE;
DROP TABLE IF EXISTS personal CASCADE;
DROP TABLE IF EXISTS equipos CASCADE;
DROP TABLE IF EXISTS insumos CASCADE;
DROP TABLE IF EXISTS servicios_contratados CASCADE;
DROP TABLE IF EXISTS proyectos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
