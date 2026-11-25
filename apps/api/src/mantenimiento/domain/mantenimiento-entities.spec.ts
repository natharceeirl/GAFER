import { Cliente } from './cliente';
import { Proyecto } from './proyecto';
import { ServicioContratado } from './servicio-contratado';
import { Insumo } from './insumo';
import { Equipo } from './equipo';
import { Personal } from './personal';
import { MontoMonedaError, validarMontoYMoneda } from './monto-moneda';

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

    it('debe aceptar presupuesto y moneda opcionales o nulos (GAF-105)', () => {
      const p1 = new Proyecto(validProps);
      expect(p1.montoPresupuestado).toBeNull();
      expect(p1.moneda).toBeNull();

      const p2 = new Proyecto({ ...validProps, montoPresupuestado: 12500.5, moneda: 'USD' });
      expect(p2.montoPresupuestado).toBe(12500.5);
      expect(p2.moneda).toBe('USD');

      p2.actualizarDatos({ montoPresupuestado: 15000, moneda: 'PEN' });
      expect(p2.montoPresupuestado).toBe(15000);
      expect(p2.moneda).toBe('PEN');

      // Actualización parcial de monto conserva la moneda existente
      p2.actualizarDatos({ montoPresupuestado: 18000 });
      expect(p2.montoPresupuestado).toBe(18000);
      expect(p2.moneda).toBe('PEN');

      // Limpiar montoPresupuestado a null limpia también la moneda para no dejarla huérfana
      p2.actualizarDatos({ montoPresupuestado: null });
      expect(p2.montoPresupuestado).toBeNull();
      expect(p2.moneda).toBeNull();

      p2.actualizarDatos({ montoPresupuestado: 9_999_999_999.99, moneda: 'USD' });
      expect(p2.montoPresupuestado).toBe(9_999_999_999.99);
      p2.actualizarDatos({ montoPresupuestado: null, moneda: null });
      expect(p2.montoPresupuestado).toBeNull();
      expect(p2.moneda).toBeNull();

      expect(() => new Proyecto({ ...validProps, montoPresupuestado: -10, moneda: 'PEN' })).toThrow(
        'El presupuesto no puede ser negativo',
      );
      expect(() => p2.actualizarDatos({ montoPresupuestado: -1, moneda: 'PEN' })).toThrow(
        'El presupuesto no puede ser negativo',
      );
      expect(() => new Proyecto({ ...validProps, montoPresupuestado: 10_000_000_000, moneda: 'PEN' })).toThrow(
        'El presupuesto no puede superar 9999999999.99',
      );
      expect(() => p2.actualizarDatos({ montoPresupuestado: 10_000_000_000, moneda: 'PEN' })).toThrow(
        'El presupuesto no puede superar 9999999999.99',
      );
      expect(() => new Proyecto({ ...validProps, montoPresupuestado: Number.NaN, moneda: 'PEN' })).toThrow(
        'El presupuesto debe ser un número válido',
      );
      expect(() => new Proyecto({ ...validProps, montoPresupuestado: Number.POSITIVE_INFINITY, moneda: 'PEN' })).toThrow(
        'El presupuesto debe ser un número válido',
      );
      expect(() => new Proyecto({ ...validProps, montoPresupuestado: 100, moneda: 'EUR' as never })).toThrow(
        'Moneda no válida',
      );
      expect(() => new Proyecto({ ...validProps, montoPresupuestado: 100 })).toThrow(
        'Si especifica un presupuesto, debe indicar la moneda',
      );
      expect(() => new Proyecto({ ...validProps, moneda: 'PEN' })).toThrow(
        'No se puede especificar una moneda sin un presupuesto',
      );
      expect(() => p2.actualizarDatos({ montoPresupuestado: 500 })).toThrow(
        'Si especifica un presupuesto, debe indicar la moneda',
      );
      expect(() => p2.actualizarDatos({ moneda: 'USD' })).toThrow(
        'No se puede especificar una moneda sin un presupuesto',
      );
      expect(() => p2.actualizarDatos({ montoPresupuestado: null, moneda: 'PEN' })).toThrow(
        'No se puede especificar una moneda sin un presupuesto',
      );
    });
  });

  describe('validarMontoYMoneda: máximo 2 decimales (GAF-105)', () => {
    it('rechaza montos con más de 2 decimales y nombra el campo', () => {
      let error: unknown;
      try {
        validarMontoYMoneda(10.999, 'PEN', 'presupuesto');
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(MontoMonedaError);
      expect((error as MontoMonedaError).campo).toBe('montoPresupuestado');
      expect((error as Error).message).toBe('El presupuesto admite como máximo 2 decimales');
      expect(() => validarMontoYMoneda(0.001, 'USD', 'monto')).toThrow('El monto admite como máximo 2 decimales');
      expect(() => validarMontoYMoneda(0.1 + 0.2, 'USD', 'monto')).toThrow('admite como máximo 2 decimales');
    });

    it('acepta montos con hasta 2 decimales y el máximo', () => {
      expect(() => validarMontoYMoneda(10.99, 'PEN', 'monto')).not.toThrow();
      expect(() => validarMontoYMoneda(1200.5, 'PEN', 'monto')).not.toThrow();
      expect(() => validarMontoYMoneda(9_999_999_999.99, 'PEN', 'monto')).not.toThrow();
    });

    it('lo aplican las entidades al crear y al actualizar', () => {
      const props = {
        id: 's1111111-1111-1111-1111-111111111111',
        proyectoId: 'p1111111-1111-1111-1111-111111111111',
        tipoServicio: 'DSF' as const,
        frecuencia: 'MENSUAL' as const,
        areaTotalM2: 5000,
        areaTratarM2: 3000,
      };
      expect(() => new ServicioContratado({ ...props, monto: 10.999, moneda: 'PEN' })).toThrow('admite como máximo 2 decimales');
      const servicio = new ServicioContratado({ ...props, monto: 10, moneda: 'PEN' });
      expect(() => servicio.actualizarDatos({ monto: 10.999 })).toThrow('admite como máximo 2 decimales');
      expect(servicio.monto).toBe(10);
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

    it('debe aceptar monto y moneda opcionales o nulos (GAF-105)', () => {
      const s1 = new ServicioContratado(validProps);
      expect(s1.monto).toBeNull();
      expect(s1.moneda).toBeNull();

      const s2 = new ServicioContratado({ ...validProps, monto: 450.5, moneda: 'PEN' });
      expect(s2.monto).toBe(450.5);
      expect(s2.moneda).toBe('PEN');

      s2.actualizarDatos({ monto: 600, moneda: 'USD' });
      expect(s2.monto).toBe(600);
      expect(s2.moneda).toBe('USD');

      // Actualización parcial de monto conserva la moneda existente
      s2.actualizarDatos({ monto: 750 });
      expect(s2.monto).toBe(750);
      expect(s2.moneda).toBe('USD');

      // Limpiar monto a null limpia también la moneda para no dejarla huérfana
      s2.actualizarDatos({ monto: null });
      expect(s2.monto).toBeNull();
      expect(s2.moneda).toBeNull();

      s2.actualizarDatos({ monto: 9_999_999_999.99, moneda: 'PEN' });
      expect(s2.monto).toBe(9_999_999_999.99);
      s2.actualizarDatos({ monto: null, moneda: null });
      expect(s2.monto).toBeNull();
      expect(s2.moneda).toBeNull();

      expect(() => new ServicioContratado({ ...validProps, monto: -50, moneda: 'PEN' })).toThrow(
        'El monto no puede ser negativo',
      );
      expect(() => s2.actualizarDatos({ monto: -10, moneda: 'USD' })).toThrow(
        'El monto no puede ser negativo',
      );
      expect(() => new ServicioContratado({ ...validProps, monto: 10_000_000_000, moneda: 'PEN' })).toThrow(
        'El monto no puede superar 9999999999.99',
      );
      expect(() => s2.actualizarDatos({ monto: 10_000_000_000, moneda: 'PEN' })).toThrow(
        'El monto no puede superar 9999999999.99',
      );
      expect(() => new ServicioContratado({ ...validProps, monto: Number.NaN, moneda: 'PEN' })).toThrow(
        'El monto debe ser un número válido',
      );
      expect(() => new ServicioContratado({ ...validProps, monto: Number.POSITIVE_INFINITY, moneda: 'PEN' })).toThrow(
        'El monto debe ser un número válido',
      );
      expect(() => new ServicioContratado({ ...validProps, monto: 100, moneda: 'EUR' as never })).toThrow(
        'Moneda no válida',
      );
      expect(() => new ServicioContratado({ ...validProps, monto: 100 })).toThrow(
        'Si especifica un monto, debe indicar la moneda',
      );
      expect(() => new ServicioContratado({ ...validProps, moneda: 'PEN' })).toThrow(
        'No se puede especificar una moneda sin un monto',
      );
      expect(() => s2.actualizarDatos({ monto: 500 })).toThrow(
        'Si especifica un monto, debe indicar la moneda',
      );
      expect(() => s2.actualizarDatos({ moneda: 'USD' })).toThrow(
        'No se puede especificar una moneda sin un monto',
      );
      expect(() => s2.actualizarDatos({ monto: null, moneda: 'USD' })).toThrow(
        'No se puede especificar una moneda sin un monto',
      );
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

    it('should allow updating personal data and toggling active status', () => {
      const personal = new Personal({
        id: 'u1111111-1111-1111-1111-111111111111',
        dni: '45892312',
        nombres: 'Juan',
        apellidos: 'Perez Gomez',
        cargo: 'TECNICO_OPERADOR',
        telefono: '987654321',
        usuario: 'JPEREZ',
      });

      personal.actualizarDatos({
        nombres: 'Juan Carlos',
        cargo: 'SUPERVISOR',
        telefono: '958000111',
      });
      expect(personal.nombres).toBe('Juan Carlos');
      expect(personal.cargo).toBe('SUPERVISOR');
      expect(personal.telefono).toBe('958000111');
      expect(personal.nombreCompleto).toBe('Juan Carlos Perez Gomez');

      personal.desactivar();
      expect(personal.getEstado()).toBe('INACTIVO');
      personal.activar();
      expect(personal.getEstado()).toBe('ACTIVO');
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

    it('should allow updating equipment details', () => {
      const equipo = new Equipo({
        id: 'e1111111-1111-1111-1111-111111111111',
        codigoInterno: 'EQ-NEB-01',
        nombre: 'Nebulizadora ULV Vector Fog',
        tipo: 'NEBULIZACION',
      });

      equipo.actualizarDatos({
        nombre: 'Nebulizadora ULV Actualizada',
        marcaModelo: 'VectorFog H200',
        ultimoMantenimiento: '2026-09-01',
      });
      expect(equipo.nombre).toBe('Nebulizadora ULV Actualizada');
      expect(equipo.marcaModelo).toBe('VectorFog H200');
      expect(equipo.ultimoMantenimiento).toBe('2026-09-01');
    });
  });
});
