import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDatabasePool, createKyselyDatabase } from './connection';
import { leerMigraciones } from './migrator';

describe('Database Migration and Schema Configuration (T2.1)', () => {
  it('should find 001_initial_schema.up.sql and contain all 11 core tables and schema elements', () => {
    const upPath = path.resolve(__dirname, '../../../../infra/migrations/001_initial_schema.up.sql');
    expect(fs.existsSync(upPath)).toBe(true);

    const content = fs.readFileSync(upPath, 'utf-8');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS clientes');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS proyectos');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS servicios_contratados');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS insumos');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS equipos');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS personal');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS visitas');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS inspecciones');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS inspecciones_auditoria');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS correlativos');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS documentos');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS catalogos_texto');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS configuracion_sistema');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS auditoria_eventos');
    expect(content).toContain('fn_siguiente_correlativo');
    expect(content).toContain('snapshot_catalogos JSONB');
    expect(content).toContain('chk_ruc_format');
  });

  it('should find 001_initial_schema.down.sql and drop tables in reverse dependency order', () => {
    const downPath = path.resolve(__dirname, '../../../../infra/migrations/001_initial_schema.down.sql');
    expect(fs.existsSync(downPath)).toBe(true);

    const content = fs.readFileSync(downPath, 'utf-8');
    expect(content).toContain('DROP TABLE IF EXISTS auditoria_eventos CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS configuracion_sistema CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS catalogos_texto CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS documentos CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS correlativos CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS inspecciones_auditoria CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS visitas CASCADE;');
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

  describe('Lectura de migraciones numeradas', () => {
    let directorio: string;

    beforeEach(() => {
      directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'gafer-migraciones-'));
      for (const archivo of [
        '002_segunda.up.sql',
        '001_primera.up.sql',
        '001_primera.down.sql',
        '002_segunda.down.sql',
        'LEEME.txt',
      ]) {
        fs.writeFileSync(path.join(directorio, archivo), `-- ${archivo}`);
      }
    });

    afterEach(() => {
      fs.rmSync(directorio, { recursive: true, force: true });
    });

    it('aplica todas las migraciones UP en orden numérico', async () => {
      const migraciones = await leerMigraciones('up', directorio);
      expect(migraciones.map((m) => m.nombre)).toEqual(['001_primera.up.sql', '002_segunda.up.sql']);
    });

    it('revierte las migraciones DOWN en orden inverso', async () => {
      const migraciones = await leerMigraciones('down', directorio);
      expect(migraciones.map((m) => m.nombre)).toEqual(['002_segunda.down.sql', '001_primera.down.sql']);
    });
  });

  it('el repositorio trae 002 con la columna clave_hash de personal y su reversa', async () => {
    const up = await leerMigraciones('up');
    const down = await leerMigraciones('down');
    expect(up.map((m) => m.nombre)).toEqual(['001_initial_schema.up.sql', '002_personal_clave_hash.up.sql']);
    expect(down.map((m) => m.nombre)).toEqual(['002_personal_clave_hash.down.sql', '001_initial_schema.down.sql']);
    expect(up[1].sql).toContain('ADD COLUMN IF NOT EXISTS clave_hash');
    expect(down[0].sql).toContain('DROP COLUMN IF EXISTS clave_hash');
  });
});
