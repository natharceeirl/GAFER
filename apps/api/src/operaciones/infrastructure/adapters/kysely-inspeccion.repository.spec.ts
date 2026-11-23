import {
  CompiledQuery,
  DatabaseConnection,
  Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  QueryResult,
} from 'kysely';
import { ResumenServicioTecnicoSchema } from '@gafer/contracts';
import { GaferDatabase } from '../../../database/types';
import { KyselyInspeccionRepository } from './kysely-inspeccion.repository';

function crearKyselyMock(rowsToReturn: unknown[]) {
  const executed: Array<{ sql: string; parameters: readonly unknown[] }> = [];

  const connection: DatabaseConnection = {
    async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
      executed.push({ sql: compiledQuery.sql, parameters: compiledQuery.parameters });
      return { rows: rowsToReturn as R[] };
    },
    async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
      return;
    },
  };

  const driver: Driver = {
    async init() {},
    async acquireConnection() {
      return connection;
    },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {},
  };

  const db = new Kysely<GaferDatabase>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (d) => new PostgresIntrospector(d),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, executed };
}

describe('KyselyInspeccionRepository (F2, F3, F5, F7)', () => {
  const INSP_UUID = '11111111-1111-4111-8111-111111111111';
  const SRV_UUID = '22222222-2222-4222-8222-222222222222';
  const TEC_UUID = '33333333-3333-4333-8333-333333333333';

  const filaPostgres = {
    id: INSP_UUID,
    servicio_id: SRV_UUID,
    codigo_inspeccion: 'GAFER-2026-KALLPA-001',
    estado: 'CERRADO',
    version_sync: 2,
    fecha_ejecucion: new Date('2026-11-03T00:00:00.000Z'),
    hora_inicio: '08:30:00',
    hora_fin: '11:45:12.500',
    tecnicos_participantes: [{ id: TEC_UUID, nombre: 'Juan Perez' }],
    snapshot_catalogos: {
      insumos: [
        {
          insumoId: '44444444-4444-4444-8444-444444444444',
          nombreHistorico: 'Cipermetrina 25% CE',
          dosisAplicada: '5 ml/L',
          lote: 'L-2026-A',
          cantidadUtilizada: 2,
          unidadMedida: 'L',
        },
      ],
      equipos: [],
      fechaCierre: '2026-11-03T16:45:00.000Z',
    },
    cliente_razon_social: 'KALLPA GENERACIÓN S.A.',
    sede_nombre: 'CENTRAL_CHILCA',
    servicio_tipo: 'DRT',
  };

  it('listarPorTecnico filtra solo estado CERRADO, usa tecnicos_participantes JSONB sin snapshot_catalogos, hace JOIN y normaliza TIME a HH:mm', async () => {
    const { db, executed } = crearKyselyMock([filaPostgres]);
    const repo = new KyselyInspeccionRepository(db);

    const resultados = await repo.listarPorTecnico(TEC_UUID);

    expect(executed).toHaveLength(1);
    const { sql, parameters } = executed[0];
    expect(sql).toContain('"inspecciones"."estado" = $1');
    expect(sql).toContain('inspecciones.tecnicos_participantes @> jsonb_build_array');
    expect(sql).not.toContain('position(');
    expect(sql).not.toContain('snapshot_catalogos::text');
    expect(sql).toContain('left join "servicios_contratados"');
    expect(sql).toContain('left join "proyectos"');
    expect(sql).toContain('left join "clientes"');
    expect(parameters).toEqual(['CERRADO', TEC_UUID]);

    expect(resultados).toHaveLength(1);
    const insp = resultados[0];
    expect(insp.fechaEjecucion).toBe('2026-11-03');
    expect(insp.horaInicio).toBe('08:30');
    expect(insp.horaFin).toBe('11:45');
    expect(insp.clienteRazonSocial).toBe('KALLPA GENERACIÓN S.A.');
    expect(insp.sedeNombre).toBe('CENTRAL_CHILCA');
    expect(insp.servicioTipo).toBe('DRT');

    // Contrato real validado contra ResumenServicioTecnicoSchema
    const resumen = ResumenServicioTecnicoSchema.parse({
      id: insp.id,
      servicioId: insp.servicioId,
      codigoInspeccion: insp.codigoInspeccion,
      estado: insp.getEstado(),
      versionSync: insp.getVersionSync(),
      fechaEjecucion: insp.fechaEjecucion,
      horaInicio: insp.horaInicio,
      horaFin: insp.horaFin,
      tecnicosParticipantes: insp.tecnicosParticipantes,
      puedeSolicitarCorreccion: insp.getEstado() === 'CERRADO',
      clienteRazonSocial: insp.clienteRazonSocial,
      sedeNombre: insp.sedeNombre,
      servicioTipo: insp.servicioTipo,
      snapshotCatalogos: insp.getSnapshot(),
    });
    expect(resumen.horaInicio).toBe('08:30');
    expect(resumen.horaFin).toBe('11:45');
  });

  it('listarTodas filtra solo estado CERRADO e incluye JOIN de cliente, sede y tipo de servicio', async () => {
    const { db, executed } = crearKyselyMock([filaPostgres]);
    const repo = new KyselyInspeccionRepository(db);

    const resultados = await repo.listarTodas();

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('"inspecciones"."estado" = $1');
    expect(executed[0].sql).toContain('left join "servicios_contratados"');
    expect(executed[0].sql).toContain('left join "proyectos"');
    expect(executed[0].sql).toContain('left join "clientes"');
    expect(executed[0].parameters).toEqual(['CERRADO']);
    expect(resultados[0].clienteRazonSocial).toBe('KALLPA GENERACIÓN S.A.');
    expect(resultados[0].horaInicio).toBe('08:30');
  });

  it('buscarPorId recorta segundos de TIME (HH:mm:ss) y soporta hora nula', async () => {
    const { db } = crearKyselyMock([
      {
        ...filaPostgres,
        hora_inicio: '07:05:59',
        hora_fin: null,
      },
    ]);
    const repo = new KyselyInspeccionRepository(db);

    const insp = await repo.buscarPorId(INSP_UUID);

    expect(insp).not.toBeNull();
    expect(insp?.horaInicio).toBe('07:05');
    expect(insp?.horaFin).toBeNull();
  });
});
