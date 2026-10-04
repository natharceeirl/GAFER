/**
 * crear-usuario.e2e-spec.ts
 * El comando que crea usuarios con clave (db:crear-usuario) contra PostgreSQL real, y el login con ellos.
 *
 * Historial de versiones
 *   v1.0  2026-10-04  ihuayhuam  Creación del archivo (GAF-93).
 */
import { Kysely } from 'kysely';
import { Pool } from 'pg';
import request = require('supertest');
import { crearOActualizarUsuario } from '../../src/database/crear-usuario';
import { createKyselyDatabase } from '../../src/database/connection';
import { GaferDatabase } from '../../src/database/types';
import { createTestApp, TestApp } from '../support/app';
import { resetDb } from '../support/db';
import { TEST_DATABASE_URL } from '../support/config';

const CLAVE = 'clave-de-prueba-0001';

const datosAdmin = {
  usuario: 'm.quispe',
  cargo: 'ADMINISTRADOR',
  dni: '45892312',
  nombres: 'Maria',
  apellidos: 'Quispe Rojas',
  telefono: '958123456',
  clave: CLAVE,
};

describe('db:crear-usuario y login con clave guardada', () => {
  let app: TestApp;
  let pool: Pool;
  let db: Kysely<GaferDatabase>;

  beforeAll(async () => {
    app = await createTestApp();
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
    db = createKyselyDatabase(pool);
  });

  beforeEach(async () => {
    await resetDb(app.db);
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  it('crea el administrador, guarda solo el hash y permite iniciar sesión', async () => {
    const resultado = await crearOActualizarUsuario(db, datosAdmin);
    expect(resultado.accion).toBe('creado');

    const fila = await app.db.query('SELECT usuario, cargo, estado, clave_hash FROM personal');
    expect(fila.rows).toHaveLength(1);
    expect(fila.rows[0].usuario).toBe('M.QUISPE');
    expect(fila.rows[0].clave_hash).toMatch(/^scrypt\$/);
    expect(fila.rows[0].clave_hash).not.toContain(CLAVE);

    const login = await request(app.baseUrl).post('/api/auth/login').send({ usuario: 'm.quispe', clave: CLAVE, cliente: 'web' });
    expect(login.status).toBe(200);
    expect(login.body.usuario).toMatchObject({ usuario: 'M.QUISPE', cargo: 'ADMINISTRADOR', dni: '45892312' });
    expect(login.body.token).toEqual(expect.any(String));
    expect(JSON.stringify(login.body)).not.toContain('scrypt');
  });

  it('actualiza al usuario existente: cambia la clave sin duplicar la fila', async () => {
    await crearOActualizarUsuario(db, datosAdmin);
    const resultado = await crearOActualizarUsuario(db, { ...datosAdmin, telefono: undefined, clave: 'otra-clave-de-prueba' });
    expect(resultado.accion).toBe('actualizado');

    const filas = await app.db.query('SELECT telefono FROM personal');
    expect(filas.rows).toEqual([{ telefono: '958123456' }]);

    const vieja = await request(app.baseUrl).post('/api/auth/login').send({ usuario: 'm.quispe', clave: CLAVE });
    expect(vieja.status).toBe(401);
    const nueva = await request(app.baseUrl).post('/api/auth/login').send({ usuario: 'm.quispe', clave: 'otra-clave-de-prueba' });
    expect(nueva.status).toBe(200);
  });

  it('rechaza claves cortas, DNI inválido y un alta nueva sin teléfono, sin tocar la base', async () => {
    await expect(crearOActualizarUsuario(db, { ...datosAdmin, clave: 'corta' })).rejects.toThrow(/12 caracteres/);
    await expect(crearOActualizarUsuario(db, { ...datosAdmin, dni: '12' })).rejects.toThrow(/DNI/);
    await expect(crearOActualizarUsuario(db, { ...datosAdmin, telefono: undefined })).rejects.toThrow(/teléfono/i);

    const filas = await app.db.query('SELECT 1 FROM personal');
    expect(filas.rows).toHaveLength(0);
  });

  it('no reutiliza un DNI que ya pertenece a otro usuario', async () => {
    await crearOActualizarUsuario(db, datosAdmin);
    await expect(crearOActualizarUsuario(db, { ...datosAdmin, usuario: 'otro.usuario' })).rejects.toThrow(/DNI/);
  });

  it('una fila de personal creada por Mantenimiento, sin clave, no puede iniciar sesión', async () => {
    await app.db.query(
      `INSERT INTO personal (dni, nombres, apellidos, cargo, telefono, usuario)
       VALUES ('45892399', 'Sin', 'Clave', 'SUPERVISOR', '958123456', 'SIN.CLAVE')`,
    );

    const res = await request(app.baseUrl).post('/api/auth/login').send({ usuario: 'sin.clave', clave: 'cualquier-clave-larga' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas');
  });

  it('login con usuario inexistente y con clave equivocada devuelven la misma respuesta', async () => {
    await crearOActualizarUsuario(db, datosAdmin);

    const clavePorMala = await request(app.baseUrl).post('/api/auth/login').send({ usuario: 'm.quispe', clave: 'clave-equivocada-1' });
    const inexistente = await request(app.baseUrl).post('/api/auth/login').send({ usuario: 'fantasma', clave: 'clave-equivocada-1' });

    expect(clavePorMala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    const sinMarca = ({ timestamp, ...resto }: Record<string, unknown>) => resto;
    expect(sinMarca(inexistente.body)).toEqual(sinMarca(clavePorMala.body));
  });

  it('un usuario desactivado recibe 403 al iniciar sesión con la clave correcta', async () => {
    await crearOActualizarUsuario(db, datosAdmin);
    await app.db.query(`UPDATE personal SET estado = 'INACTIVO' WHERE usuario = 'M.QUISPE'`);

    const res = await request(app.baseUrl).post('/api/auth/login').send({ usuario: 'm.quispe', clave: CLAVE });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('inactivo');
  });
});
