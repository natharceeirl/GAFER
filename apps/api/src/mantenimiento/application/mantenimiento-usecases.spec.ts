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

  describe('ActualizarProyectoUseCase', () => {
    it('actualiza datos de sede correctamente', async () => {
      const { ActualizarProyectoUseCase } = await import('./actualizar-proyecto.usecase');
      const proyecto = new Proyecto({
        id: 'p1',
        clienteId: 'c1',
        nombre: 'SEDE_ORIGINAL',
        direccionSede: 'Calle 1',
        distrito: 'Distrito 1',
        provincia: 'Provincia 1',
        departamento: 'Dept 1',
        contactoNombre: 'Juan',
        contactoCargo: 'Jefe',
        contactoTelefono: '958123456',
      });
      mockProyectoRepo.buscarPorId.mockResolvedValue(proyecto);
      mockProyectoRepo.buscarPorClienteYNombre.mockResolvedValue(null);

      const useCase = new ActualizarProyectoUseCase(mockProyectoRepo);
      const res = await useCase.execute({
        id: 'p1',
        nombre: 'SEDE_MODIFICADA',
        direccionSede: 'Calle 2',
      });

      expect(res.nombre).toBe('SEDE_MODIFICADA');
      expect(res.direccionSede).toBe('Calle 2');
      expect(mockProyectoRepo.guardar).toHaveBeenCalled();
    });

    it('rechaza si nombre está duplicado en el mismo cliente', async () => {
      const { ActualizarProyectoUseCase } = await import('./actualizar-proyecto.usecase');
      const proyecto = new Proyecto({
        id: 'p1',
        clienteId: 'c1',
        nombre: 'SEDE_ORIGINAL',
        direccionSede: 'Calle 1',
        distrito: 'Distrito 1',
        provincia: 'Provincia 1',
        departamento: 'Dept 1',
        contactoNombre: 'Juan',
        contactoCargo: 'Jefe',
        contactoTelefono: '958123456',
      });
      const proyectoExistente = new Proyecto({
        id: 'p2',
        clienteId: 'c1',
        nombre: 'SEDE_EXISTENTE',
        direccionSede: 'Calle 3',
        distrito: 'Distrito 1',
        provincia: 'Provincia 1',
        departamento: 'Dept 1',
        contactoNombre: 'Juan',
        contactoCargo: 'Jefe',
        contactoTelefono: '958123456',
      });
      mockProyectoRepo.buscarPorId.mockResolvedValue(proyecto);
      mockProyectoRepo.buscarPorClienteYNombre.mockResolvedValue(proyectoExistente);

      const useCase = new ActualizarProyectoUseCase(mockProyectoRepo);
      await expect(
        useCase.execute({ id: 'p1', nombre: 'SEDE_EXISTENTE' }),
      ).rejects.toThrow('El cliente ya posee una sede registrada con el nombre: SEDE_EXISTENTE');
    });
  });

  describe('ActualizarServicioContratadoUseCase', () => {
    it('actualiza datos del servicio contratado correctamente', async () => {
      const { ActualizarServicioContratadoUseCase } = await import(
        './actualizar-servicio-contratado.usecase'
      );
      const { ServicioContratado } = await import('../domain/servicio-contratado');
      const servicio = new ServicioContratado({
        id: 's1',
        proyectoId: 'p1',
        tipoServicio: 'DSF',
        frecuencia: 'MENSUAL',
        areaTotalM2: 1000,
        areaTratarM2: 500,
      });

      const mockServicioRepo = {
        guardar: jest.fn().mockResolvedValue(undefined),
        buscarPorId: jest.fn().mockResolvedValue(servicio),
        buscarPorProyectoId: jest.fn(),
      };

      const useCase = new ActualizarServicioContratadoUseCase(mockServicioRepo);
      const res = await useCase.execute({
        id: 's1',
        frecuencia: 'QUINCENAL',
        areaTratarM2: 800,
        insumosAutorizados: ['i1'],
        equiposAutorizados: ['e1'],
        dosisReferencial: { i1: '5 ml/L' },
      });

      expect(res.frecuencia).toBe('QUINCENAL');
      expect(res.areaTratarM2).toBe(800);
      expect(res.insumosAutorizados).toEqual(['i1']);
      expect(mockServicioRepo.guardar).toHaveBeenCalled();
    });
  });

  describe('ActivarInsumoUseCase', () => {
    it('activa un insumo inactivo correctamente', async () => {
      const { ActivarInsumoUseCase } = await import('./activar-insumo.usecase');
      const { Insumo } = await import('../domain/insumo');
      const insumo = new Insumo({
        id: 'i1',
        nombreComercial: 'Cipermetrina',
        principioActivo: 'Cipermetrina',
        presentacion: 'LIQUIDO',
        unidadMedida: 'L',
        registroDigesa: 'RD-1111',
        concentracion: '25%',
        dosisEstandar: '5ml',
        fichaTecnicaKey: 'k1',
        hojaMsdsKey: 'k2',
        estado: 'INACTIVO',
      });
      const mockInsumoRepo = {
        guardar: jest.fn().mockResolvedValue(undefined),
        buscarPorId: jest.fn().mockResolvedValue(insumo),
        buscarPorDigesa: jest.fn(),
        listarActivos: jest.fn(),
        listarTodos: jest.fn(),
      };
      const useCase = new ActivarInsumoUseCase(mockInsumoRepo);
      const res = await useCase.execute('i1');
      expect(res.getEstado()).toBe('ACTIVO');
      expect(mockInsumoRepo.guardar).toHaveBeenCalledTimes(1);
    });
  });

  describe('ActualizarEquipoUseCase', () => {
    it('actualiza datos de un equipo existente', async () => {
      const { ActualizarEquipoUseCase } = await import('./actualizar-equipo.usecase');
      const { Equipo } = await import('../domain/equipo');
      const equipo = new Equipo({
        id: 'e1',
        codigoInterno: 'EQ-01',
        nombre: 'Nebulizador Original',
        tipo: 'NEBULIZACION',
      });
      const mockEquipoRepo = {
        guardar: jest.fn().mockResolvedValue(undefined),
        buscarPorId: jest.fn().mockResolvedValue(equipo),
        buscarPorCodigoInterno: jest.fn().mockResolvedValue(null),
        listarOperativos: jest.fn(),
        listarTodos: jest.fn(),
      };
      const useCase = new ActualizarEquipoUseCase(mockEquipoRepo);
      const res = await useCase.execute({
        id: 'e1',
        nombre: 'Nebulizador Actualizado',
        marcaModelo: 'VectorFog H200',
      });
      expect(res.nombre).toBe('Nebulizador Actualizado');
      expect(res.marcaModelo).toBe('VectorFog H200');
      expect(mockEquipoRepo.guardar).toHaveBeenCalledTimes(1);
    });

    it('rechaza actualización si nuevo codigoInterno ya pertenece a otro equipo', async () => {
      const { ActualizarEquipoUseCase } = await import('./actualizar-equipo.usecase');
      const { Equipo } = await import('../domain/equipo');
      const equipo1 = new Equipo({
        id: 'e1',
        codigoInterno: 'EQ-01',
        nombre: 'Equipo 1',
        tipo: 'NEBULIZACION',
      });
      const equipo2 = new Equipo({
        id: 'e2',
        codigoInterno: 'EQ-02',
        nombre: 'Equipo 2',
        tipo: 'NEBULIZACION',
      });
      const mockEquipoRepo = {
        guardar: jest.fn().mockResolvedValue(undefined),
        buscarPorId: jest.fn().mockResolvedValue(equipo1),
        buscarPorCodigoInterno: jest.fn().mockResolvedValue(equipo2),
        listarOperativos: jest.fn(),
        listarTodos: jest.fn(),
      };
      const useCase = new ActualizarEquipoUseCase(mockEquipoRepo);
      await expect(
        useCase.execute({ id: 'e1', codigoInterno: 'EQ-02' }),
      ).rejects.toThrow('Ya existe un equipo registrado con el código interno: EQ-02');
    });
  });

  describe('ActualizarPersonalUseCase', () => {
    it('actualiza datos de personal correctamente', async () => {
      const { ActualizarPersonalUseCase } = await import('./actualizar-personal.usecase');
      const { Personal } = await import('../domain/personal');
      const personal = new Personal({
        id: 'p1',
        dni: '45892312',
        nombres: 'Luis',
        apellidos: 'Quispe',
        cargo: 'TECNICO_OPERADOR',
        telefono: '958111222',
      });
      const mockRepo = {
        guardar: jest.fn().mockResolvedValue(undefined),
        buscarPorId: jest.fn().mockResolvedValue(personal),
        buscarPorDni: jest.fn().mockResolvedValue(null),
        buscarPorUsuario: jest.fn().mockResolvedValue(null),
        listarActivos: jest.fn(),
        listarTodos: jest.fn(),
      };
      const useCase = new ActualizarPersonalUseCase(mockRepo);
      const res = await useCase.execute({
        id: 'p1',
        nombres: 'Luis Alberto',
        cargo: 'SUPERVISOR',
      });
      expect(res.nombres).toBe('Luis Alberto');
      expect(res.cargo).toBe('SUPERVISOR');
      expect(mockRepo.guardar).toHaveBeenCalledTimes(1);
    });

    it('rechaza actualización si nuevo DNI pertenece a otro colaborador', async () => {
      const { ActualizarPersonalUseCase } = await import('./actualizar-personal.usecase');
      const { Personal } = await import('../domain/personal');
      const personal1 = new Personal({
        id: 'p1',
        dni: '45892312',
        nombres: 'Luis',
        apellidos: 'Quispe',
        cargo: 'TECNICO_OPERADOR',
        telefono: '958111222',
      });
      const personal2 = new Personal({
        id: 'p2',
        dni: '70809010',
        nombres: 'Maria',
        apellidos: 'Perez',
        cargo: 'SUPERVISOR',
        telefono: '958333444',
      });
      const mockRepo = {
        guardar: jest.fn().mockResolvedValue(undefined),
        buscarPorId: jest.fn().mockResolvedValue(personal1),
        buscarPorDni: jest.fn().mockResolvedValue(personal2),
        buscarPorUsuario: jest.fn().mockResolvedValue(null),
        listarActivos: jest.fn(),
        listarTodos: jest.fn(),
      };
      const useCase = new ActualizarPersonalUseCase(mockRepo);
      await expect(
        useCase.execute({ id: 'p1', dni: '70809010' }),
      ).rejects.toThrow('Ya existe un colaborador registrado con el DNI: 70809010');
    });
  });

  describe('ActivarPersonalUseCase', () => {
    it('reactiva un personal desactivado correctamente', async () => {
      const { ActivarPersonalUseCase } = await import('./activar-personal.usecase');
      const { Personal } = await import('../domain/personal');
      const personal = new Personal({
        id: 'p1',
        dni: '45892312',
        nombres: 'Luis',
        apellidos: 'Quispe',
        cargo: 'TECNICO_OPERADOR',
        telefono: '958111222',
        estado: 'INACTIVO',
      });
      const mockRepo = {
        guardar: jest.fn().mockResolvedValue(undefined),
        buscarPorId: jest.fn().mockResolvedValue(personal),
        buscarPorDni: jest.fn(),
        buscarPorUsuario: jest.fn(),
        listarActivos: jest.fn(),
        listarTodos: jest.fn(),
      };
      const useCase = new ActivarPersonalUseCase(mockRepo);
      const res = await useCase.execute('p1');
      expect(res.getEstado()).toBe('ACTIVO');
      expect(mockRepo.guardar).toHaveBeenCalledTimes(1);
    });
  });

  describe('Catálogos de Texto, Configuración y Auditoría (GAF-23)', () => {
    let mockAuditoriaService: any;

    beforeEach(() => {
      mockAuditoriaService = {
        registrarEvento: jest.fn().mockResolvedValue({ id: 'evt-1' }),
        consultarEventos: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      };
    });

    describe('ListarCatalogosTextoUseCase', () => {
      it('filtra catálogos de solo administrador si el rol no es ADMINISTRADOR', async () => {
        const { ListarCatalogosTextoUseCase } = await import('./listar-catalogos-texto.usecase');
        const { CatalogoTexto } = await import('../domain/catalogo-texto');
        const catPublico = new CatalogoTexto('hallazgos', 'Hallazgos', ['Item 1'], false);
        const catAdmin = new CatalogoTexto('motivos-modificacion', 'Motivos', ['Error'], true);

        const mockRepo = {
          listar: jest.fn().mockResolvedValue([catPublico, catAdmin]),
          buscarPorId: jest.fn(),
          guardar: jest.fn(),
        };

        const useCase = new ListarCatalogosTextoUseCase(mockRepo);

        // Sin rol o con rol SUPERVISOR
        const resSupervisor = await useCase.execute('SUPERVISOR');
        expect(resSupervisor).toHaveLength(1);
        expect(resSupervisor[0].id).toBe('hallazgos');

        // Con rol ADMINISTRADOR
        const resAdmin = await useCase.execute('ADMINISTRADOR');
        expect(resAdmin).toHaveLength(2);
      });
    });

    describe('ObtenerCatalogoTextoUseCase', () => {
      it('lanza NotFoundException si el catálogo no existe', async () => {
        const { ObtenerCatalogoTextoUseCase } = await import('./obtener-catalogo-texto.usecase');
        const mockRepo = {
          listar: jest.fn(),
          buscarPorId: jest.fn().mockResolvedValue(null),
          guardar: jest.fn(),
        };
        const useCase = new ObtenerCatalogoTextoUseCase(mockRepo);
        await expect(useCase.execute('no-existe')).rejects.toThrow("Catálogo de texto 'no-existe' no encontrado");
      });

      it('bloquea catálogo soloAdministrador a usuarios que no sean ADMINISTRADOR', async () => {
        const { ObtenerCatalogoTextoUseCase } = await import('./obtener-catalogo-texto.usecase');
        const { CatalogoTexto } = await import('../domain/catalogo-texto');
        const catAdmin = new CatalogoTexto('motivos-modificacion', 'Motivos', ['Error'], true);

        const mockRepo = {
          listar: jest.fn(),
          buscarPorId: jest.fn().mockResolvedValue(catAdmin),
          guardar: jest.fn(),
        };
        const useCase = new ObtenerCatalogoTextoUseCase(mockRepo);
        await expect(useCase.execute('motivos-modificacion', 'SUPERVISOR')).rejects.toThrow(
          "El catálogo 'motivos-modificacion' es de acceso exclusivo para ADMINISTRADOR",
        );

        const ok = await useCase.execute('motivos-modificacion', 'ADMINISTRADOR');
        expect(ok.id).toBe('motivos-modificacion');
      });
    });

    describe('ActualizarCatalogoTextoUseCase', () => {
      it('actualiza items y registra evento de auditoría', async () => {
        const { ActualizarCatalogoTextoUseCase } = await import('./actualizar-catalogo-texto.usecase');
        const { CatalogoTexto } = await import('../domain/catalogo-texto');
        const cat = new CatalogoTexto('hallazgos', 'Hallazgos', ['Item viejo']);

        const mockRepo = {
          listar: jest.fn(),
          buscarPorId: jest.fn().mockResolvedValue(cat),
          guardar: jest.fn().mockResolvedValue(undefined),
        };

        const useCase = new ActualizarCatalogoTextoUseCase(mockRepo, mockAuditoriaService);
        const res = await useCase.execute({
          id: 'hallazgos',
          items: ['Cucaracha', 'Mosca'],
          actorUsuario: 'ADMIN',
          actorRol: 'ADMINISTRADOR',
        });

        expect(res.items).toEqual(['Cucaracha', 'Mosca']);
        expect(mockRepo.guardar).toHaveBeenCalled();
        expect(mockAuditoriaService.registrarEvento).toHaveBeenCalledWith(
          expect.objectContaining({
            accion: 'ACTUALIZAR_CATALOGO_TEXTO',
            entidadId: 'hallazgos',
            payloadAnterior: { items: ['Item viejo'] },
            payloadNuevo: { items: ['Cucaracha', 'Mosca'] },
          }),
        );
      });

      it('rechaza modificación de catálogo soloAdministrador por no-admin', async () => {
        const { ActualizarCatalogoTextoUseCase } = await import('./actualizar-catalogo-texto.usecase');
        const { CatalogoTexto } = await import('../domain/catalogo-texto');
        const cat = new CatalogoTexto('motivos-modificacion', 'Motivos', ['Error'], true);

        const mockRepo = {
          listar: jest.fn(),
          buscarPorId: jest.fn().mockResolvedValue(cat),
          guardar: jest.fn(),
        };

        const useCase = new ActualizarCatalogoTextoUseCase(mockRepo, mockAuditoriaService);
        await expect(
          useCase.execute({
            id: 'motivos-modificacion',
            items: ['Nuevo motivo'],
            actorUsuario: 'SUPER',
            actorRol: 'SUPERVISOR',
          }),
        ).rejects.toThrow("El catálogo 'motivos-modificacion' solo puede ser modificado por ADMINISTRADOR");
      });
    });

    describe('AgregarItemCatalogoTextoUseCase', () => {
      it('agrega item único y registra auditoría', async () => {
        const { AgregarItemCatalogoTextoUseCase } = await import('./agregar-item-catalogo-texto.usecase');
        const { CatalogoTexto } = await import('../domain/catalogo-texto');
        const cat = new CatalogoTexto('hallazgos', 'Hallazgos', ['Item 1']);

        const mockRepo = {
          listar: jest.fn(),
          buscarPorId: jest.fn().mockResolvedValue(cat),
          guardar: jest.fn().mockResolvedValue(undefined),
        };

        const useCase = new AgregarItemCatalogoTextoUseCase(mockRepo, mockAuditoriaService);
        const res = await useCase.execute({
          id: 'hallazgos',
          item: 'Item 2',
          actorUsuario: 'SUPER',
          actorRol: 'SUPERVISOR',
        });

        expect(res.items).toEqual(['Item 1', 'Item 2']);
        expect(mockAuditoriaService.registrarEvento).toHaveBeenCalledWith(
          expect.objectContaining({
            accion: 'AGREGAR_ITEM_CATALOGO_TEXTO',
            payloadNuevo: { items: ['Item 1', 'Item 2'], itemAgregado: 'Item 2' },
          }),
        );
      });
    });

    describe('Configuración Global y Auditoría', () => {
      it('actualizar-configuracion actualiza Director Técnico y registra auditoría solo si es ADMINISTRADOR', async () => {
        const { ActualizarConfiguracionUseCase } = await import('./actualizar-configuracion.usecase');
        const { ConfiguracionSistema } = await import('../domain/configuracion-sistema');
        const config = new ConfiguracionSistema();

        const mockRepo = {
          obtener: jest.fn().mockResolvedValue(config),
          guardar: jest.fn().mockResolvedValue(undefined),
        };

        const useCase = new ActualizarConfiguracionUseCase(mockRepo, mockAuditoriaService);

        // Bloquea no-admin
        await expect(
          useCase.execute({
            director: { nombre: 'Dr. Test', cip: '12345' },
            actorUsuario: 'SUPER',
            actorRol: 'SUPERVISOR',
          }),
        ).rejects.toThrow('Solo ADMINISTRADOR puede actualizar la configuración del sistema');

        // Permite admin
        const actualizado = await useCase.execute({
          director: { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512' },
          actorUsuario: 'ADMIN',
          actorRol: 'ADMINISTRADOR',
        });

        expect(actualizado.directorNombre).toBe('Ing. Carlos Medina Ruiz');
        expect(mockAuditoriaService.registrarEvento).toHaveBeenCalledWith(
          expect.objectContaining({
            modulo: 'CONFIGURACION',
            accion: 'ACTUALIZAR_CONFIGURACION_SISTEMA',
          }),
        );
      });

      it('consultar-auditoria exige rol ADMINISTRADOR', async () => {
        const { ConsultarAuditoriaUseCase } = await import('./consultar-auditoria.usecase');
        const useCase = new ConsultarAuditoriaUseCase(mockAuditoriaService);

        await expect(
          useCase.execute({ filtros: {}, actorRol: 'TECNICO_OPERADOR' }),
        ).rejects.toThrow('Solo ADMINISTRADOR puede consultar el registro de auditoría');

        mockAuditoriaService.consultarEventos.mockResolvedValueOnce({ items: [{ id: '1' }], total: 1 });
        const res = await useCase.execute({ filtros: {}, actorRol: 'ADMINISTRADOR' });
        expect(res.total).toBe(1);
      });
    });
  });
});
