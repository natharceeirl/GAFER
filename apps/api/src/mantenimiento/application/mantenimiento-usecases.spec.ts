import { RegistrarClienteUseCase } from './registrar-cliente.usecase';
import { RegistrarProyectoUseCase } from './registrar-proyecto.usecase';
import { RegistrarPersonalUseCase } from './registrar-personal.usecase';
import { Cliente } from '../domain/cliente';
import { Proyecto } from '../domain/proyecto';
import { Personal } from '../domain/personal';
import { ClienteRepository } from '../domain/ports/cliente.repository';
import { ProyectoRepository } from '../domain/ports/proyecto.repository';
import { PersonalRepository } from '../domain/ports/personal.repository';

describe('Mantenimiento Use Cases (T2.2)', () => {
  let mockClienteRepo: jest.Mocked<ClienteRepository>;
  let mockProyectoRepo: jest.Mocked<ProyectoRepository>;
  let mockPersonalRepo: jest.Mocked<PersonalRepository>;

  beforeEach(() => {
    mockClienteRepo = {
      guardar: jest.fn().mockResolvedValue(undefined),
      buscarPorId: jest.fn(),
      buscarPorRuc: jest.fn(),
      buscarPorCodigoCorto: jest.fn(),
      listarTodos: jest.fn(),
    };

    mockProyectoRepo = {
      guardar: jest.fn().mockResolvedValue(undefined),
      buscarPorId: jest.fn(),
      buscarPorClienteId: jest.fn(),
      buscarPorClienteYNombre: jest.fn(),
    };

    mockPersonalRepo = {
      guardar: jest.fn().mockResolvedValue(undefined),
      buscarPorId: jest.fn(),
      buscarPorDni: jest.fn(),
      buscarPorUsuario: jest.fn(),
      listarActivos: jest.fn(),
    };
  });

  describe('RegistrarClienteUseCase', () => {
    it('should register a new client successfully when RUC and codigoCorto are unique', async () => {
      mockClienteRepo.buscarPorRuc.mockResolvedValue(null);
      mockClienteRepo.buscarPorCodigoCorto.mockResolvedValue(null);

      const useCase = new RegistrarClienteUseCase(mockClienteRepo);
      const cliente = await useCase.execute({
        id: 'c1',
        razonSocial: 'SAMAY I S.A.',
        ruc: '20512345678',
        codigoCorto: 'SAMAY',
        direccionFiscal: 'Mollendo',
        giroNegocio: 'Energía',
        contactoNombre: 'Pedro Alvarez',
        contactoCargo: 'Gerente',
        contactoTelefono: '958112233',
        contactoCorreo: 'palvarez@samay.pe',
      });

      expect(cliente.ruc).toBe('20512345678');
      expect(mockClienteRepo.guardar).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if RUC is already registered', async () => {
      mockClienteRepo.buscarPorRuc.mockResolvedValue(
        new Cliente({
          id: 'c0',
          razonSocial: 'Existente',
          ruc: '20512345678',
          codigoCorto: 'EXIST',
          direccionFiscal: 'Lima',
          giroNegocio: 'Varios',
          contactoNombre: 'Admin',
          contactoCargo: 'Jefe',
          contactoTelefono: '999',
          contactoCorreo: 'admin@exist.pe',
        }),
      );

      const useCase = new RegistrarClienteUseCase(mockClienteRepo);
      await expect(
        useCase.execute({
          id: 'c1',
          razonSocial: 'SAMAY I S.A.',
          ruc: '20512345678',
          codigoCorto: 'SAMAY',
          direccionFiscal: 'Mollendo',
          giroNegocio: 'Energía',
          contactoNombre: 'Pedro Alvarez',
          contactoCargo: 'Gerente',
          contactoTelefono: '958112233',
          contactoCorreo: 'palvarez@samay.pe',
        }),
      ).rejects.toThrow('Ya existe un cliente registrado con el RUC: 20512345678');
    });

    it('should throw an error if codigoCorto is already registered', async () => {
      mockClienteRepo.buscarPorRuc.mockResolvedValue(null);
      mockClienteRepo.buscarPorCodigoCorto.mockResolvedValue(
        new Cliente({
          id: 'c0',
          razonSocial: 'Otro',
          ruc: '20999999999',
          codigoCorto: 'SAMAY',
          direccionFiscal: 'Lima',
          giroNegocio: 'Varios',
          contactoNombre: 'Admin',
          contactoCargo: 'Jefe',
          contactoTelefono: '999',
          contactoCorreo: 'admin@otro.pe',
        }),
      );

      const useCase = new RegistrarClienteUseCase(mockClienteRepo);
      await expect(
        useCase.execute({
          id: 'c1',
          razonSocial: 'SAMAY I S.A.',
          ruc: '20512345678',
          codigoCorto: 'SAMAY',
          direccionFiscal: 'Mollendo',
          giroNegocio: 'Energía',
          contactoNombre: 'Pedro Alvarez',
          contactoCargo: 'Gerente',
          contactoTelefono: '958112233',
          contactoCorreo: 'palvarez@samay.pe',
        }),
      ).rejects.toThrow('Ya existe un cliente con el código corto: SAMAY');
    });
  });

  describe('RegistrarProyectoUseCase', () => {
    it('should register a project when client exists and name is unique in client', async () => {
      mockClienteRepo.buscarPorId.mockResolvedValue(
        new Cliente({
          id: 'c1',
          razonSocial: 'SAMAY I S.A.',
          ruc: '20512345678',
          codigoCorto: 'SAMAY',
          direccionFiscal: 'Mollendo',
          giroNegocio: 'Energía',
          contactoNombre: 'Pedro Alvarez',
          contactoCargo: 'Gerente',
          contactoTelefono: '958112233',
          contactoCorreo: 'palvarez@samay.pe',
        }),
      );
      mockProyectoRepo.buscarPorClienteYNombre.mockResolvedValue(null);

      const useCase = new RegistrarProyectoUseCase(mockProyectoRepo, mockClienteRepo);
      const proyecto = await useCase.execute({
        id: 'p1',
        clienteId: 'c1',
        nombre: 'ALMACEN_CENTRAL',
        direccionSede: 'Av. Industrial 456',
        distrito: 'Islay',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Juan',
        contactoCargo: 'Jefe Almacen',
        contactoTelefono: '954112233',
      });

      expect(proyecto.nombre).toBe('ALMACEN_CENTRAL');
      expect(mockProyectoRepo.guardar).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if client does not exist', async () => {
      mockClienteRepo.buscarPorId.mockResolvedValue(null);

      const useCase = new RegistrarProyectoUseCase(mockProyectoRepo, mockClienteRepo);
      await expect(
        useCase.execute({
          id: 'p1',
          clienteId: 'c_inexistente',
          nombre: 'SEDE_1',
          direccionSede: 'Dir',
          distrito: 'D',
          provincia: 'P',
          departamento: 'D',
          contactoNombre: 'C',
          contactoCargo: 'J',
          contactoTelefono: '9',
        }),
      ).rejects.toThrow('No se encontró el cliente con ID: c_inexistente');
    });
  });

  describe('RegistrarPersonalUseCase', () => {
    it('should throw an error if DNI already exists', async () => {
      mockPersonalRepo.buscarPorDni.mockResolvedValue(
        new Personal({
          id: 'u0',
          dni: '45892312',
          nombres: 'Jorge',
          apellidos: 'Castro',
          cargo: 'SUPERVISOR',
          telefono: '999',
        }),
      );

      const useCase = new RegistrarPersonalUseCase(mockPersonalRepo);
      await expect(
        useCase.execute({
          id: 'u1',
          dni: '45892312',
          nombres: 'Nuevo',
          apellidos: 'Tecnico',
          cargo: 'TECNICO_OPERADOR',
          telefono: '988888888',
        }),
      ).rejects.toThrow('Ya existe un colaborador registrado con el DNI: 45892312');
    });
  });
});
