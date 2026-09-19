import { MantenimientoController } from './mantenimiento.controller';
import { RegistrarClienteUseCase } from '../application/registrar-cliente.usecase';
import { RegistrarProyectoUseCase } from '../application/registrar-proyecto.usecase';
import { RegistrarServicioContratadoUseCase } from '../application/registrar-servicio-contratado.usecase';
import { RegistrarInsumoUseCase } from '../application/registrar-insumo.usecase';
import { RegistrarEquipoUseCase } from '../application/registrar-equipo.usecase';
import { RegistrarPersonalUseCase } from '../application/registrar-personal.usecase';
import { ClienteRepository } from '../domain/ports/cliente.repository';
import { ProyectoRepository } from '../domain/ports/proyecto.repository';
import { ServicioContratadoRepository } from '../domain/ports/servicio-contratado.repository';
import { InsumoRepository } from '../domain/ports/insumo.repository';
import { EquipoRepository } from '../domain/ports/equipo.repository';
import { PersonalRepository } from '../domain/ports/personal.repository';
import { S3StorageService } from '../../shared/infrastructure/storage/s3-storage.service';
import { Cliente } from '../domain/cliente';
import { Insumo } from '../domain/insumo';

describe('MantenimientoController', () => {
  let controller: MantenimientoController;
  let mockClienteUseCase: jest.Mocked<RegistrarClienteUseCase>;
  let mockProyectoUseCase: jest.Mocked<RegistrarProyectoUseCase>;
  let mockServicioUseCase: jest.Mocked<RegistrarServicioContratadoUseCase>;
  let mockInsumoUseCase: jest.Mocked<RegistrarInsumoUseCase>;
  let mockEquipoUseCase: jest.Mocked<RegistrarEquipoUseCase>;
  let mockPersonalUseCase: jest.Mocked<RegistrarPersonalUseCase>;

  let mockClienteRepo: jest.Mocked<ClienteRepository>;
  let mockProyectoRepo: jest.Mocked<ProyectoRepository>;
  let mockServicioRepo: jest.Mocked<ServicioContratadoRepository>;
  let mockInsumoRepo: jest.Mocked<InsumoRepository>;
  let mockEquipoRepo: jest.Mocked<EquipoRepository>;
  let mockPersonalRepo: jest.Mocked<PersonalRepository>;
  let mockStorageService: jest.Mocked<S3StorageService>;

  beforeEach(() => {
    mockClienteUseCase = { execute: jest.fn() } as any;
    mockProyectoUseCase = { execute: jest.fn() } as any;
    mockServicioUseCase = { execute: jest.fn() } as any;
    mockInsumoUseCase = { execute: jest.fn() } as any;
    mockEquipoUseCase = { execute: jest.fn() } as any;
    mockPersonalUseCase = { execute: jest.fn() } as any;

    mockClienteRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorRuc: jest.fn(),
      buscarPorCodigoCorto: jest.fn(),
      listarTodos: jest.fn(),
    };
    mockProyectoRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorClienteId: jest.fn(),
      buscarPorClienteYNombre: jest.fn(),
    };
    mockServicioRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorProyectoId: jest.fn(),
    };
    mockInsumoRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorDigesa: jest.fn(),
      listarActivos: jest.fn(),
    };
    mockEquipoRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorCodigoInterno: jest.fn(),
      listarOperativos: jest.fn(),
      listarTodos: jest.fn(),
    };
    mockPersonalRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorDni: jest.fn(),
      buscarPorUsuario: jest.fn(),
      listarActivos: jest.fn(),
    };
    mockStorageService = {
      getBucketName: jest.fn().mockReturnValue('gafer-test-bucket'),
      generarPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.gafer.pe/upload?signed=1'),
      generarPresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.gafer.pe/download?signed=1'),
      subirBuffer: jest.fn(),
    } as any;

    controller = new MantenimientoController(
      mockClienteUseCase,
      mockProyectoUseCase,
      mockServicioUseCase,
      mockInsumoUseCase,
      mockEquipoUseCase,
      mockPersonalUseCase,
      mockClienteRepo,
      mockProyectoRepo,
      mockServicioRepo,
      mockInsumoRepo,
      mockEquipoRepo,
      mockPersonalRepo,
      mockStorageService,
    );
  });

  describe('Clientes Endpoints', () => {
    it('debe registrar un cliente a través del use case', async () => {
      const mockCliente = new Cliente({
        id: 'c-1',
        razonSocial: 'Kallpa Generacion',
        ruc: '20508565434',
        codigoCorto: 'KALLPA',
        direccionFiscal: 'Mollendo',
        giroNegocio: 'Energia',
        contactoNombre: 'Carlos',
        contactoCargo: 'Jefe',
        contactoTelefono: '958123456',
        contactoCorreo: 'carlos@kallpa.pe',
      });
      mockClienteUseCase.execute.mockResolvedValue(mockCliente);

      const res = await controller.crearCliente({
        razonSocial: 'Kallpa Generacion',
        ruc: '20508565434',
        codigoCorto: 'KALLPA',
        direccionFiscal: 'Mollendo',
        giroNegocio: 'Energia',
        contactoNombre: 'Carlos',
        contactoCargo: 'Jefe',
        contactoTelefono: '958123456',
        contactoCorreo: 'carlos@kallpa.pe',
      });

      expect(res.id).toBe('c-1');
      expect(res.ruc).toBe('20508565434');
      expect(res.estado).toBe('ACTIVO');
    });

    it('debe listar clientes registrados', async () => {
      mockClienteRepo.listarTodos.mockResolvedValue([]);
      const res = await controller.listarClientes();
      expect(res).toEqual([]);
      expect(mockClienteRepo.listarTodos).toHaveBeenCalledTimes(1);
    });
  });

  describe('Insumos Endpoints', () => {
    it('debe registrar un insumo químico', async () => {
      const mockInsumo = new Insumo({
        id: 'ins-1',
        nombreComercial: 'Cipermetrina 25%',
        principioActivo: 'Cipermetrina',
        presentacion: 'LIQUIDO',
        unidadMedida: 'L',
        registroDigesa: 'RD-1425',
        concentracion: '25%',
        dosisEstandar: '5 ml/L',
        fichaTecnicaKey: 'fichas/ciper.pdf',
        hojaMsdsKey: 'msds/ciper.pdf',
      });
      mockInsumoUseCase.execute.mockResolvedValue(mockInsumo);

      const res = await controller.crearInsumo({
        nombreComercial: 'Cipermetrina 25%',
        principioActivo: 'Cipermetrina',
        presentacion: 'LIQUIDO',
        unidadMedida: 'L',
        registroDigesa: 'RD-1425',
        concentracion: '25%',
        dosisEstandar: '5 ml/L',
        fichaTecnicaKey: 'fichas/ciper.pdf',
        hojaMsdsKey: 'msds/ciper.pdf',
      });

      expect(res.id).toBe('ins-1');
      expect(res.registroDigesa).toBe('RD-1425');
    });

    it('debe listar insumos activos', async () => {
      mockInsumoRepo.listarActivos.mockResolvedValue([]);
      const res = await controller.listarInsumos();
      expect(res).toEqual([]);
      expect(mockInsumoRepo.listarActivos).toHaveBeenCalledTimes(1);
    });
  });

  describe('Storage Endpoints', () => {
    it('debe generar presigned upload URL', async () => {
      const res = await controller.generarUploadUrl({
        key: 'fichas/cipermetrina.pdf',
        contentType: 'application/pdf',
      });

      expect(res.uploadUrl).toBe('https://s3.gafer.pe/upload?signed=1');
      expect(res.bucket).toBe('gafer-test-bucket');
    });

    it('debe generar presigned download URL', async () => {
      const res = await controller.generarDownloadUrl({
        key: 'fichas/cipermetrina.pdf',
      });

      expect(res.downloadUrl).toBe('https://s3.gafer.pe/download?signed=1');
    });
  });
});
