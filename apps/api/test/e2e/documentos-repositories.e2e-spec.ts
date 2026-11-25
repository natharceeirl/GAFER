/**
 * documentos-repositories.e2e-spec.ts
 * Adapters Kysely de documentos y numeración correlativa atómica contra PostgreSQL real (GAF-47, GAF-49).
 */
import { randomUUID } from 'crypto';
import { createTestApp, TestApp } from '../support/app';
import { resetDb } from '../support/db';
import { leerMigraciones } from '../../src/database/migrator';
import { CrearDocumentoUseCase } from '../../src/documentos/application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from '../../src/documentos/application/transicionar-documento.usecase';
import { ObtenerDocumentoUseCase } from '../../src/documentos/application/obtener-documento.usecase';
import { ListarDocumentosUseCase } from '../../src/documentos/application/listar-documentos.usecase';
import { TRANSACCION, TransaccionPort } from '../../src/documentos/domain/ports/transaccion.port';
import {
  NUMERADOR_CORRELATIVO,
  NumeradorCorrelativoPort,
} from '../../src/documentos/domain/ports/numerador-correlativo.port';

const ACTOR = { id: randomUUID(), usuario: 'SUP.E2E', rol: 'SUPERVISOR' };

describe('Documentos y numeración correlativa contra PostgreSQL real (GAF-47, GAF-49)', () => {
  let t: TestApp;
  let crear: CrearDocumentoUseCase;
  let transicionar: TransicionarDocumentoUseCase;
  let obtener: ObtenerDocumentoUseCase;
  let listar: ListarDocumentosUseCase;
  let numerador: NumeradorCorrelativoPort;
  let transaccion: TransaccionPort;
  let clienteA: string;
  let clienteB: string;

  async function nuevoCliente(codigo: string): Promise<string> {
    const res = await t.db.query(
      `INSERT INTO clientes (razon_social, ruc, codigo_corto, direccion_fiscal, giro_negocio,
                             contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo)
       VALUES ($1, $2, $3, 'Av. 1', 'Energía', 'Ana', 'Jefa', '999', 'a@example.com') RETURNING id`,
      [`Cliente ${codigo} S.A.`, `20${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, codigo],
    );
    return res.rows[0].id;
  }

  beforeAll(async () => {
    t = await createTestApp();
    crear = t.app.get(CrearDocumentoUseCase);
    transicionar = t.app.get(TransicionarDocumentoUseCase);
    obtener = t.app.get(ObtenerDocumentoUseCase);
    listar = t.app.get(ListarDocumentosUseCase);
    numerador = t.app.get<NumeradorCorrelativoPort>(NUMERADOR_CORRELATIVO);
    transaccion = t.app.get<TransaccionPort>(TRANSACCION);
  });

  beforeEach(async () => {
    await resetDb(t.db);
    clienteA = await nuevoCliente('KALLPA');
    clienteB = await nuevoCliente('SAMAY');
  });

  afterAll(async () => {
    await t.close();
  });

  describe('migración 005', () => {
    it('se puede aplicar dos veces seguidas sin error', async () => {
      const migraciones = await leerMigraciones('up');
      for (let vuelta = 0; vuelta < 2; vuelta++) {
        for (const m of migraciones) await t.db.query(m.sql);
      }
      const tablas = await t.db.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name IN ('documentos_transiciones', 'correlativos_globales')`,
      );
      expect(tablas.rows).toHaveLength(2);
    });
  });

  describe('numeración atómica (GAF-49)', () => {
    it('50 documentos creados en paralelo por cliente y tipo no repiten ni saltan números', async () => {
      const trabajos: Array<Promise<{ clienteId: string; tipo: string; numero: number }>> = [];
      for (const clienteId of [clienteA, clienteB]) {
        for (const tipo of ['INFORME', 'REPORTE'] as const) {
          for (let i = 0; i < 25; i++) {
            trabajos.push(crear.ejecutar(clienteId, tipo, ACTOR).then((d) => ({ clienteId, tipo, numero: d.numeroCorrelativo })));
          }
        }
      }
      const creados = await Promise.all(trabajos);

      for (const clienteId of [clienteA, clienteB]) {
        for (const tipo of ['INFORME', 'REPORTE']) {
          const numeros = creados.filter((c) => c.clienteId === clienteId && c.tipo === tipo).map((c) => c.numero).sort((a, b) => a - b);
          expect(numeros).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
        }
      }
      const codigos = await t.db.query('SELECT COUNT(DISTINCT codigo)::int AS n, COUNT(*)::int AS total FROM documentos');
      expect(codigos.rows[0]).toEqual({ n: 100, total: 100 });
    });

    it('los números del numerador puro tampoco se repiten con 80 llamadas simultáneas', async () => {
      const numeros = await Promise.all(Array.from({ length: 80 }, () => numerador.siguienteNumero(clienteA, 'INFORME')));
      expect([...numeros].sort((a, b) => a - b)).toEqual(Array.from({ length: 80 }, (_, i) => i + 1));
    });

    it('el certificado es una sola secuencia global: sin repetir entre clientes ni saltos', async () => {
      const numeros = await Promise.all(
        Array.from({ length: 40 }, (_, i) => crear.ejecutar(i % 2 === 0 ? clienteA : clienteB, 'CERTIFICADO', ACTOR)),
      );
      expect(numeros.map((d) => d.numeroCorrelativo).sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
      const dup = await t.db.query(
        `SELECT numero_correlativo FROM documentos WHERE tipo = 'CERTIFICADO' GROUP BY 1 HAVING COUNT(*) > 1`,
      );
      expect(dup.rows).toEqual([]);
    });

    it('la base impide dos certificados con el mismo número aunque sean de clientes distintos', async () => {
      const insertar = (clienteId: string, codigo: string) =>
        t.db.query(
          `INSERT INTO documentos (cliente_id, tipo, codigo, numero_correlativo) VALUES ($1, 'CERTIFICADO', $2, 1)`,
          [clienteId, codigo],
        );
      await insertar(clienteA, 'CERTIFICADO-001-2026');
      await expect(insertar(clienteB, 'CERTIFICADO-001-2026-B')).rejects.toMatchObject({ code: '23505' });
    });

    it('el contador no se reinicia con el año: el año solo cambia la etiqueta del código', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'queueMicrotask'], now: new Date('2026-12-31T15:00:00-05:00') });
      const a = await crear.ejecutar(clienteA, 'INFORME', ACTOR);
      jest.setSystemTime(new Date('2027-01-02T15:00:00-05:00'));
      const b = await crear.ejecutar(clienteA, 'INFORME', ACTOR);
      jest.useRealTimers();
      expect([a.codigo, b.codigo]).toEqual(['INFORME-KALLPA-001-2026', 'INFORME-KALLPA-002-2027']);
    });

    it('si falla el guardado, el número vuelve al contador y no deja hueco', async () => {
      const primero = await crear.ejecutar(clienteA, 'REPORTE', ACTOR);
      await expect(
        transaccion.ejecutar(async (ctx) => {
          await numerador.siguienteNumero(clienteA, 'REPORTE', ctx);
          throw new Error('falla simulada después de numerar');
        }),
      ).rejects.toThrow('falla simulada');
      const segundo = await crear.ejecutar(clienteA, 'REPORTE', ACTOR);
      expect([primero.numeroCorrelativo, segundo.numeroCorrelativo]).toEqual([1, 2]);
    });

    it('un cliente inexistente responde NotFound y no consume números', async () => {
      await expect(crear.ejecutar(randomUUID(), 'INFORME', ACTOR)).rejects.toThrow('no encontrado');
      const ok = await crear.ejecutar(clienteA, 'INFORME', ACTOR);
      expect(ok.numeroCorrelativo).toBe(1);
    });
  });

  describe('repositorio de documentos (GAF-47)', () => {
    it('guarda el documento con su código, actor y la transición inicial', async () => {
      const doc = await crear.ejecutar(clienteA, 'INFORME', ACTOR);
      const detalle = await obtener.ejecutar(doc.id);
      expect(detalle).toMatchObject({
        id: doc.id,
        codigo: expect.stringMatching(/^INFORME-KALLPA-001-\d{4}$/),
        cliente: 'Cliente KALLPA S.A.',
        proyecto: null,
        tipo: 'INFORME',
        estado: 'BORRADOR',
      });
      expect(detalle.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(detalle.transiciones).toHaveLength(1);
      expect(detalle.transiciones[0]).toMatchObject({ estadoAnterior: null, estadoNuevo: 'BORRADOR', actorUsuario: 'SUP.E2E', actorRol: 'SUPERVISOR' });
      const fila = await t.db.query('SELECT creado_por_id, creado_por_usuario FROM documentos WHERE id = $1', [doc.id]);
      expect(fila.rows[0]).toEqual({ creado_por_id: ACTOR.id, creado_por_usuario: 'SUP.E2E' });
    });

    it('cada transición se guarda en el historial y la lista filtra por estado', async () => {
      const a = await crear.ejecutar(clienteA, 'INFORME', ACTOR);
      const b = await crear.ejecutar(clienteB, 'REPORTE', ACTOR);
      await transicionar.ejecutar(a.id, 'CERRADO', ACTOR);
      await transicionar.ejecutar(a.id, 'ENVIADO_A_REVISION', ACTOR, 'Para revisión');

      const cola = await listar.ejecutar({ estado: 'ENVIADO_A_REVISION' });
      expect(cola.map((d) => d.id)).toEqual([a.id]);
      expect(await listar.ejecutar({})).toHaveLength(2);
      expect((await listar.ejecutar({ clienteId: clienteB })).map((d) => d.id)).toEqual([b.id]);
      expect((await listar.ejecutar({ tipo: 'REPORTE' })).map((d) => d.id)).toEqual([b.id]);

      const detalle = await obtener.ejecutar(a.id);
      expect(detalle.transiciones.map((x) => [x.estadoAnterior, x.estadoNuevo, x.motivo])).toEqual([
        [null, 'BORRADOR', null],
        ['BORRADOR', 'CERRADO', null],
        ['CERRADO', 'ENVIADO_A_REVISION', 'Para revisión'],
      ]);
    });

    it('una transición inválida no se guarda', async () => {
      const a = await crear.ejecutar(clienteA, 'INFORME', ACTOR);
      await expect(transicionar.ejecutar(a.id, 'APROBADO', ACTOR)).rejects.toThrow('No se puede pasar');
      const detalle = await obtener.ejecutar(a.id);
      expect(detalle.estado).toBe('BORRADOR');
      expect(detalle.transiciones).toHaveLength(1);
    });

    it('dos transiciones simultáneas sobre el mismo documento: una gana, la otra se rechaza', async () => {
      const a = await crear.ejecutar(clienteA, 'INFORME', ACTOR);
      const resultados = await Promise.allSettled([
        transicionar.ejecutar(a.id, 'CERRADO', ACTOR),
        transicionar.ejecutar(a.id, 'CERRADO', ACTOR),
      ]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
      const detalle = await obtener.ejecutar(a.id);
      expect(detalle.transiciones.filter((x) => x.estadoNuevo === 'CERRADO')).toHaveLength(1);
    });

    it('buscar un documento que no existe da NotFound', async () => {
      await expect(obtener.ejecutar(randomUUID())).rejects.toThrow('no encontrado');
    });
  });
});
