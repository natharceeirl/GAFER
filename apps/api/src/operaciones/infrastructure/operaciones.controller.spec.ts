import { OperacionesController } from './operaciones.controller';
import { RegistrarInspeccionUseCase } from '../application/registrar-inspeccion.usecase';
import { CerrarInspeccionUseCase } from '../application/cerrar-inspeccion.usecase';
import { ObtenerInspeccionUseCase } from '../application/obtener-inspeccion.usecase';
import { Inspeccion } from '../domain/inspeccion';

describe('OperacionesController', () => {
  let controller: OperacionesController;
  let mockRegistrar: jest.Mocked<RegistrarInspeccionUseCase>;
  let mockCerrar: jest.Mocked<CerrarInspeccionUseCase>;
  let mockObtener: jest.Mocked<ObtenerInspeccionUseCase>;

  beforeEach(() => {
    mockRegistrar = { ejecutar: jest.fn() } as any;
    mockCerrar = { execute: jest.fn() } as any;
    mockObtener = {
      ejecutarPorId: jest.fn(),
      ejecutarPorServicioId: jest.fn(),
    } as any;

    controller = new OperacionesController(
      mockRegistrar,
      mockCerrar,
      mockObtener,
    );
  });

  it('debe registrar una inspección en borrador', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    mockRegistrar.ejecutar.mockResolvedValue(inspeccion);

    const res = await controller.crear({ servicioId: 'srv-1' });

    expect(res.id).toBe('insp-1');
    expect(res.estado).toBe('BORRADOR');
    expect(mockRegistrar.ejecutar).toHaveBeenCalledWith('srv-1');
  });

  it('debe consultar una inspección por servicioId (usado por frontend web)', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    mockObtener.ejecutarPorServicioId.mockResolvedValue(inspeccion);

    const res = await controller.consultar('srv-1');

    expect(res).not.toBeNull();
    expect(res?.id).toBe('insp-1');
    expect(res?.servicioId).toBe('srv-1');
    expect(mockObtener.ejecutarPorServicioId).toHaveBeenCalledWith('srv-1');
  });

  it('debe retornar null al consultar con servicioId sin inspección activa', async () => {
    mockObtener.ejecutarPorServicioId.mockResolvedValue(null);

    const res = await controller.consultar('srv-inactivo');

    expect(res).toBeNull();
  });

  it('debe obtener el detalle de una inspección por ID con snapshot inmutable', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    inspeccion.cerrar({
      insumos: [
        {
          insumoId: 'ins-1',
          nombreHistorico: 'Cipermetrina',
          principioActivo: 'Cipermetrina',
          presentacion: 'L',
          unidadMedida: 'L',
          registroDigesa: 'RD-001',
          concentracion: '25%',
          dosisAplicada: '5ml',
          lote: 'L-1',
          cantidadUtilizada: 1,
          congeladoEn: '2026-09-19T00:00:00.000Z',
        },
      ],
      fechaCierre: '2026-09-19T00:00:00.000Z',
    });
    mockObtener.ejecutarPorId.mockResolvedValue(inspeccion);

    const res = await controller.obtenerPorId('insp-1');

    expect(res.id).toBe('insp-1');
    expect(res.estado).toBe('CERRADO');
    expect(res.snapshotCatalogos.insumos).toHaveLength(1);
    expect(res.snapshotCatalogos.insumos[0].nombreHistorico).toBe('Cipermetrina');
  });

  it('debe cerrar la inspección y retornar snapshot congelado', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    inspeccion.cerrar([]);
    mockCerrar.execute.mockResolvedValue(inspeccion);

    const res = await controller.cerrar('insp-1');

    expect(res.id).toBe('insp-1');
    expect(res.estado).toBe('CERRADO');
    expect(mockCerrar.execute).toHaveBeenCalledWith({
      inspeccionId: 'insp-1',
      consumos: undefined,
    });
  });
});
