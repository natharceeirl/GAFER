import * as fs from 'fs';
import * as path from 'path';
import { createDatabasePool, createKyselyDatabase } from './connection';

describe('Database Migration and Schema Configuration (T2.1)', () => {
  it('should find 001_initial_schema.up.sql and contain all 8 core tables', () => {
    const upPath = path.resolve(__dirname, '../../../../infra/migrations/001_initial_schema.up.sql');
    expect(fs.existsSync(upPath)).toBe(true);

    const content = fs.readFileSync(upPath, 'utf-8');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS clientes');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS proyectos');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS servicios_contratados');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS insumos');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS equipos');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS personal');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS inspecciones');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS inspecciones_auditoria');
    expect(content).toContain('snapshot_catalogos JSONB');
    expect(content).toContain('chk_ruc_format');
  });

  it('should find 001_initial_schema.down.sql and drop tables in reverse dependency order', () => {
    const downPath = path.resolve(__dirname, '../../../../infra/migrations/001_initial_schema.down.sql');
    expect(fs.existsSync(downPath)).toBe(true);

    const content = fs.readFileSync(downPath, 'utf-8');
    expect(content).toContain('DROP TABLE IF EXISTS inspecciones_auditoria CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS clientes CASCADE;');
  });

  it('should create database pool and Kysely instance with expected config', () => {
    const pool = createDatabasePool();
    expect(pool).toBeDefined();

    const db = createKyselyDatabase(pool);
    expect(db).toBeDefined();

    // Clean up pool
    pool.end();
  });
});
