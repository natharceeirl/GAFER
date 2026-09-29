import { createTestApp, TestApp } from '../support/app';
import { resetDb } from '../support/db';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../src/mantenimiento/domain/ports/cliente.repository';
import { PROYECTO_REPOSITORY, ProyectoRepository } from '../../src/mantenimiento/domain/ports/proyecto.repository';
import {
  SERVICIO_CONTRATADO_REPOSITORY,
  ServicioContratadoRepository,
} from '../../src/mantenimiento/domain/ports/servicio-contratado.repository';
import { INSUMO_REPOSITORY, InsumoRepository } from '../../src/mantenimiento/domain/ports/insumo.repository';
import { EQUIPO_REPOSITORY, EquipoRepository } from '../../src/mantenimiento/domain/ports/equipo.repository';
import { PERSONAL_REPOSITORY, PersonalRepository } from '../../src/mantenimiento/domain/ports/personal.repository';
import { Cliente } from '../../src/mantenimiento/domain/cliente';
import { Proyecto } from '../../src/mantenimiento/domain/proyecto';
import { ServicioContratado } from '../../src/mantenimiento/domain/servicio-contratado';
import { Insumo } from '../../src/mantenimiento/domain/insumo';
import { Equipo } from '../../src/mantenimiento/domain/equipo';
import { Personal } from '../../src/mantenimiento/domain/personal';

describe('Kysely Repositories contra PostgreSQL real (GAF-21 & GAF-22)', () => {
  let t: TestApp;
  let clienteRepo: ClienteRepository;
  let proyectoRepo: ProyectoRepository;
  let servicioRepo: ServicioContratadoRepository;
  let insumoRepo: InsumoRepository;
  let equipoRepo: EquipoRepository;
  let personalRepo: PersonalRepository;

  beforeAll(async () => {
    t = await createTestApp();
    clienteRepo = t.app.get<ClienteRepository>(CLIENTE_REPOSITORY);
    proyectoRepo = t.app.get<ProyectoRepository>(PROYECTO_REPOSITORY);
    servicioRepo = t.app.get<ServicioContratadoRepository>(SERVICIO_CONTRATADO_REPOSITORY);
    insumoRepo = t.app.get<InsumoRepository>(INSUMO_REPOSITORY);
    equipoRepo = t.app.get<EquipoRepository>(EQUIPO_REPOSITORY);
    personalRepo = t.app.get<PersonalRepository>(PERSONAL_REPOSITORY);
  });

  beforeEach(async () => {
    await resetDb(t.db);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('KyselyClienteRepository', () => {
    it('guarda, busca por ID, RUC y código corto con camposExtra en PostgreSQL', async () => {
      const cliente = new Cliente({
        razonSocial: 'Consorcio Energetico del Sur S.A.',
        ruc: '20601234567',
        codigoCorto: 'CESUR',
        direccionFiscal: 'Av. Costanera 100, Islay',
        giroNegocio: 'Energía',
        contactoNombre: 'Valeria Gomez',
        contactoCargo: 'Supervisora Ambiental',
        contactoTelefono: '958111222',
        contactoCorreo: 'vgomez@cesur.pe',
        camposExtra: { sector: 'Privado', iso14001: true },
      });

      await clienteRepo.guardar(cliente);

      const porId = await clienteRepo.buscarPorId(cliente.id);
      expect(porId).not.toBeNull();
      expect(porId?.razonSocial).toBe('Consorcio Energetico del Sur S.A.');
      expect(porId?.ruc).toBe('20601234567');
      expect(porId?.codigoCorto).toBe('CESUR');
      expect(porId?.camposExtra).toEqual({ sector: 'Privado', iso14001: true });

      const porRuc = await clienteRepo.buscarPorRuc('20601234567');
      expect(porRuc?.id).toBe(cliente.id);

      const porCodigo = await clienteRepo.buscarPorCodigoCorto('CESUR');
      expect(porCodigo?.id).toBe(cliente.id);

      // Actualizar vía guardar (on conflict)
      cliente.actualizarDatos({
        razonSocial: 'Consorcio Energetico del Sur S.A.C.',
        direccionFiscal: 'Av. Costanera 200, Islay',
        camposExtra: { sector: 'Privado', iso14001: true, nivelRiesgo: 'Alto' },
      });
      await clienteRepo.guardar(cliente);

      const actualizado = await clienteRepo.buscarPorId(cliente.id);
      expect(actualizado?.razonSocial).toBe('Consorcio Energetico del Sur S.A.C.');
      expect(actualizado?.direccionFiscal).toBe('Av. Costanera 200, Islay');
      expect(actualizado?.camposExtra).toEqual({
        sector: 'Privado',
        iso14001: true,
        nivelRiesgo: 'Alto',
      });
    });

    it('lista todos los clientes ordenados por razón social', async () => {
      const c1 = new Cliente({
        razonSocial: 'Beta Mining S.A.',
        ruc: '20600000001',
        codigoCorto: 'BETA_M',
        direccionFiscal: 'Mollendo',
        giroNegocio: 'Minería',
        contactoNombre: 'C1',
        contactoCargo: 'Jefe',
        contactoTelefono: '958000001',
        contactoCorreo: 'c1@beta.pe',
      });
      const c2 = new Cliente({
        razonSocial: 'Alfa Generación S.A.',
        ruc: '20600000002',
        codigoCorto: 'ALFA_G',
        direccionFiscal: 'Arequipa',
        giroNegocio: 'Electricidad',
        contactoNombre: 'C2',
        contactoCargo: 'Jefe',
        contactoTelefono: '958000002',
        contactoCorreo: 'c2@alfa.pe',
      });

      await clienteRepo.guardar(c1);
      await clienteRepo.guardar(c2);

      const lista = await clienteRepo.listarTodos();
      expect(lista.length).toBe(2);
      expect(lista[0].razonSocial).toBe('Alfa Generación S.A.');
      expect(lista[1].razonSocial).toBe('Beta Mining S.A.');
    });
  });

  describe('KyselyProyectoRepository', () => {
    it('guarda y consulta proyectos por ID, clienteId y cliente+nombre', async () => {
      const cliente = new Cliente({
        razonSocial: 'Terminal Portuario Mollendo S.A.',
        ruc: '20509876543',
        codigoCorto: 'TPM',
        direccionFiscal: 'Puerto Mollendo',
        giroNegocio: 'Portuario',
        contactoNombre: 'Carlos Diaz',
        contactoCargo: 'Gerente Operaciones',
        contactoTelefono: '954111333',
        contactoCorreo: 'cdiaz@tpm.pe',
      });
      await clienteRepo.guardar(cliente);

      const proyecto = new Proyecto({
        clienteId: cliente.id,
        nombre: 'MUELLE_PRINCIPAL',
        direccionSede: 'Av. Costanera Muelle 1',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Jorge Luna',
        contactoCargo: 'Capitán de Muelle',
        contactoTelefono: '954222333',
        observaciones: 'Ingreso con EPP náutico',
      });
      await proyectoRepo.guardar(proyecto);

      const porId = await proyectoRepo.buscarPorId(proyecto.id);
      expect(porId).not.toBeNull();
      expect(porId?.nombre).toBe('MUELLE_PRINCIPAL');
      expect(porId?.contactoCargo).toBe('Capitán de Muelle');
      expect(porId?.observaciones).toBe('Ingreso con EPP náutico');

      const porCliente = await proyectoRepo.buscarPorClienteId(cliente.id);
      expect(porCliente.length).toBe(1);
      expect(porCliente[0].id).toBe(proyecto.id);

      const porClienteYNombre = await proyectoRepo.buscarPorClienteYNombre(
        cliente.id,
        'MUELLE_PRINCIPAL',
      );
      expect(porClienteYNombre?.id).toBe(proyecto.id);

      // Actualizar datos
      proyecto.actualizarDatos({
        contactoCargo: 'Jefe de Operaciones Marítimas',
        observaciones: 'Ingreso con EPP náutico y chaleco salvavidas',
      });
      await proyectoRepo.guardar(proyecto);

      const actualizado = await proyectoRepo.buscarPorId(proyecto.id);
      expect(actualizado?.contactoCargo).toBe('Jefe de Operaciones Marítimas');
      expect(actualizado?.observaciones).toBe('Ingreso con EPP náutico y chaleco salvavidas');
    });
  });

  describe('KyselyServicioContratadoRepository', () => {
    it('guarda servicio con insumos, dosis y equipos y los recupera correctamente', async () => {
      const cliente = new Cliente({
        razonSocial: 'Planta Industrial Islay S.A.',
        ruc: '20501112223',
        codigoCorto: 'PLAIS',
        direccionFiscal: 'Carretera Matarani Km 5',
        giroNegocio: 'Industrial',
        contactoNombre: 'Luis Vega',
        contactoCargo: 'Superintendente',
        contactoTelefono: '954777888',
        contactoCorreo: 'lvega@plais.pe',
      });
      await clienteRepo.guardar(cliente);

      const proyecto = new Proyecto({
        clienteId: cliente.id,
        nombre: 'ALMACEN_CENTRAL',
        direccionSede: 'Zona Industrial Lote 4',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Ana Torres',
        contactoCargo: 'Jefa de Almacén',
        contactoTelefono: '954888999',
      });
      await proyectoRepo.guardar(proyecto);

      const insumoId1 = '11111111-1111-4111-8111-111111111111';
      const insumoId2 = '22222222-2222-4111-8111-222222222222';
      const equipoId1 = '33333333-3333-4111-8111-333333333333';

      const servicio = new ServicioContratado({
        proyectoId: proyecto.id,
        tipoServicio: 'DSF',
        frecuencia: 'MENSUAL',
        areaTotalM2: 8500.5,
        areaTratarM2: 6000.0,
        insumosAutorizados: [insumoId1, insumoId2],
        equiposAutorizados: [equipoId1],
        dosisReferencial: {
          [insumoId1]: '5 ml / Litro',
          [insumoId2]: '10 g / m2',
        },
        requiereCertificado: true,
        vigenciaDias: 30,
      });

      await servicioRepo.guardar(servicio);

      const porId = await servicioRepo.buscarPorId(servicio.id);
      expect(porId).not.toBeNull();
      expect(porId?.tipoServicio).toBe('DSF');
      expect(porId?.frecuencia).toBe('MENSUAL');
      expect(porId?.areaTotalM2).toBe(8500.5);
      expect(porId?.areaTratarM2).toBe(6000.0);
      expect(porId?.insumosAutorizados).toEqual([insumoId1, insumoId2]);
      expect(porId?.equiposAutorizados).toEqual([equipoId1]);
      expect(porId?.dosisReferencial).toEqual({
        [insumoId1]: '5 ml / Litro',
        [insumoId2]: '10 g / m2',
      });
      expect(porId?.requiereCertificado).toBe(true);
      expect(porId?.vigenciaDias).toBe(30);

      const porProyecto = await servicioRepo.buscarPorProyectoId(proyecto.id);
      expect(porProyecto.length).toBe(1);
      expect(porProyecto[0].id).toBe(servicio.id);

      // Actualizar servicio
      servicio.actualizarDatos({
        frecuencia: 'BIMESTRAL',
        areaTratarM2: 7000.0,
        vigenciaDias: 60,
      });
      await servicioRepo.guardar(servicio);

      const actualizado = await servicioRepo.buscarPorId(servicio.id);
      expect(actualizado?.frecuencia).toBe('BIMESTRAL');
      expect(actualizado?.areaTratarM2).toBe(7000.0);
      expect(actualizado?.vigenciaDias).toBe(60);
    });
  });

  describe('KyselyInsumoRepository', () => {
    it('guarda, busca por ID y DIGESA, y lista activos y todos en PostgreSQL', async () => {
      const insumo1 = new Insumo({
        nombreComercial: 'Cipermetrina 25%',
        principioActivo: 'Cipermetrina',
        presentacion: 'LIQUIDO',
        unidadMedida: 'L',
        registroDigesa: 'RD-1001-2026',
        concentracion: '25% p/v',
        dosisEstandar: '5 ml / L',
        fichaTecnicaKey: 'fichas/ciper.pdf',
        hojaMsdsKey: 'msds/ciper.pdf',
        resolucionKey: 'res/rd-1001.pdf',
        proveedor: 'Bayer S.A.',
        estado: 'ACTIVO',
      });
      const insumo2 = new Insumo({
        nombreComercial: 'Bromadiolona Cebo',
        principioActivo: 'Bromadiolona',
        presentacion: 'BLOQUE',
        unidadMedida: 'BLOQUE',
        registroDigesa: 'RD-1002-2026',
        concentracion: '0.005%',
        dosisEstandar: '1 bloque / estacion',
        fichaTecnicaKey: 'fichas/broma.pdf',
        hojaMsdsKey: 'msds/broma.pdf',
        estado: 'INACTIVO',
      });

      await insumoRepo.guardar(insumo1);
      await insumoRepo.guardar(insumo2);

      const porId = await insumoRepo.buscarPorId(insumo1.id);
      expect(porId).not.toBeNull();
      expect(porId?.nombreComercial).toBe('Cipermetrina 25%');
      expect(porId?.resolucionKey).toBe('res/rd-1001.pdf');

      const porDigesa = await insumoRepo.buscarPorDigesa('RD-1002-2026');
      expect(porDigesa?.id).toBe(insumo2.id);

      const activos = await insumoRepo.listarActivos();
      expect(activos.length).toBe(1);
      expect(activos[0].id).toBe(insumo1.id);

      const todos = await insumoRepo.listarTodos();
      expect(todos.length).toBe(2);

      // Actualizar insumo vía guardar
      insumo1.actualizar({
        nombreComercial: 'Cipermetrina 50% Concentrada',
        concentracion: '50% p/v',
      });
      await insumoRepo.guardar(insumo1);

      const actualizado = await insumoRepo.buscarPorId(insumo1.id);
      expect(actualizado?.nombreComercial).toBe('Cipermetrina 50% Concentrada');
      expect(actualizado?.concentracion).toBe('50% p/v');
    });
  });

  describe('KyselyEquipoRepository', () => {
    it('guarda, busca por código interno, lista operativos y todos en PostgreSQL', async () => {
      const eq1 = new Equipo({
        codigoInterno: 'EQ-NEB-01',
        nombre: 'Nebulizadora ULV',
        tipo: 'NEBULIZACION',
        marcaModelo: 'Vector Fog C-150',
        estadoOperativo: 'OPERATIVO',
        fechaAdquisicion: '2026-01-10',
        ultimoMantenimiento: '2026-06-01',
        proximoMantenimiento: '2026-12-01',
      });
      const eq2 = new Equipo({
        codigoInterno: 'EQ-ASP-01',
        nombre: 'Aspersora Manual',
        tipo: 'ASPERSION',
        marcaModelo: 'Guarany 20L',
        estadoOperativo: 'MANTENIMIENTO',
      });

      await equipoRepo.guardar(eq1);
      await equipoRepo.guardar(eq2);

      const porId = await equipoRepo.buscarPorId(eq1.id);
      expect(porId).not.toBeNull();
      expect(porId?.codigoInterno).toBe('EQ-NEB-01');
      expect(porId?.fechaAdquisicion).toBe('2026-01-10');

      const porCodigo = await equipoRepo.buscarPorCodigoInterno('EQ-ASP-01');
      expect(porCodigo?.id).toBe(eq2.id);
      expect(porCodigo?.estadoOperativo).toBe('MANTENIMIENTO');

      const operativos = await equipoRepo.listarOperativos();
      expect(operativos.length).toBe(1);
      expect(operativos[0].id).toBe(eq1.id);

      const todos = await equipoRepo.listarTodos();
      expect(todos.length).toBe(2);

      // Actualizar datos del equipo
      eq2.actualizarDatos({
        estadoOperativo: 'OPERATIVO',
        ultimoMantenimiento: '2026-09-20',
      });
      await equipoRepo.guardar(eq2);

      const eq2Actualizado = await equipoRepo.buscarPorId(eq2.id);
      expect(eq2Actualizado?.estadoOperativo).toBe('OPERATIVO');
      expect(eq2Actualizado?.ultimoMantenimiento).toBe('2026-09-20');
    });
  });

  describe('KyselyPersonalRepository', () => {
    it('guarda, busca por DNI y usuario, y gestiona ciclo de vida en PostgreSQL', async () => {
      const p1 = new Personal({
        dni: '45892312',
        nombres: 'Carlos',
        apellidos: 'Mendoza Ruiz',
        cargo: 'SUPERVISOR',
        telefono: '958111333',
        usuario: 'CMENDOZA',
        estado: 'ACTIVO',
      });
      const p2 = new Personal({
        dni: '70809010',
        nombres: 'Ramiro',
        apellidos: 'Vargas Luna',
        cargo: 'TECNICO_OPERADOR',
        telefono: '958222444',
        usuario: 'RVARGAS',
        estado: 'INACTIVO',
      });

      await personalRepo.guardar(p1);
      await personalRepo.guardar(p2);

      const porId = await personalRepo.buscarPorId(p1.id);
      expect(porId).not.toBeNull();
      expect(porId?.nombres).toBe('Carlos');
      expect(porId?.cargo).toBe('SUPERVISOR');

      const porDni = await personalRepo.buscarPorDni('70809010');
      expect(porDni?.id).toBe(p2.id);
      expect(porDni?.estado).toBe('INACTIVO');

      const porUsuario = await personalRepo.buscarPorUsuario('cmendoza');
      expect(porUsuario?.id).toBe(p1.id);

      const activos = await personalRepo.listarActivos();
      expect(activos.length).toBe(1);
      expect(activos[0].id).toBe(p1.id);

      const todos = await personalRepo.listarTodos();
      expect(todos.length).toBe(2);

      // Reactivar y actualizar
      p2.activar();
      p2.actualizarDatos({ telefono: '958999000' });
      await personalRepo.guardar(p2);

      const p2Actualizado = await personalRepo.buscarPorId(p2.id);
      expect(p2Actualizado?.estado).toBe('ACTIVO');
      expect(p2Actualizado?.telefono).toBe('958999000');
    });
  });
});
