/**
 * seed-demo.e2e-spec.ts
 * El seed de datos de ejemplo (db:seed:demo) contra PostgreSQL real: siembra, idempotencia, claves, atomicidad y limpieza.
 *
 * Historial de versiones
 *   v1.0  2026-10-08  ihuayhuam  Creación del archivo (GAF-94).
 */
import { ForbiddenException } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Pool } from 'pg';
import { CatalogoTextoId } from '@gafer/contracts';
import { LoginUseCase } from '../../src/auth/application/login.usecase';
import { createKyselyDatabase } from '../../src/database/connection';
import { DATOS_DEMO } from '../../src/database/seed/datos-demo';
import { limpiarDatosDemo, sembrarDatosDemo } from '../../src/database/seed/sembrar-demo';
import { GaferDatabase } from '../../src/database/types';
import { createTestApp, TestApp } from '../support/app';
import { TEST_DATABASE_URL } from '../support/config';
import { resetDb, sembrarInspeccionCerrada } from '../support/db';

const TABLAS = ['clientes', 'proyectos', 'servicios_contratados', 'insumos', 'equipos', 'personal'] as const;

describe('db:seed:demo contra PostgreSQL', () => {
  let app: TestApp;
  let pool: Pool;
  let db: Kysely<GaferDatabase>;

  const contar = async (tabla: (typeof TABLAS)[number]): Promise<number> =>
    Number((await app.db.query(`SELECT COUNT(*) AS n FROM ${tabla}`)).rows[0].n);

  const conteos = async (): Promise<Record<string, number>> =>
    Object.fromEntries(await Promise.all(TABLAS.map(async (t) => [t, await contar(t)] as const)));

  const catalogos = async (): Promise<Record<string, string[]>> => {
    const res = await app.db.query('SELECT id, items FROM catalogos_texto ORDER BY id');
    return Object.fromEntries(res.rows.map((r) => [r.id, r.items as string[]]));
  };

  const login = (usuario: string, clave: string, cliente: 'web' | 'mobile' = 'web') =>
    app.app.get(LoginUseCase).ejecutar({ usuario, clave, cliente });

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

  describe('siembra', () => {
    it('carga los datos de ejemplo con los conteos del conjunto de datos', async () => {
      const resultado = await sembrarDatosDemo(db);

      expect(await conteos()).toEqual({
        clientes: DATOS_DEMO.clientes.length,
        proyectos: DATOS_DEMO.sedes.length,
        servicios_contratados: DATOS_DEMO.servicios.length,
        insumos: DATOS_DEMO.insumos.length,
        equipos: DATOS_DEMO.equipos.length,
        personal: DATOS_DEMO.personal.length,
      });
      expect(resultado.conteos.clientes).toEqual({ creados: DATOS_DEMO.clientes.length, sinCambios: 0 });
      expect(resultado.conteos.servicios).toEqual({ creados: DATOS_DEMO.servicios.length, sinCambios: 0 });
      expect(resultado.conteos.configuracion).toEqual({ creados: 0, sinCambios: 1 });
      expect(resultado.credenciales).toHaveLength(DATOS_DEMO.personal.length);
    });

    it('enlaza cada servicio con los ids de sus insumos y equipos, con la dosis indexada por id de insumo', async () => {
      await sembrarDatosDemo(db);

      const servicio = DATOS_DEMO.servicios[0];
      const fila = (
        await app.db.query(
          `SELECT s.insumos_autorizados, s.equipos_autorizados, s.dosis_referencial, s.requiere_certificado, s.vigencia_dias
             FROM servicios_contratados s
             JOIN proyectos p ON p.id = s.proyecto_id
             JOIN clientes c ON c.id = p.cliente_id
            WHERE c.codigo_corto = $1 AND p.nombre = $2 AND s.tipo_servicio = $3`,
          [servicio.clienteCodigo, servicio.sede, servicio.tipoServicio],
        )
      ).rows[0];
      const insumos = (await app.db.query('SELECT id, registro_digesa FROM insumos WHERE registro_digesa = ANY($1)', [servicio.insumos])).rows;

      expect(fila.insumos_autorizados.sort()).toEqual(insumos.map((i) => i.id).sort());
      expect(fila.equipos_autorizados).toHaveLength(servicio.equipos.length);
      expect(Object.keys(fila.dosis_referencial).sort()).toEqual(insumos.map((i) => i.id).sort());
      expect(fila.requiere_certificado).toBe(servicio.requiereCertificado);
      expect(fila.vigencia_dias).toBe(servicio.vigenciaDias);
    });

    it('agrega los textos de ejemplo a los catálogos sin perder los que sembraron las migraciones', async () => {
      const antes = await catalogos();

      await sembrarDatosDemo(db);

      const despues = await catalogos();
      for (const [id, items] of Object.entries(DATOS_DEMO.catalogos)) {
        expect(despues[id]).toEqual([...antes[id], ...(items ?? [])]);
      }
      expect(despues['motivos-modificacion']).toEqual(antes['motivos-modificacion']);
    });

    it('cada usuario entra con su clave impresa y con el rol que corresponde', async () => {
      const { credenciales } = await sembrarDatosDemo(db);

      for (const credencial of credenciales) {
        expect(credencial.clave.length).toBeGreaterThanOrEqual(16);
        const esTecnico = credencial.cargo === 'TECNICO_OPERADOR';
        const sesion = await login(credencial.usuario, credencial.clave, esTecnico ? 'mobile' : 'web');
        expect(sesion.usuario.cargo).toBe(credencial.cargo);
        expect(sesion.token).toEqual(expect.any(String));
      }
      const tecnico = credenciales.find((c) => c.cargo === 'TECNICO_OPERADOR')!;
      await expect(login(tecnico.usuario, tecnico.clave, 'web')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('no guarda las claves en claro: solo hashes scrypt', async () => {
      const { credenciales } = await sembrarDatosDemo(db);

      const hashes = (await app.db.query('SELECT clave_hash FROM personal')).rows.map((r) => r.clave_hash as string);
      expect(hashes).toHaveLength(credenciales.length);
      for (const hash of hashes) expect(hash).toMatch(/^scrypt\$/);
      for (const { clave } of credenciales) expect(hashes.join('\n')).not.toContain(clave);
    });
  });

  describe('idempotencia', () => {
    it('la segunda corrida no duplica nada, informa "sin cambios" y no emite claves nuevas', async () => {
      const primera = await sembrarDatosDemo(db);
      const filas = await conteos();
      const textos = await catalogos();

      const segunda = await sembrarDatosDemo(db);

      expect(await conteos()).toEqual(filas);
      expect(await catalogos()).toEqual(textos);
      for (const conteo of Object.values(segunda.conteos)) expect(conteo.creados).toBe(0);
      expect(segunda.conteos.clientes.sinCambios).toBe(DATOS_DEMO.clientes.length);
      expect(segunda.conteos.textos.sinCambios).toBeGreaterThanOrEqual(50);
      expect(segunda.credenciales).toEqual([]);

      const admin = primera.credenciales.find((c) => c.cargo === 'ADMINISTRADOR')!;
      await expect(login(admin.usuario, admin.clave)).resolves.toBeDefined();
    });

    it('no pisa lo que el usuario editó después de sembrar', async () => {
      await sembrarDatosDemo(db);
      await app.db.query(`UPDATE clientes SET razon_social = 'Nombre editado por el usuario' WHERE codigo_corto = 'DEMOPAMPA'`);

      await sembrarDatosDemo(db);

      const fila = await app.db.query(`SELECT razon_social FROM clientes WHERE codigo_corto = 'DEMOPAMPA'`);
      expect(fila.rows[0].razon_social).toBe('Nombre editado por el usuario');
    });

    it('--regenerar-claves cambia solo las claves: la anterior deja de servir y la nueva funciona', async () => {
      const primera = await sembrarDatosDemo(db);
      const filas = await conteos();

      const regenerada = await sembrarDatosDemo(db, DATOS_DEMO, { regenerarClaves: true });

      expect(await conteos()).toEqual(filas);
      expect(regenerada.credenciales).toHaveLength(DATOS_DEMO.personal.length);
      const antes = primera.credenciales[0];
      const ahora = regenerada.credenciales.find((c) => c.usuario === antes.usuario)!;
      expect(ahora.clave).not.toBe(antes.clave);
      await expect(login(antes.usuario, antes.clave)).rejects.toThrow('Credenciales inválidas');
      await expect(login(ahora.usuario, ahora.clave, ahora.cargo === 'TECNICO_OPERADOR' ? 'mobile' : 'web')).resolves.toBeDefined();
    });
  });

  describe('transacción', () => {
    it('si algo falla, no queda nada: ni siquiera lo que ya se había sembrado antes del error', async () => {
      // Un cliente ajeno con el mismo RUC que uno de ejemplo pero con otro código: choque que se detecta ya empezada la carga.
      await app.db.query(
        `INSERT INTO clientes (razon_social, ruc, codigo_corto, direccion_fiscal, giro_negocio, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo)
         VALUES ('Cliente real', $1, 'REAL01', 'Dirección', 'Giro', 'Contacto', 'Cargo', '999999999', 'real@example.com')`,
        [DATOS_DEMO.clientes[3].ruc],
      );

      await expect(sembrarDatosDemo(db)).rejects.toThrow(/choca con una fila existente/i);

      expect(await conteos()).toEqual({ clientes: 1, proyectos: 0, servicios_contratados: 0, insumos: 0, equipos: 0, personal: 0 });
    });

    it('un DNI de ejemplo ocupado por otra persona aborta la carga sin tocar a esa persona', async () => {
      await app.db.query(
        `INSERT INTO personal (dni, nombres, apellidos, cargo, telefono, usuario) VALUES ($1, 'Persona', 'Real', 'SUPERVISOR', '999999999', 'PERSONA.REAL')`,
        [DATOS_DEMO.personal[0].dni],
      );

      await expect(sembrarDatosDemo(db)).rejects.toThrow(/choca con una fila existente/i);

      const filas = await app.db.query('SELECT usuario, clave_hash FROM personal');
      expect(filas.rows).toEqual([{ usuario: 'PERSONA.REAL', clave_hash: null }]);
      expect(await contar('clientes')).toBe(0);
    });
  });

  describe('limpieza', () => {
    const insertarCliente = async (codigo: string, ruc: string): Promise<string> =>
      (
        await app.db.query(
          `INSERT INTO clientes (razon_social, ruc, codigo_corto, direccion_fiscal, giro_negocio, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo)
           VALUES ('Cliente ajeno', $1, $2, 'Dirección', 'Giro', 'Contacto', 'Cargo', '999999999', 'ajeno@example.com') RETURNING id`,
          [ruc, codigo],
        )
      ).rows[0].id;

    const idServicioDemo = async (clienteCodigo: string, sede: string, tipo: string): Promise<string> =>
      (
        await app.db.query(
          `SELECT s.id FROM servicios_contratados s JOIN proyectos p ON p.id = s.proyecto_id JOIN clientes c ON c.id = p.cliente_id
            WHERE c.codigo_corto = $1 AND p.nombre = $2 AND s.tipo_servicio = $3`,
          [clienteCodigo, sede, tipo],
        )
      ).rows[0].id;

    it('deja la base como estaba antes del seed y no toca filas ajenas', async () => {
      const textosOriginales = await catalogos();
      const sinSeed = await conteos();
      await sembrarDatosDemo(db);

      // Filas ajenas, creadas por el usuario: un cliente con sede y servicio, un insumo, un equipo, una persona y un texto.
      const clienteAjeno = await insertarCliente('AJENO01', '20100000009');
      const sedeAjena = (
        await app.db.query(
          `INSERT INTO proyectos (cliente_id, nombre, direccion_sede, distrito, provincia, departamento, contacto_nombre, contacto_cargo, contacto_telefono)
           VALUES ($1, 'SEDE_AJENA', 'Dirección', 'Distrito', 'Provincia', 'Depto', 'Contacto', 'Cargo', '999999999') RETURNING id`,
          [clienteAjeno],
        )
      ).rows[0].id;
      await app.db.query(
        `INSERT INTO servicios_contratados (proyecto_id, tipo_servicio, frecuencia, area_total_m2, area_tratar_m2) VALUES ($1, 'DRT', 'MENSUAL', 100, 90)`,
        [sedeAjena],
      );
      await app.db.query(
        `INSERT INTO insumos (nombre_comercial, principio_activo, presentacion, unidad_medida, registro_digesa, concentracion, dosis_estandar, ficha_tecnica_key, hoja_msds_key)
         VALUES ('Insumo real', 'Activo', 'LIQUIDO', 'L', 'REG-REAL-1', '1 %', '1 ml', 'f.pdf', 'm.pdf')`,
      );
      await app.db.query(`INSERT INTO equipos (codigo_interno, nombre, tipo) VALUES ('EQ-REAL-1', 'Equipo real', 'OTRO')`);
      await app.db.query(`INSERT INTO personal (dni, nombres, apellidos, cargo, telefono, usuario) VALUES ('45892399', 'Persona', 'Real', 'SUPERVISOR', '999999999', 'PERSONA.REAL')`);
      await app.db.query(`UPDATE catalogos_texto SET items = items || '["Texto agregado por el usuario"]'::jsonb WHERE id = 'hallazgos'`);

      const resultado = await limpiarDatosDemo(db);

      expect(await conteos()).toEqual({
        clientes: sinSeed.clientes + 1,
        proyectos: sinSeed.proyectos + 1,
        servicios_contratados: sinSeed.servicios_contratados + 1,
        insumos: sinSeed.insumos + 1,
        equipos: sinSeed.equipos + 1,
        personal: sinSeed.personal + 1,
      });
      expect((await app.db.query(`SELECT codigo_corto FROM clientes`)).rows).toEqual([{ codigo_corto: 'AJENO01' }]);
      expect((await catalogos()).hallazgos).toEqual([...textosOriginales.hallazgos, 'Texto agregado por el usuario']);
      const sinHallazgos = (c: Record<string, string[]>) => ({ ...c, hallazgos: undefined });
      expect(sinHallazgos(await catalogos())).toEqual(sinHallazgos(textosOriginales));

      expect(resultado.eliminados.clientes).toBe(DATOS_DEMO.clientes.length);
      expect(resultado.eliminados.sedes).toBe(DATOS_DEMO.sedes.length);
      expect(resultado.eliminados.servicios).toBe(DATOS_DEMO.servicios.length);
      expect(resultado.eliminados.personal).toBe(DATOS_DEMO.personal.length);
      expect(resultado.omitidos).toEqual([]);
    });

    it('sin datos ajenos deja la base idéntica a la migrada, y repetirla no hace nada', async () => {
      const textosOriginales = await catalogos();
      await sembrarDatosDemo(db);

      await limpiarDatosDemo(db);
      const repetida = await limpiarDatosDemo(db);

      expect(await conteos()).toEqual({ clientes: 0, proyectos: 0, servicios_contratados: 0, insumos: 0, equipos: 0, personal: 0 });
      expect(await catalogos()).toEqual(textosOriginales);
      expect(Object.values(repetida.eliminados).every((n) => n === 0)).toBe(true);
    });

    it('conserva y avisa lo que tiene datos asociados (inspecciones) en lugar de borrarlo en cascada', async () => {
      await sembrarDatosDemo(db);
      const servicio = DATOS_DEMO.servicios[0];
      const servicioId = await idServicioDemo(servicio.clienteCodigo, servicio.sede, servicio.tipoServicio);
      await sembrarInspeccionCerrada(app.db, {
        id: '11111111-1111-4111-8111-111111111111',
        servicioId,
        codigo: 'INS-DEMO-0001',
        snapshot: {},
      });

      const resultado = await limpiarDatosDemo(db);

      expect(await app.db.query('SELECT 1 FROM servicios_contratados WHERE id = $1', [servicioId])).toHaveProperty('rowCount', 1);
      expect(await app.db.query('SELECT 1 FROM inspecciones')).toHaveProperty('rowCount', 1);
      expect((await app.db.query(`SELECT 1 FROM clientes WHERE codigo_corto = $1`, [servicio.clienteCodigo])).rowCount).toBe(1);
      expect((await app.db.query(`SELECT 1 FROM proyectos WHERE nombre = $1`, [servicio.sede])).rowCount).toBe(1);
      for (const registro of servicio.insumos) {
        expect((await app.db.query('SELECT 1 FROM insumos WHERE registro_digesa = $1', [registro])).rowCount).toBe(1);
      }
      for (const codigo of servicio.equipos) {
        expect((await app.db.query('SELECT 1 FROM equipos WHERE codigo_interno = $1', [codigo])).rowCount).toBe(1);
      }
      expect(resultado.omitidos.join('\n')).toMatch(new RegExp(`${servicio.clienteCodigo}/${servicio.sede}/${servicio.tipoServicio}`));
      expect(resultado.eliminados.servicios).toBe(DATOS_DEMO.servicios.length - 1);
      // Todo lo demás sí se limpió.
      expect(await contar('servicios_contratados')).toBe(1);
      expect(await contar('clientes')).toBe(1);
    });

    it('conserva la sede y el cliente de ejemplo si el usuario les agregó un servicio propio', async () => {
      await sembrarDatosDemo(db);
      const sede = DATOS_DEMO.sedes[0];
      const propios = new Set(DATOS_DEMO.servicios.filter((s) => s.clienteCodigo === sede.clienteCodigo && s.sede === sede.nombre).map((s) => s.tipoServicio));
      const tipoLibre = (['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM'] as const).find((t) => !propios.has(t))!;
      await app.db.query(
        `INSERT INTO servicios_contratados (proyecto_id, tipo_servicio, frecuencia, area_total_m2, area_tratar_m2)
         SELECT p.id, $3, 'ANUAL', 50, 50 FROM proyectos p JOIN clientes c ON c.id = p.cliente_id WHERE c.codigo_corto = $1 AND p.nombre = $2`,
        [sede.clienteCodigo, sede.nombre, tipoLibre],
      );

      const resultado = await limpiarDatosDemo(db);

      expect((await app.db.query('SELECT tipo_servicio FROM servicios_contratados')).rows).toEqual([{ tipo_servicio: tipoLibre }]);
      expect((await app.db.query('SELECT nombre FROM proyectos')).rows).toEqual([{ nombre: sede.nombre }]);
      expect((await app.db.query('SELECT codigo_corto FROM clientes')).rows).toEqual([{ codigo_corto: sede.clienteCodigo }]);
      expect(resultado.omitidos.join('\n')).toMatch(new RegExp(sede.nombre));
    });

    it('un servicio de ejemplo que el usuario modificó se considera suyo y se conserva', async () => {
      await sembrarDatosDemo(db);
      const servicio = DATOS_DEMO.servicios[1];
      const servicioId = await idServicioDemo(servicio.clienteCodigo, servicio.sede, servicio.tipoServicio);
      await app.db.query(`UPDATE servicios_contratados SET frecuencia = 'ANUAL', area_total_m2 = 99999, area_tratar_m2 = 99999 WHERE id = $1`, [servicioId]);

      await limpiarDatosDemo(db);

      expect((await app.db.query('SELECT id FROM servicios_contratados')).rows).toEqual([{ id: servicioId }]);
    });

    it('conserva a la persona de ejemplo que participó en una inspección, y los usuarios restantes se borran', async () => {
      await sembrarDatosDemo(db);
      const servicio = DATOS_DEMO.servicios[2];
      const servicioId = await idServicioDemo(servicio.clienteCodigo, servicio.sede, servicio.tipoServicio);
      const tecnico = (await app.db.query(`SELECT id FROM personal WHERE usuario = 'DEMO.TECNICO1'`)).rows[0].id;
      await app.db.query(
        `INSERT INTO inspecciones (servicio_id, codigo_inspeccion, fecha_ejecucion, tecnicos_participantes) VALUES ($1, 'INS-DEMO-0002', '2026-10-01', $2::jsonb)`,
        [servicioId, JSON.stringify([{ id: tecnico, nombre: 'Tecnico Uno' }])],
      );

      const resultado = await limpiarDatosDemo(db);

      expect((await app.db.query('SELECT usuario FROM personal')).rows).toEqual([{ usuario: 'DEMO.TECNICO1' }]);
      expect(resultado.omitidos.join('\n')).toMatch(/demo\.tecnico1/i);
    });

    it('no toca un cliente con el mismo código pero otro RUC (no es de ejemplo)', async () => {
      await insertarCliente('DEMOPAMPA', '20100000017');

      const resultado = await limpiarDatosDemo(db);

      expect((await app.db.query('SELECT ruc FROM clientes')).rows).toEqual([{ ruc: '20100000017' }]);
      expect(resultado.eliminados.clientes).toBe(0);
    });
  });

  it('si el usuario quitó un texto de ejemplo, el seed lo vuelve a agregar una sola vez, sin duplicar ni reordenar el resto', async () => {
    await sembrarDatosDemo(db);
    const id: CatalogoTextoId = 'recomendaciones';
    const antes = (await catalogos())[id];

    await app.db.query(`UPDATE catalogos_texto SET items = $2::jsonb WHERE id = $1`, [id, JSON.stringify(antes.slice(0, -1))]);
    const resultado = await sembrarDatosDemo(db);

    expect((await catalogos())[id]).toEqual(antes);
    expect(resultado.conteos.textos.creados).toBe(1);
  });
});
