import { Cliente } from './cliente';
import { Proyecto } from './proyecto';
import { ServicioContratado } from './servicio-contratado';
import { Insumo } from './insumo';
import { Equipo } from './equipo';
import { Personal } from './personal';

describe('Mantenimiento Domain Entities — Business Rules (T2.2)', () => {
  describe('Cliente Entity', () => {
    const validProps = {
      id: 'c1111111-1111-1111-1111-111111111111',
      razonSocial: 'Kallpa Generacion S.A.',
      ruc: '20508565434',
      codigoCorto: 'KALLPA',
      direccionFiscal: 'Av. Las Palmas 123',
      giroNegocio: 'Energía',
      contactoNombre: 'Carlos Ramos',
      contactoCargo: 'Jefe SSOMA',
      contactoTelefono: '958123456',
      contactoCorreo: 'cramos@kallpa.pe',
    };

    it('should create a valid Cliente entity', () => {
      const cliente = new Cliente(validProps);
      expect(cliente.id).toBe(validProps.id);
      expect(cliente.ruc).toBe('20508565434');
      expect(cliente.codigoCorto).toBe('KALLPA');
      expect(cliente.getEstado()).toBe('ACTIVO');
    });

    it('should throw an error if RUC is not exactly 11 digits', () => {
      expect(() => new Cliente({ ...validProps, ruc: '12345' })).toThrow(
        'El RUC debe tener exactamente 11 dígitos numéricos',
      );
      expect(() => new Cliente({ ...validProps, ruc: '2050856543A' })).toThrow(
        'El RUC debe tener exactamente 11 dígitos numéricos',
      );
    });

    it('should throw an error if codigoCorto format is invalid', () => {
      expect(() => new Cliente({ ...validProps, codigoCorto: 'kallpa' })).toThrow(
        'El código corto debe tener entre 3 y 10 caracteres alfanuméricos en mayúsculas',
      );
      expect(() => new Cliente({ ...validProps, codigoCorto: 'K' })).toThrow(
        'El código corto debe tener entre 3 y 10 caracteres alfanuméricos en mayúsculas',
      );
    });

    it('should allow toggling active status', () => {
      const cliente = new Cliente(validProps);
      cliente.desactivar();
      expect(cliente.getEstado()).toBe('INACTIVO');
      cliente.activar();
      expect(cliente.getEstado()).toBe('ACTIVO');
    });
  });

  describe('Proyecto Entity', () => {
    const validProps = {
      id: 'p1111111-1111-1111-1111-111111111111',
      clienteId: 'c1111111-1111-1111-1111-111111111111',
      nombre: 'PLANTA_SUR',
      direccionSede: 'Carretera Costanera Km 12',
      distrito: 'Mollendo',
      provincia: 'Islay',
      departamento: 'Arequipa',
      contactoNombre: 'Mario Vargas',
      contactoCargo: 'Supervisor de Planta',
      contactoTelefono: '954987654',
    };

    it('should create a valid Proyecto entity', () => {
      const proyecto = new Proyecto(validProps);
      expect(proyecto.nombre).toBe('PLANTA_SUR');
      expect(proyecto.getEstado()).toBe('ACTIVO');
    });

    it('should reject invalid sede name format (lowercase or spaces)', () => {
      expect(() => new Proyecto({ ...validProps, nombre: 'Planta Sur' })).toThrow(
        'El nombre de la sede/proyecto debe tener entre 3 y 50 caracteres alfanuméricos en mayúsculas sin espacios',
      );
    });
  });

  describe('ServicioContratado Entity', () => {
    const validProps = {
      id: 's1111111-1111-1111-1111-111111111111',
      proyectoId: 'p1111111-1111-1111-1111-111111111111',
      tipoServicio: 'DSF' as const,
      frecuencia: 'MENSUAL' as const,
      areaTotalM2: 5000,
      areaTratarM2: 3000,
      requiereCertificado: true,
      vigenciaDias: 30,
    };

    it('should create a valid ServicioContratado', () => {
      const servicio = new ServicioContratado(validProps);
      expect(servicio.tipoServicio).toBe('DSF');
      expect(servicio.areaTotalM2).toBe(5000);
      expect(servicio.areaTratarM2).toBe(3000);
    });

    it('should throw an error if areaTratar is greater than areaTotal', () => {
      expect(
        () => new ServicioContratado({ ...validProps, areaTotalM2: 2000, areaTratarM2: 3000 }),
      ).toThrow('El área a tratar no puede superar el área total del establecimiento');
    });

    it('should throw an error if requiereCertificado is true but vigenciaDias is not specified', () => {
      expect(
        () =>
          new ServicioContratado({
            ...validProps,
            requiereCertificado: true,
            vigenciaDias: null,
          }),
      ).toThrow('Si el servicio requiere certificado ambiental, debe especificarse una vigencia en días mayor a 0');
    });
  });

  describe('Personal Entity', () => {
    it('should create Personal and validate 8 digits DNI', () => {
      const personal = new Personal({
        id: 'u1111111-1111-1111-1111-111111111111',
        dni: '45892312',
        nombres: 'Juan',
        apellidos: 'Perez Gomez',
        cargo: 'TECNICO_OPERADOR',
        telefono: '987654321',
        usuario: 'JPEREZ',
      });

      expect(personal.dni).toBe('45892312');
      expect(personal.cargo).toBe('TECNICO_OPERADOR');
      expect(personal.nombreCompleto).toBe('Juan Perez Gomez');
    });

    it('should reject DNI with invalid length or non-digits', () => {
      expect(
        () =>
          new Personal({
            id: '1',
            dni: '123',
            nombres: 'A',
            apellidos: 'B',
            cargo: 'SUPERVISOR',
            telefono: '9',
          }),
      ).toThrow('El DNI debe contener exactamente 8 dígitos numéricos');
    });
  });

  describe('Equipo Entity', () => {
    it('should manage operational states of equipment', () => {
      const equipo = new Equipo({
        id: 'e1111111-1111-1111-1111-111111111111',
        codigoInterno: 'EQ-NEB-01',
        nombre: 'Nebulizadora ULV Vector Fog',
        tipo: 'NEBULIZACION',
      });

      expect(equipo.codigoInterno).toBe('EQ-NEB-01');
      expect(equipo.estaOperativo()).toBe(true);

      equipo.cambiarEstadoOperativo('MANTENIMIENTO');
      expect(equipo.estaOperativo()).toBe(false);
      expect(equipo.getEstadoOperativo()).toBe('MANTENIMIENTO');
    });
  });
});
