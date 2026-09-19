import { CerrarInspeccionUseCase } from './application/cerrar-inspeccion.usecase';
import { Inspeccion } from './domain/inspeccion';
import { InspeccionRepository } from './domain/ports/inspeccion.repository';
import { Insumo } from '../mantenimiento/domain/insumo';
import { InsumoRepository } from '../mantenimiento/domain/ports/insumo.repository';

describe('Sección 13: Regla de Inmutabilidad Contractual (T2.3)', () => {
  let inspeccionRepo: InspeccionRepository;
  let insumoRepo: InsumoRepository;
  let cerrarUseCase: CerrarInspeccionUseCase;

  // In-memory stores for unit/integration simulation
  let inspeccionesMap: Map<string, Inspeccion>;
  let insumosMap: Map<string, Insumo>;

  beforeEach(() => {
    inspeccionesMap = new Map();
    insumosMap = new Map();

    inspeccionRepo = {
      guardar: jest.fn(async (insp: Inspeccion) => {
        inspeccionesMap.set(insp.id, insp);
      }),
      buscarPorId: jest.fn(async (id: string) => inspeccionesMap.get(id) ?? null),
    };

    insumoRepo = {
      guardar: jest.fn(async (insumo: Insumo) => {
        insumosMap.set(insumo.id, insumo);
      }),
      buscarPorId: jest.fn(async (id: string) => insumosMap.get(id) ?? null),
      buscarPorDigesa: jest.fn(async (digesa: string) => {
        for (const item of insumosMap.values()) {
          if (item.registroDigesa === digesa) return item;
        }
        return null;
      }),
      listarActivos: jest.fn(async () => Array.from(insumosMap.values())),
    };

    cerrarUseCase = new CerrarInspeccionUseCase(inspeccionRepo, insumoRepo);
  });

  it('debe congelar un snapshot inmutable del catálogo al cerrar la inspección', async () => {
    // 1. Insumo registrado en el catálogo maestro
    const insumoOriginal = new Insumo({
      id: 'insumo-001',
      nombreComercial: 'Cipermetrina 25% CE',
      principioActivo: 'Cipermetrina',
      presentacion: 'LIQUIDO',
      unidadMedida: 'L',
      registroDigesa: 'RD-1425-2024/DIGESA/SA',
      concentracion: '25% p/v',
      dosisEstandar: '5 ml/L',
      fichaTecnicaKey: 'insumos/fichas/cipermetrina-25.pdf',
      hojaMsdsKey: 'insumos/msds/cipermetrina-25.pdf',
    });
    await insumoRepo.guardar(insumoOriginal);

    // 2. Inspección abierta en estado BORRADOR
    const inspeccion = new Inspeccion({
      id: 'insp-001',
      servicioId: 'serv-001',
      codigoInspeccion: 'GAFER-2026-KALLPA-001',
      fechaEjecucion: '2026-09-19',
    });
    await inspeccionRepo.guardar(inspeccion);

    expect(inspeccion.getEstado()).toBe('BORRADOR');
    expect(inspeccion.getSnapshot()).toEqual({});

    // 3. Ejecución del servicio y cierre con consumo del insumo
    const inspeccionCerrada = await cerrarUseCase.execute({
      inspeccionId: 'insp-001',
      consumos: [
        {
          insumoId: 'insumo-001',
          dosisAplicada: '7.5 ml/L',
          lote: 'LOTE-2026-A1',
          cantidadUtilizada: 2.5,
        },
      ],
    });

    expect(inspeccionCerrada.getEstado()).toBe('CERRADO');
    expect(inspeccionCerrada.getVersionSync()).toBe(2);

    const snapshot = inspeccionCerrada.getSnapshot() as {
      insumos: Array<{
        insumoId: string;
        nombreHistorico: string;
        principioActivo: string;
        registroDigesa: string;
        dosisAplicada: string;
        lote: string;
        cantidadUtilizada: number;
      }>;
      fechaCierre: string;
    };

    expect(snapshot.insumos).toHaveLength(1);
    expect(snapshot.insumos[0].nombreHistorico).toBe('Cipermetrina 25% CE');
    expect(snapshot.insumos[0].registroDigesa).toBe('RD-1425-2024/DIGESA/SA');
    expect(snapshot.insumos[0].dosisAplicada).toBe('7.5 ml/L');
    expect(snapshot.insumos[0].lote).toBe('LOTE-2026-A1');
    expect(snapshot.insumos[0].cantidadUtilizada).toBe(2.5);

    // 4. PRUEBA DE INMUTABILIDAD: El catálogo maestro muta o se actualiza en el futuro
    const insumoMutado = new Insumo({
      id: 'insumo-001',
      nombreComercial: 'Cipermetrina 50% Ultra Concentrada (REFORMULADO 2028)',
      principioActivo: 'Cipermetrina Pura',
      presentacion: 'LIQUIDO',
      unidadMedida: 'L',
      registroDigesa: 'RD-9999-2028/DIGESA/SA',
      concentracion: '50% p/v',
      dosisEstandar: '2.5 ml/L',
      fichaTecnicaKey: 'insumos/fichas/cipermetrina-50.pdf',
      hojaMsdsKey: 'insumos/msds/cipermetrina-50.pdf',
    });
    await insumoRepo.guardar(insumoMutado);

    // 5. Verificar que la inspección histórica NO fue alterada por el cambio en el catálogo
    const inspeccionRecuperada = await inspeccionRepo.buscarPorId('insp-001');
    expect(inspeccionRecuperada).not.toBeNull();

    const snapshotHistorico = inspeccionRecuperada!.getSnapshot() as typeof snapshot;
    expect(snapshotHistorico.insumos[0].nombreHistorico).toBe('Cipermetrina 25% CE');
    expect(snapshotHistorico.insumos[0].registroDigesa).toBe('RD-1425-2024/DIGESA/SA');
    expect(snapshotHistorico.insumos[0].nombreHistorico).not.toBe(
      'Cipermetrina 50% Ultra Concentrada (REFORMULADO 2028)',
    );
    expect(snapshotHistorico.insumos[0].registroDigesa).not.toBe(
      'RD-9999-2028/DIGESA/SA',
    );
  });

  it('no debe permitir cerrar una inspección ya cerrada (bloqueo contra ediciones)', async () => {
    const inspeccion = new Inspeccion({
      id: 'insp-002',
      servicioId: 'serv-001',
      codigoInspeccion: 'GAFER-2026-KALLPA-002',
      fechaEjecucion: '2026-09-19',
    });
    await inspeccionRepo.guardar(inspeccion);

    await cerrarUseCase.execute({ inspeccionId: 'insp-002' });

    // Segundo intento debe lanzar error de dominio
    await expect(
      cerrarUseCase.execute({ inspeccionId: 'insp-002' }),
    ).rejects.toThrow('La inspección ya está cerrada y bloqueada contra ediciones');
  });

  it('debe arrojar NotFoundException si la inspección a cerrar no existe', async () => {
    await expect(
      cerrarUseCase.execute({ inspeccionId: 'inexistente-123' }),
    ).rejects.toThrow('Inspección inexistente-123 no encontrada');
  });
});
