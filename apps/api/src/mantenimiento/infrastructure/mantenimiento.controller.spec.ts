import { MantenimientoController } from './mantenimiento.controller';
import { RegistrarClienteUseCase } from '../application/registrar-cliente.usecase';
import { ActualizarClienteUseCase } from '../application/actualizar-cliente.usecase';
import { DesactivarClienteUseCase } from '../application/desactivar-cliente.usecase';
import { ActivarClienteUseCase } from '../application/activar-cliente.usecase';
import { RegistrarProyectoUseCase } from '../application/registrar-proyecto.usecase';
import { RegistrarServicioContratadoUseCase } from '../application/registrar-servicio-contratado.usecase';
import { RegistrarInsumoUseCase } from '../application/registrar-insumo.usecase';
import { DesactivarInsumoUseCase } from '../application/desactivar-insumo.usecase';
import { RegistrarEquipoUseCase } from '../application/registrar-equipo.usecase';
import { ActualizarEstadoEquipoUseCase } from '../application/actualizar-estado-equipo.usecase';
import { RegistrarPersonalUseCase } from '../application/registrar-personal.usecase';
import { DesactivarPersonalUseCase } from '../application/desactivar-personal.usecase';

import { ClienteRepository } from '../domain/ports/cliente.repository';
import { ProyectoRepository } from '../domain/ports/proyecto.repository';
import { ServicioContratadoRepository } from '../domain/ports/servicio-contratado.repository';
import { InsumoRepository } from '../domain/ports/insumo.repository';
import { EquipoRepository } from '../domain/ports/equipo.repository';
import { PersonalRepository } from '../domain/ports/personal.repository';
import { S3StorageService } from '../../shared/infrastructure/storage/s3-storage.service';
import { Cliente } from '../domain/cliente';
import { Proyecto } from '../domain/proyecto';
import { ServicioContratado } from '../domain/servicio-contratado';
import { Insumo } from '../domain/insumo';
import { Equipo } from '../domain/equipo';

describe('MantenimientoController', () => {
  let controller: MantenimientoController;

  // Use Cases Mocks
  let mockClienteUseCase: jest.Mocked<RegistrarClienteUseCase>;
  let mockActualizarClienteUseCase: jest.Mocked<ActualizarClienteUseCase>;
  let mockDesactivarClienteUseCase: jest.Mocked<DesactivarClienteUseCase>;
  let mockActivarClienteUseCase: jest.Mocked<ActivarClienteUseCase>;
  let mockProyectoUseCase: jest.Mocked<RegistrarProyectoUseCase>;
  let mockActualizarProyectoUseCase: jest.Mocked<any>;
  let mockActivarProyectoUseCase: jest.Mocked<any>;
  let mockDesactivarProyectoUseCase: jest.Mocked<any>;
  let mockServicioUseCase: jest.Mocked<RegistrarServicioContratadoUseCase>;
  let mockActualizarServicioUseCase: jest.Mocked<any>;
  let mockActivarServicioUseCase: jest.Mocked<any>;
  let mockDesactivarServicioUseCase: jest.Mocked<any>;
  let mockInsumoUseCase: jest.Mocked<RegistrarInsumoUseCase>;
  let mockActualizarInsumoUseCase: jest.Mocked<any>;
  let mockDesactivarInsumoUseCase: jest.Mocked<DesactivarInsumoUseCase>;
  let mockEquipoUseCase: jest.Mocked<RegistrarEquipoUseCase>;
  let mockActualizarEstadoEquipoUseCase: jest.Mocked<ActualizarEstadoEquipoUseCase>;
  let mockPersonalUseCase: jest.Mocked<RegistrarPersonalUseCase>;
  let mockDesactivarPersonalUseCase: jest.Mocked<DesactivarPersonalUseCase>;

  // Repositories Mocks
  let mockClienteRepo: jest.Mocked<ClienteRepository>;
  let mockProyectoRepo: jest.Mocked<ProyectoRepository>;
  let mockServicioRepo: jest.Mocked<ServicioContratadoRepository>;
  let mockInsumoRepo: jest.Mocked<InsumoRepository>;
  let mockEquipoRepo: jest.Mocked<EquipoRepository>;
  let mockPersonalRepo: jest.Mocked<PersonalRepository>;
  let mockStorageService: jest.Mocked<S3StorageService>;

  beforeEach(() => {
    mockClienteUseCase = { execute: jest.fn() } as any;
    mockActualizarClienteUseCase = { execute: jest.fn() } as any;
    mockDesactivarClienteUseCase = { execute: jest.fn() } as any;
    mockActivarClienteUseCase = { execute: jest.fn() } as any;
    mockProyectoUseCase = { execute: jest.fn() } as any;
    mockActualizarProyectoUseCase = { execute: jest.fn() } as any;
    mockActivarProyectoUseCase = { execute: jest.fn() } as any;
    mockDesactivarProyectoUseCase = { execute: jest.fn() } as any;
    mockServicioUseCase = { execute: jest.fn() } as any;
    mockActualizarServicioUseCase = { execute: jest.fn() } as any;
    mockActivarServicioUseCase = { execute: jest.fn() } as any;
    mockDesactivarServicioUseCase = { execute: jest.fn() } as any;
    mockInsumoUseCase = { execute: jest.fn() } as any;
    mockActualizarInsumoUseCase = { execute: jest.fn() } as any;
    mockDesactivarInsumoUseCase = { execute: jest.fn() } as any;
    mockEquipoUseCase = { execute: jest.fn() } as any;
    mockActualizarEstadoEquipoUseCase = { execute: jest.fn() } as any;
    mockPersonalUseCase = { execute: jest.fn() } as any;
    mockDesactivarPersonalUseCase = { execute: jest.fn() } as any;

    mockClienteRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorRuc: jest.fn(),
      buscarPorCodigoCorto: jest.fn(),
      listarTodos: jest.fn().mockResolvedValue([]),
    };
    mockProyectoRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorClienteId: jest.fn().mockResolvedValue([]),
      buscarPorClienteYNombre: jest.fn(),
    };
    mockServicioRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorProyectoId: jest.fn().mockResolvedValue([]),
    };
    mockInsumoRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorDigesa: jest.fn(),
      listarActivos: jest.fn().mockResolvedValue([]),
    };
    mockEquipoRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorCodigoInterno: jest.fn(),
      listarOperativos: jest.fn(),
      listarTodos: jest.fn().mockResolvedValue([]),
    };
    mockPersonalRepo = {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorDni: jest.fn(),
      buscarPorUsuario: jest.fn(),
      listarActivos: jest.fn().mockResolvedValue([]),
    };
    mockStorageService = {
      getBucketName: jest.fn().mockReturnValue('gafer-test-bucket'),
      generarPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.gafer.pe/upload?signed=1'),
      generarPresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.gafer.pe/download?signed=1'),
      subirBuffer: jest.fn(),
    } as any;

    controller = new MantenimientoController(
      mockClienteUseCase,
      mockActualizarClienteUseCase,
      mockDesactivarClienteUseCase,
      mockActivarClienteUseCase,
      mockProyectoUseCase,
      mockActualizarProyectoUseCase,
      mockActivarProyectoUseCase,
      mockDesactivarProyectoUseCase,
      mockServicioUseCase,
      mockActualizarServicioUseCase,
      mockActivarServicioUseCase,
      mockDesactivarServicioUseCase,
      mockInsumoUseCase,
      mockActualizarInsumoUseCase,
      mockDesactivarInsumoUseCase,
      mockEquipoUseCase,
      mockActualizarEstadoEquipoUseCase,
      mockPersonalUseCase,
      mockDesactivarPersonalUseCase,
      mockClienteRepo,
      mockProyectoRepo,
      mockServicioRepo,
      mockInsumoRepo,
      mockEquipoRepo,
      mockPersonalRepo,
      mockStorageService,
    );
  });

  describe('Clientes Endpoints & Ciclo de Vida', () => {
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

    it('debe listar clientes con paginación', async () => {
      mockClienteRepo.listarTodos.mockResolvedValue([]);
      const res = await controller.listarClientes({ limit: 10, offset: 0 });
      expect(res.total).toBe(0);
      expect(res.items).toEqual([]);
      expect(mockClienteRepo.listarTodos).toHaveBeenCalledTimes(1);
    });

    it('debe actualizar datos de un cliente existente', async () => {
      const clienteActualizado = new Cliente({
        id: 'c-1',
        razonSocial: 'Kallpa Generacion S.A.C.',
        ruc: '20508565434',
        codigoCorto: 'KALLPA',
        direccionFiscal: 'Nueva Direccion 123',
        giroNegocio: 'Energia',
        contactoNombre: 'Carlos',
        contactoCargo: 'Jefe',
        contactoTelefono: '958123456',
        contactoCorreo: 'carlos@kallpa.pe',
      });
      mockActualizarClienteUseCase.execute.mockResolvedValue(clienteActualizado);

      const res = await controller.actualizarCliente('c-1', {
        razonSocial: 'Kallpa Generacion S.A.C.',
        direccionFiscal: 'Nueva Direccion 123',
      });

      expect(res.razonSocial).toBe('Kallpa Generacion S.A.C.');
      expect(res.direccionFiscal).toBe('Nueva Direccion 123');
    });

    it('debe desactivar un cliente', async () => {
      const clienteInactivo = new Cliente({
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
        estado: 'INACTIVO',
      });
      mockDesactivarClienteUseCase.execute.mockResolvedValue(clienteInactivo);

      const res = await controller.desactivarCliente('c-1');
      expect(res.estado).toBe('INACTIVO');
    });
  });

  describe('Proyectos / Sedes Endpoints', () => {
    it('debe registrar un proyecto y retornar los campos completos', async () => {
      const mockProyecto = new Proyecto({
        id: 'p-1',
        clienteId: 'c-1',
        nombre: 'PLANTA_SUR',
        direccionSede: 'Carretera Costanera Km 12',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Mario Vargas',
        contactoCargo: 'Supervisor de Planta',
        contactoTelefono: '954987654',
        observaciones: 'EPP obligatorio',
      });
      mockProyectoUseCase.execute.mockResolvedValue(mockProyecto);

      const res = await controller.crearProyecto({
        clienteId: 'c-1',
        nombre: 'PLANTA_SUR',
        direccionSede: 'Carretera Costanera Km 12',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Mario Vargas',
        contactoCargo: 'Supervisor de Planta',
        contactoTelefono: '954987654',
        observaciones: 'EPP obligatorio',
      });

      expect(res.id).toBe('p-1');
      expect(res.contactoCargo).toBe('Supervisor de Planta');
      expect(res.observaciones).toBe('EPP obligatorio');
    });

    it('debe obtener un proyecto por ID', async () => {
      const mockProyecto = new Proyecto({
        id: 'p-1',
        clienteId: 'c-1',
        nombre: 'PLANTA_SUR',
        direccionSede: 'Carretera Costanera Km 12',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Mario Vargas',
        contactoCargo: 'Supervisor de Planta',
        contactoTelefono: '954987654',
      });
      mockProyectoRepo.buscarPorId.mockResolvedValue(mockProyecto);

      const res = await controller.obtenerProyecto('p-1');
      expect(res.id).toBe('p-1');
      expect(res.nombre).toBe('PLANTA_SUR');
    });

    it('debe actualizar un proyecto', async () => {
      const mockProyecto = new Proyecto({
        id: 'p-1',
        clienteId: 'c-1',
        nombre: 'PLANTA_SUR_MOD',
        direccionSede: 'Carretera Costanera Km 14',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Mario Vargas Peña',
        contactoCargo: 'Jefe de Planta',
        contactoTelefono: '954999888',
      });
      mockActualizarProyectoUseCase.execute.mockResolvedValue(mockProyecto);

      const res = await controller.actualizarProyecto('p-1', {
        nombre: 'PLANTA_SUR_MOD',
      });
      expect(res.nombre).toBe('PLANTA_SUR_MOD');
    });
  });

  describe('Servicios Contratados Endpoints', () => {
    it('debe registrar un servicio contratado incluyendo insumos, equipos y dosis', async () => {
      const { ServicioContratado } = await import('../domain/servicio-contratado');
      const mockServicio = new ServicioContratado({
        id: 's-1',
        proyectoId: 'p-1',
        tipoServicio: 'DSF',
        frecuencia: 'MENSUAL',
        areaTotalM2: 5000,
        areaTratarM2: 3500,
        insumosAutorizados: ['i-1'],
        equiposAutorizados: ['e-1'],
        dosisReferencial: { 'i-1': '5 ml / Litro' },
        requiereCertificado: true,
        vigenciaDias: 30,
      });
      mockServicioUseCase.execute.mockResolvedValue(mockServicio);

      const res = await controller.crearServicioContratado({
        proyectoId: 'p-1',
        tipoServicio: 'DSF',
        frecuencia: 'MENSUAL',
        areaTotalM2: 5000,
        areaTratarM2: 3500,
        insumosAutorizados: ['i-1'],
        equiposAutorizados: ['e-1'],
        dosisReferencial: { 'i-1': '5 ml / Litro' },
        requiereCertificado: true,
        vigenciaDias: 30,
      });

      expect(res.id).toBe('s-1');
      expect(res.insumosAutorizados).toEqual(['i-1']);
      expect(res.equiposAutorizados).toEqual(['e-1']);
      expect(res.dosisReferencial).toEqual({ 'i-1': '5 ml / Litro' });
    });

    it('debe obtener un servicio contratado por ID con insumos, equipos y dosis', async () => {
      const { ServicioContratado } = await import('../domain/servicio-contratado');
      const mockServicio = new ServicioContratado({
        id: 's-1',
        proyectoId: 'p-1',
        tipoServicio: 'DRT',
        frecuencia: 'QUINCENAL',
        areaTotalM2: 1000,
        areaTratarM2: 500,
        insumosAutorizados: ['i-2'],
        equiposAutorizados: ['e-2'],
        dosisReferencial: { 'i-2': '1 bloque' },
      });
      mockServicioRepo.buscarPorId.mockResolvedValue(mockServicio);

      const res = await controller.obtenerServicioContratado('s-1');
      expect(res.id).toBe('s-1');
      expect(res.tipoServicio).toBe('DRT');
      expect(res.insumosAutorizados).toEqual(['i-2']);
      expect(res.dosisReferencial).toEqual({ 'i-2': '1 bloque' });
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
      const res = await controller.listarInsumos({ limit: 10, offset: 0 });
      expect(res.items).toEqual([]);
      expect(mockInsumoRepo.listarActivos).toHaveBeenCalledTimes(1);
    });

    it('debe actualizar un insumo a través del use case', async () => {
      const insumoActualizado = new Insumo({
        id: 'ins-1',
        nombreComercial: 'Cipermetrina 50%',
        principioActivo: 'Cipermetrina',
        presentacion: 'LIQUIDO',
        unidadMedida: 'L',
        registroDigesa: 'RD-9999',
        concentracion: '50%',
        dosisEstandar: '2.5 ml/L',
        fichaTecnicaKey: 'fichas/ciper50.pdf',
        hojaMsdsKey: 'msds/ciper50.pdf',
        estado: 'ACTIVO',
      });
      mockActualizarInsumoUseCase.execute.mockResolvedValue(insumoActualizado);

      const res = await controller.actualizarInsumo('ins-1', {
        nombreComercial: 'Cipermetrina 50%',
        concentracion: '50%',
      });

      expect(res.nombreComercial).toBe('Cipermetrina 50%');
      expect(mockActualizarInsumoUseCase.execute).toHaveBeenCalledWith({
        id: 'ins-1',
        nombreComercial: 'Cipermetrina 50%',
        concentracion: '50%',
      });
    });

    it('debe desactivar un insumo', async () => {
      const insumoInactivo = new Insumo({
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
        estado: 'INACTIVO',
      });
      mockDesactivarInsumoUseCase.execute.mockResolvedValue(insumoInactivo);

      const res = await controller.desactivarInsumo('ins-1');
      expect(res.estado).toBe('INACTIVO');
    });
  });

  describe('Equipos Endpoints', () => {
    it('debe cambiar estado operativo de un equipo', async () => {
      const equipo = new Equipo({
        id: 'eq-1',
        codigoInterno: 'EQ-01',
        nombre: 'Nebulizador',
        tipo: 'NEBULIZACION',
        estadoOperativo: 'MANTENIMIENTO',
      });
      mockActualizarEstadoEquipoUseCase.execute.mockResolvedValue(equipo);

      const res = await controller.cambiarEstadoEquipo('eq-1', {
        estadoOperativo: 'MANTENIMIENTO',
      });

      expect(res.estadoOperativo).toBe('MANTENIMIENTO');
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
