import { createTestApp, TestApp } from '../support/app';
import { resetDb } from '../support/db';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../src/mantenimiento/domain/ports/cliente.repository';
import { PROYECTO_REPOSITORY, ProyectoRepository } from '../../src/mantenimiento/domain/ports/proyecto.repository';
import {
  SERVICIO_CONTRATADO_REPOSITORY,
  ServicioContratadoRepository,
} from '../../src/mantenimiento/domain/ports/servicio-contratado.repository';
import { Cliente } from '../../src/mantenimiento/domain/cliente';
import { Proyecto } from '../../src/mantenimiento/domain/proyecto';
import { ServicioContratado } from '../../src/mantenimiento/domain/servicio-contratado';

describe('Kysely Repositories contra PostgreSQL real (GAF-21)', () => {
  let t: TestApp;
  let clienteRepo: ClienteRepository;
  let proyectoRepo: ProyectoRepository;
  let servicioRepo: ServicioContratadoRepository;

  beforeAll(async () => {
    t = await createTestApp();
    clienteRepo = t.app.get<ClienteRepository>(CLIENTE_REPOSITORY);
    proyectoRepo = t.app.get<ProyectoRepository>(PROYECTO_REPOSITORY);
    servicioRepo = t.app.get<ServicioContratadoRepository>(SERVICIO_CONTRATADO_REPOSITORY);
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
});
