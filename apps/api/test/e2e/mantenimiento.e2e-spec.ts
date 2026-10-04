import { createTestApp, TestApp } from '../support/app';
import { asignarClavePrueba, autorizacion, autorizacionDePersonal, CLAVE_PRUEBA } from '../support/auth';
import { resetDb, leerSnapshotCrudo, sembrarInspeccionCerrada } from '../support/db';
import { api, Api } from '../support/fixtures';

describe('Mantenimiento API E2E contra PostgreSQL real (GAF-21, GAF-22 & GAF-23)', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t.baseUrl);
  });

  beforeEach(async () => {
    await resetDb(t.db);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('Flujo de Clientes y Ficha de Cliente', () => {
    it('crea cliente, consulta su ficha con camposExtra y actualiza sus datos', async () => {
      // 1. Crear cliente
      const crearRes = await http.post('/mantenimiento/clientes', {
        razonSocial: 'Consorcio Energetico del Sur S.A.',
        ruc: '20601234567',
        codigoCorto: 'CESUR',
        direccionFiscal: 'Av. Costanera 100, Islay',
        giroNegocio: 'Generación Eléctrica',
        contactoNombre: 'Carlos Ramos',
        contactoCargo: 'Jefe de SSOMA',
        contactoTelefono: '958123456',
        contactoCorreo: 'cramos@cesur.pe',
        camposExtra: { sector: 'Privado', nivelTension: '220kV' },
      });

      expect(crearRes.status).toBe(201);
      const clienteId = crearRes.body.id;
      expect(clienteId).toBeDefined();
      expect(crearRes.body.razonSocial).toBe('Consorcio Energetico del Sur S.A.');
      expect(crearRes.body.ruc).toBe('20601234567');
      expect(crearRes.body.codigoCorto).toBe('CESUR');
      expect(crearRes.body.estado).toBe('ACTIVO');

      // 2. Obtener ficha completa de cliente
      const fichaRes = await http.get(`/mantenimiento/clientes/${clienteId}`);
      expect(fichaRes.status).toBe(200);
      expect(fichaRes.body.direccionFiscal).toBe('Av. Costanera 100, Islay');
      expect(fichaRes.body.contactoCargo).toBe('Jefe de SSOMA');
      expect(fichaRes.body.camposExtra).toEqual({
        sector: 'Privado',
        nivelTension: '220kV',
      });

      // 3. Listar clientes con paginación
      const listaRes = await http.get('/mantenimiento/clientes?limit=10&offset=0&busqueda=CESUR');
      expect(listaRes.status).toBe(200);
      expect(listaRes.body.total).toBe(1);
      expect(listaRes.body.items[0].id).toBe(clienteId);

      // 4. Actualizar cliente
      const updateRes = await http.patch(`/mantenimiento/clientes/${clienteId}`, {
        razonSocial: 'Consorcio Energetico del Sur S.A.C.',
        direccionFiscal: 'Av. Costanera 200, Islay',
        contactoTelefono: '958999888',
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.razonSocial).toBe('Consorcio Energetico del Sur S.A.C.');
      expect(updateRes.body.direccionFiscal).toBe('Av. Costanera 200, Islay');
      expect(updateRes.body.contactoTelefono).toBe('958999888');

      // 5. Desactivar y reactivar cliente
      const desactRes = await http.patch(`/mantenimiento/clientes/${clienteId}/desactivar`);
      expect(desactRes.status).toBe(200);
      expect(desactRes.body.estado).toBe('INACTIVO');

      const actRes = await http.patch(`/mantenimiento/clientes/${clienteId}/activar`);
      expect(actRes.status).toBe(200);
      expect(actRes.body.estado).toBe('ACTIVO');
    });

    it('rechaza cliente con RUC o código corto duplicado', async () => {
      await http.post('/mantenimiento/clientes', {
        razonSocial: 'Empresa A',
        ruc: '20601234567',
        codigoCorto: 'EMPA',
        direccionFiscal: 'Calle 1',
        giroNegocio: 'Comercio',
        contactoNombre: 'Juan',
        contactoCargo: 'Admin',
        contactoTelefono: '958111222',
        contactoCorreo: 'admin@empa.pe',
      });

      const dupRucRes = await http.post('/mantenimiento/clientes', {
        razonSocial: 'Empresa B',
        ruc: '20601234567',
        codigoCorto: 'EMPB',
        direccionFiscal: 'Calle 2',
        giroNegocio: 'Comercio',
        contactoNombre: 'Pedro',
        contactoCargo: 'Admin',
        contactoTelefono: '958333444',
        contactoCorreo: 'admin@empb.pe',
      });
      expect(dupRucRes.status).toBe(409);

      const dupCodRes = await http.post('/mantenimiento/clientes', {
        razonSocial: 'Empresa C',
        ruc: '20609999999',
        codigoCorto: 'EMPA',
        direccionFiscal: 'Calle 3',
        giroNegocio: 'Comercio',
        contactoNombre: 'Maria',
        contactoCargo: 'Admin',
        contactoTelefono: '958555666',
        contactoCorreo: 'admin@empc.pe',
      });
      expect(dupCodRes.status).toBe(409);
    });
  });

  describe('Flujo de Proyectos (Sedes Físicas)', () => {
    it('crea proyecto, lo consulta por ID, lo lista por cliente y lo actualiza', async () => {
      const clienteRes = await http.post('/mantenimiento/clientes', {
        razonSocial: 'Minera Los Andes S.A.',
        ruc: '20505554443',
        codigoCorto: 'MLAND',
        direccionFiscal: 'Av. Minería 500',
        giroNegocio: 'Minería',
        contactoNombre: 'Elena Rios',
        contactoCargo: 'Supervisora General',
        contactoTelefono: '954123789',
        contactoCorreo: 'erios@losandes.pe',
      });
      const clienteId = clienteRes.body.id;

      // 1. Crear sede
      const crearSedeRes = await http.post('/mantenimiento/proyectos', {
        clienteId,
        nombre: 'PLANTA_CONCENTRADORA',
        direccionSede: 'Quebrada Honda Km 45',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Raul Morales',
        contactoCargo: 'Jefe de Planta',
        contactoTelefono: '954000111',
        observaciones: 'Pase médico minero de 3000 msnm',
      });

      expect(crearSedeRes.status).toBe(201);
      const sedeId = crearSedeRes.body.id;
      expect(sedeId).toBeDefined();
      expect(crearSedeRes.body.clienteId).toBe(clienteId);
      expect(crearSedeRes.body.nombre).toBe('PLANTA_CONCENTRADORA');
      expect(crearSedeRes.body.contactoCargo).toBe('Jefe de Planta');
      expect(crearSedeRes.body.observaciones).toBe('Pase médico minero de 3000 msnm');
      expect(crearSedeRes.body.estado).toBe('ACTIVO');

      // 2. Obtener sede por ID
      const getSedeRes = await http.get(`/mantenimiento/proyectos/${sedeId}`);
      expect(getSedeRes.status).toBe(200);
      expect(getSedeRes.body.nombre).toBe('PLANTA_CONCENTRADORA');
      expect(getSedeRes.body.direccionSede).toBe('Quebrada Honda Km 45');
      expect(getSedeRes.body.contactoCargo).toBe('Jefe de Planta');
      expect(getSedeRes.body.observaciones).toBe('Pase médico minero de 3000 msnm');

      // 3. Listar sedes por cliente
      const listarSedesRes = await http.get(`/mantenimiento/proyectos/cliente/${clienteId}`);
      expect(listarSedesRes.status).toBe(200);
      expect(listarSedesRes.body.length).toBe(1);
      expect(listarSedesRes.body[0].id).toBe(sedeId);

      // 4. Actualizar sede
      const updateSedeRes = await http.patch(`/mantenimiento/proyectos/${sedeId}`, {
        nombre: 'PLANTA_CONCENTRADORA_SUR',
        contactoCargo: 'Superintendente de Planta',
        observaciones: 'Ingreso únicamente con camioneta 4x4 y pértiga',
      });
      expect(updateSedeRes.status).toBe(200);
      expect(updateSedeRes.body.nombre).toBe('PLANTA_CONCENTRADORA_SUR');
      expect(updateSedeRes.body.contactoCargo).toBe('Superintendente de Planta');
      expect(updateSedeRes.body.observaciones).toBe(
        'Ingreso únicamente con camioneta 4x4 y pértiga',
      );

      // 5. Desactivar y activar sede
      const desactRes = await http.patch(`/mantenimiento/proyectos/${sedeId}/desactivar`);
      expect(desactRes.status).toBe(200);
      expect(desactRes.body.estado).toBe('INACTIVO');

      const actRes = await http.patch(`/mantenimiento/proyectos/${sedeId}/activar`);
      expect(actRes.status).toBe(200);
      expect(actRes.body.estado).toBe('ACTIVO');
    });

    it('rechaza sede con nombre duplicado para el mismo cliente', async () => {
      const clienteRes = await http.post('/mantenimiento/clientes', {
        razonSocial: 'Agroexportadora del Sur S.A.',
        ruc: '20509998887',
        codigoCorto: 'AGROSUR',
        direccionFiscal: 'Valle de Tambo',
        giroNegocio: 'Agrícola',
        contactoNombre: 'Hugo Paz',
        contactoCargo: 'Gerente',
        contactoTelefono: '958777666',
        contactoCorreo: 'hpaz@agrosur.pe',
      });
      const clienteId = clienteRes.body.id;

      await http.post('/mantenimiento/proyectos', {
        clienteId,
        nombre: 'FUNDO_TAMBO',
        direccionSede: 'Sector El Arenal',
        distrito: 'Dean Valdivia',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Hugo Paz',
        contactoCargo: 'Gerente',
        contactoTelefono: '958777666',
      });

      const dupRes = await http.post('/mantenimiento/proyectos', {
        clienteId,
        nombre: 'FUNDO_TAMBO',
        direccionSede: 'Sector El Fiscal',
        distrito: 'Cocachacra',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Hugo Paz',
        contactoCargo: 'Gerente',
        contactoTelefono: '958777666',
      });
      expect(dupRes.status).toBe(409);
    });
  });

  describe('Flujo de Servicios Contratados por Sede (con insumos, dosis y equipos)', () => {
    it('crea servicio contratado, verifica respuesta completa, consulta por ID y proyecto, y actualiza', async () => {
      // 1. Crear cliente y proyecto
      const clienteRes = await http.post('/mantenimiento/clientes', {
        razonSocial: 'Pesquera Hayduk S.A.',
        ruc: '20401112223',
        codigoCorto: 'HAYDUK',
        direccionFiscal: 'Puerto Mollendo',
        giroNegocio: 'Pesca y Harina',
        contactoNombre: 'Manuel Sosa',
        contactoCargo: 'Jefe de Calidad',
        contactoTelefono: '954333222',
        contactoCorreo: 'msosa@hayduk.pe',
      });
      const clienteId = clienteRes.body.id;

      const sedeRes = await http.post('/mantenimiento/proyectos', {
        clienteId,
        nombre: 'PLANTA_HARINA',
        direccionSede: 'Zona Industrial Puerto',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Manuel Sosa',
        contactoCargo: 'Jefe de Calidad',
        contactoTelefono: '954333222',
      });
      const proyectoId = sedeRes.body.id;

      // 2. Crear insumo químico en catálogo
      const insumoRes = await http.post('/mantenimiento/insumos', {
        nombreComercial: 'Deltametrina 2.5% EC',
        principioActivo: 'Deltametrina',
        presentacion: 'LIQUIDO',
        unidadMedida: 'L',
        registroDigesa: 'RD-0888-2025/DIGESA/SA',
        concentracion: '2.5% p/v',
        dosisEstandar: '10 ml / Litro',
        fichaTecnicaKey: 'insumos/fichas/deltametrina.pdf',
        hojaMsdsKey: 'insumos/msds/deltametrina.pdf',
      });
      const insumoId = insumoRes.body.id;

      // 3. Crear equipo en catálogo
      const equipoRes = await http.post('/mantenimiento/equipos', {
        codigoInterno: 'EQ-TERM-01',
        nombre: 'Termonebulizadora PulsFOG K-10-SP',
        tipo: 'NEBULIZACION',
        marcaModelo: 'PulsFOG K-10-SP',
        estadoOperativo: 'OPERATIVO',
      });
      const equipoId = equipoRes.body.id;

      // 4. Crear Servicio Contratado con insumos, equipos y dosis
      const crearServRes = await http.post('/mantenimiento/servicios-contratados', {
        proyectoId,
        tipoServicio: 'DSF',
        frecuencia: 'MENSUAL',
        areaTotalM2: 8000.0,
        areaTratarM2: 5500.0,
        insumosAutorizados: [insumoId],
        equiposAutorizados: [equipoId],
        dosisReferencial: { [insumoId]: '10 ml / Litro de agua' },
        requiereCertificado: true,
        vigenciaDias: 30,
      });

      expect(crearServRes.status).toBe(201);
      const servicioId = crearServRes.body.id;
      expect(servicioId).toBeDefined();
      expect(crearServRes.body.proyectoId).toBe(proyectoId);
      expect(crearServRes.body.tipoServicio).toBe('DSF');
      expect(crearServRes.body.frecuencia).toBe('MENSUAL');
      expect(crearServRes.body.areaTotalM2).toBe(8000);
      expect(crearServRes.body.areaTratarM2).toBe(5500);
      expect(crearServRes.body.insumosAutorizados).toEqual([insumoId]);
      expect(crearServRes.body.equiposAutorizados).toEqual([equipoId]);
      expect(crearServRes.body.dosisReferencial).toEqual({ [insumoId]: '10 ml / Litro de agua' });
      expect(crearServRes.body.requiereCertificado).toBe(true);
      expect(crearServRes.body.vigenciaDias).toBe(30);
      expect(crearServRes.body.estado).toBe('ACTIVO');

      // 5. Obtener Servicio Contratado por ID
      const getServRes = await http.get(`/mantenimiento/servicios-contratados/${servicioId}`);
      expect(getServRes.status).toBe(200);
      expect(getServRes.body.id).toBe(servicioId);
      expect(getServRes.body.insumosAutorizados).toEqual([insumoId]);
      expect(getServRes.body.equiposAutorizados).toEqual([equipoId]);
      expect(getServRes.body.dosisReferencial).toEqual({ [insumoId]: '10 ml / Litro de agua' });

      // 6. Listar Servicios Contratados por Sede
      const listServRes = await http.get(
        `/mantenimiento/servicios-contratados/proyecto/${proyectoId}`,
      );
      expect(listServRes.status).toBe(200);
      expect(listServRes.body.length).toBe(1);
      expect(listServRes.body[0].insumosAutorizados).toEqual([insumoId]);
      expect(listServRes.body[0].equiposAutorizados).toEqual([equipoId]);
      expect(listServRes.body[0].dosisReferencial).toEqual({
        [insumoId]: '10 ml / Litro de agua',
      });

      // 7. Actualizar Servicio Contratado
      const updateServRes = await http.patch(
        `/mantenimiento/servicios-contratados/${servicioId}`,
        {
          frecuencia: 'BIMESTRAL',
          areaTratarM2: 6000.0,
          dosisReferencial: { [insumoId]: '12 ml / Litro de agua' },
          vigenciaDias: 60,
        },
      );
      expect(updateServRes.status).toBe(200);
      expect(updateServRes.body.frecuencia).toBe('BIMESTRAL');
      expect(updateServRes.body.areaTratarM2).toBe(6000);
      expect(updateServRes.body.dosisReferencial).toEqual({
        [insumoId]: '12 ml / Litro de agua',
      });
      expect(updateServRes.body.vigenciaDias).toBe(60);

      // 8. Desactivar y activar servicio contratado
      const desactRes = await http.patch(
        `/mantenimiento/servicios-contratados/${servicioId}/desactivar`,
      );
      expect(desactRes.status).toBe(200);
      expect(desactRes.body.estado).toBe('INACTIVO');

      const actRes = await http.patch(
        `/mantenimiento/servicios-contratados/${servicioId}/activar`,
      );
      expect(actRes.status).toBe(200);
      expect(actRes.body.estado).toBe('ACTIVO');
    });

    it('rechaza servicio contratado si área a tratar supera el área total', async () => {
      const clienteRes = await http.post('/mantenimiento/clientes', {
        razonSocial: 'Local Comercial Sur',
        ruc: '20509990001',
        codigoCorto: 'LOCSUR',
        direccionFiscal: 'Calle Comercio 10',
        giroNegocio: 'Retail',
        contactoNombre: 'Pedro',
        contactoCargo: 'Admin',
        contactoTelefono: '958123000',
        contactoCorreo: 'admin@locsur.pe',
      });
      const sedeRes = await http.post('/mantenimiento/proyectos', {
        clienteId: clienteRes.body.id,
        nombre: 'TIENDA_MOLLENDO',
        direccionSede: 'Calle Comercio 10',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Pedro',
        contactoCargo: 'Admin',
        contactoTelefono: '958123000',
      });

      const badAreaRes = await http.post('/mantenimiento/servicios-contratados', {
        proyectoId: sedeRes.body.id,
        tipoServicio: 'DRT',
        frecuencia: 'MENSUAL',
        areaTotalM2: 500,
        areaTratarM2: 600, // Invalido: 600 > 500
      });
      expect(badAreaRes.status).toBe(400);
    });
  });

  describe('Flujo de Catálogo de Insumos (GAF-22)', () => {
    it('crea, consulta, lista, actualiza y gestiona ciclo de vida de un insumo', async () => {
      // 1. Crear insumo
      const crearRes = await http.post('/mantenimiento/insumos', {
        nombreComercial: 'Cipermetrina 25% EC',
        principioActivo: 'Cipermetrina',
        presentacion: 'LIQUIDO',
        unidadMedida: 'L',
        registroDigesa: 'RD-001-2026/DIGESA/SA',
        concentracion: '25% p/v',
        dosisEstandar: '5 ml / Litro',
        fichaTecnicaKey: 'insumos/fichas/cipermetrina.pdf',
        hojaMsdsKey: 'insumos/msds/cipermetrina.pdf',
        resolucionKey: 'insumos/resoluciones/rd-001.pdf',
        proveedor: 'Bayer S.A.',
      });
      expect(crearRes.status).toBe(201);
      const insumoId = crearRes.body.id;
      expect(insumoId).toBeDefined();
      expect(crearRes.body.estado).toBe('ACTIVO');

      // 2. Obtener por ID
      const porIdRes = await http.get(`/mantenimiento/insumos/${insumoId}`);
      expect(porIdRes.status).toBe(200);
      expect(porIdRes.body.nombreComercial).toBe('Cipermetrina 25% EC');
      expect(porIdRes.body.resolucionKey).toBe('insumos/resoluciones/rd-001.pdf');

      // 3. Listar con paginación y búsqueda
      const listaRes = await http.get('/mantenimiento/insumos?limit=10&offset=0&busqueda=Cipermetrina');
      expect(listaRes.status).toBe(200);
      expect(listaRes.body.total).toBe(1);
      expect(listaRes.body.items[0].id).toBe(insumoId);

      // 4. Actualizar insumo
      const updateRes = await http.patch(`/mantenimiento/insumos/${insumoId}`, {
        nombreComercial: 'Cipermetrina 50% Ultra',
        concentracion: '50% p/v',
        dosisEstandar: '2.5 ml / Litro',
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.nombreComercial).toBe('Cipermetrina 50% Ultra');
      expect(updateRes.body.concentracion).toBe('50% p/v');

      // 5. Desactivar y activar
      const desactRes = await http.patch(`/mantenimiento/insumos/${insumoId}/desactivar`);
      expect(desactRes.status).toBe(200);
      expect(desactRes.body.estado).toBe('INACTIVO');

      const actRes = await http.patch(`/mantenimiento/insumos/${insumoId}/activar`);
      expect(actRes.status).toBe(200);
      expect(actRes.body.estado).toBe('ACTIVO');
    });

    it('rechaza insumo con código DIGESA duplicado', async () => {
      await http.post('/mantenimiento/insumos', {
        nombreComercial: 'Insumo Alfa',
        principioActivo: 'Principio A',
        presentacion: 'LIQUIDO',
        unidadMedida: 'L',
        registroDigesa: 'RD-DUP-2026',
        concentracion: '10%',
        dosisEstandar: '1 ml/L',
        fichaTecnicaKey: 'fichas/a.pdf',
        hojaMsdsKey: 'msds/a.pdf',
      });

      const dupRes = await http.post('/mantenimiento/insumos', {
        nombreComercial: 'Insumo Beta',
        principioActivo: 'Principio B',
        presentacion: 'POLVO',
        unidadMedida: 'KG',
        registroDigesa: 'RD-DUP-2026',
        concentracion: '20%',
        dosisEstandar: '2 g/L',
        fichaTecnicaKey: 'fichas/b.pdf',
        hojaMsdsKey: 'msds/b.pdf',
      });
      expect(dupRes.status).toBe(409);
    });
  });

  describe('Flujo de Catálogo de Equipos (GAF-22)', () => {
    it('crea, consulta, lista, actualiza y gestiona estado operativo de un equipo', async () => {
      // 1. Crear equipo
      const crearRes = await http.post('/mantenimiento/equipos', {
        codigoInterno: 'EQ-NEB-05',
        nombre: 'Nebulizadora ULV Vector Fog C-150',
        tipo: 'NEBULIZACION',
        marcaModelo: 'Vector Fog C-150',
        fechaAdquisicion: '2026-02-01',
        ultimoMantenimiento: '2026-06-01',
        proximoMantenimiento: '2026-12-01',
      });
      expect(crearRes.status).toBe(201);
      const equipoId = crearRes.body.id;
      expect(equipoId).toBeDefined();
      expect(crearRes.body.codigoInterno).toBe('EQ-NEB-05');
      expect(crearRes.body.estadoOperativo).toBe('OPERATIVO');

      // 2. Obtener por ID
      const porIdRes = await http.get(`/mantenimiento/equipos/${equipoId}`);
      expect(porIdRes.status).toBe(200);
      expect(porIdRes.body.nombre).toBe('Nebulizadora ULV Vector Fog C-150');
      expect(porIdRes.body.fechaAdquisicion).toBe('2026-02-01');

      // 3. Listar con búsqueda
      const listaRes = await http.get('/mantenimiento/equipos?busqueda=NEB-05');
      expect(listaRes.status).toBe(200);
      expect(listaRes.body.total).toBe(1);
      expect(listaRes.body.items[0].id).toBe(equipoId);

      // 4. Actualizar datos de equipo
      const updateRes = await http.patch(`/mantenimiento/equipos/${equipoId}`, {
        nombre: 'Nebulizadora ULV Vector Fog C-150 Plus',
        marcaModelo: 'Vector Fog C-150 Plus',
        ultimoMantenimiento: '2026-09-15',
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.nombre).toBe('Nebulizadora ULV Vector Fog C-150 Plus');
      expect(updateRes.body.ultimoMantenimiento).toBe('2026-09-15');

      // 5. Cambiar estado operativo a MANTENIMIENTO y FUERA_SERVICIO
      const mantRes = await http.patch(`/mantenimiento/equipos/${equipoId}/estado`, {
        estadoOperativo: 'MANTENIMIENTO',
      });
      expect(mantRes.status).toBe(200);
      expect(mantRes.body.estadoOperativo).toBe('MANTENIMIENTO');

      const operRes = await http.patch(`/mantenimiento/equipos/${equipoId}/estado`, {
        estadoOperativo: 'OPERATIVO',
      });
      expect(operRes.status).toBe(200);
      expect(operRes.body.estadoOperativo).toBe('OPERATIVO');
    });

    it('rechaza equipo con código interno duplicado', async () => {
      await http.post('/mantenimiento/equipos', {
        codigoInterno: 'EQ-ASP-99',
        nombre: 'Aspersora 1',
        tipo: 'ASPERSION',
      });

      const dupRes = await http.post('/mantenimiento/equipos', {
        codigoInterno: 'EQ-ASP-99',
        nombre: 'Aspersora 2',
        tipo: 'ASPERSION',
      });
      expect(dupRes.status).toBe(409);
    });
  });

  describe('Flujo de Personal y Usuarios con Roles (GAF-22)', () => {
    it('crea personal técnico y supervisor, actualiza datos, gestiona estado y autentica', async () => {
      // 1. Crear supervisor con usuario
      const crearSupRes = await http.post('/mantenimiento/personal', {
        dni: '45892312',
        nombres: 'Daniel',
        apellidos: 'Amamani Cruz',
        cargo: 'SUPERVISOR',
        telefono: '958111222',
        usuario: 'DAMAMANI_NEW',
      });
      expect(crearSupRes.status).toBe(201);
      const supervisorId = crearSupRes.body.id;
      expect(supervisorId).toBeDefined();
      expect(crearSupRes.body.cargo).toBe('SUPERVISOR');
      expect(crearSupRes.body.estado).toBe('ACTIVO');

      // 2. Obtener por ID
      const porIdRes = await http.get(`/mantenimiento/personal/${supervisorId}`);
      expect(porIdRes.status).toBe(200);
      expect(porIdRes.body.dni).toBe('45892312');
      expect(porIdRes.body.usuario).toBe('DAMAMANI_NEW');

      // 3. Listar personal
      const listaRes = await http.get('/mantenimiento/personal?busqueda=Amamani');
      expect(listaRes.status).toBe(200);
      expect(listaRes.body.total).toBe(1);
      expect(listaRes.body.items[0].id).toBe(supervisorId);

      // 4. Actualizar datos de personal
      const updateRes = await http.patch(`/mantenimiento/personal/${supervisorId}`, {
        nombres: 'Daniel Alberto',
        telefono: '958999000',
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.nombres).toBe('Daniel Alberto');
      expect(updateRes.body.telefono).toBe('958999000');

      // 5. Sin clave guardada no hay sesión; con la clave (db:crear-usuario) sí
      const loginSinClaveRes = await http.post('/auth/login', {
        usuario: 'DAMAMANI_NEW',
        clave: CLAVE_PRUEBA,
        cliente: 'web',
      });
      expect(loginSinClaveRes.status).toBe(401);

      await asignarClavePrueba(t.db, 'DAMAMANI_NEW');
      const loginRes = await http.post('/auth/login', {
        usuario: 'DAMAMANI_NEW',
        clave: CLAVE_PRUEBA,
        cliente: 'web',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
      expect(loginRes.body.usuario.cargo).toBe('SUPERVISOR');

      // 6. Desactivar personal y verificar que login sea rechazado
      const desactRes = await http.patch(`/mantenimiento/personal/${supervisorId}/desactivar`);
      expect(desactRes.status).toBe(200);
      expect(desactRes.body.estado).toBe('INACTIVO');

      const loginInactivoRes = await http.post('/auth/login', {
        usuario: 'DAMAMANI_NEW',
        clave: CLAVE_PRUEBA,
        cliente: 'web',
      });
      expect(loginInactivoRes.status).toBe(403);
      expect(loginInactivoRes.body.message).toContain('inactivo');

      // 7. Reactivar personal
      const actRes = await http.patch(`/mantenimiento/personal/${supervisorId}/activar`);
      expect(actRes.status).toBe(200);
      expect(actRes.body.estado).toBe('ACTIVO');
    });

    it('rechaza personal con DNI o usuario duplicado', async () => {
      await http.post('/mantenimiento/personal', {
        dni: '12345678',
        nombres: 'Pedro',
        apellidos: 'Gomez',
        cargo: 'TECNICO_OPERADOR',
        telefono: '958000111',
        usuario: 'PGOMEZ',
      });

      const dupDniRes = await http.post('/mantenimiento/personal', {
        dni: '12345678',
        nombres: 'Otro',
        apellidos: 'Usuario',
        cargo: 'TECNICO_OPERADOR',
        telefono: '958000222',
      });
      expect(dupDniRes.status).toBe(409);

      const dupUserRes = await http.post('/mantenimiento/personal', {
        dni: '87654321',
        nombres: 'Tercero',
        apellidos: 'Usuario',
        cargo: 'TECNICO_OPERADOR',
        telefono: '958000333',
        usuario: 'PGOMEZ',
      });
      expect(dupUserRes.status).toBe(409);
    });
  });

  describe('Catálogos de Texto, Configuración y Bitácora de Auditoría (GAF-23)', () => {
    it('lista catálogos de texto filtrando los restringidos si no es ADMINISTRADOR', async () => {
      // 1. Como SUPERVISOR
      const resPublico = await http.get('/mantenimiento/catalogos-texto', autorizacion('SUPERVISOR'));
      expect(resPublico.status).toBe(200);
      expect(Array.isArray(resPublico.body)).toBe(true);
      expect(resPublico.body.length).toBe(5);
      const idsPublicos = resPublico.body.map((c: any) => c.id);
      expect(idsPublicos).toContain('hallazgos');
      expect(idsPublicos).toContain('acciones-correctivas');
      expect(idsPublicos).not.toContain('motivos-modificacion');

      // 2. Con rol ADMINISTRADOR
      const resAdmin = await http.get('/mantenimiento/catalogos-texto', autorizacion('ADMINISTRADOR'));
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.length).toBe(6);
      const idsAdmin = resAdmin.body.map((c: any) => c.id);
      expect(idsAdmin).toContain('motivos-modificacion');
    });

    it('controla acceso por ID a catálogos restringidos', async () => {
      // Acceso a catálogo estándar permitido a cualquier cargo con sesión
      const resHallazgos = await http.get('/mantenimiento/catalogos-texto/hallazgos', autorizacion('TECNICO_OPERADOR'));
      expect(resHallazgos.status).toBe(200);
      expect(resHallazgos.body.id).toBe('hallazgos');
      expect(resHallazgos.body.items).toContain('Roedores vivos');

      // Acceso a motivos-modificacion denegado sin rol ADMINISTRADOR
      const resMotivosBloqueado = await http.get('/mantenimiento/catalogos-texto/motivos-modificacion', autorizacion('SUPERVISOR'));
      expect(resMotivosBloqueado.status).toBe(403);

      // Acceso a motivos-modificacion permitido a ADMINISTRADOR
      const resMotivosOk = await http.get('/mantenimiento/catalogos-texto/motivos-modificacion', autorizacion('ADMINISTRADOR'));
      expect(resMotivosOk.status).toBe(200);
      expect(resMotivosOk.body.id).toBe('motivos-modificacion');
      expect(resMotivosOk.body.items).toContain('Error de digitación en campo');
    });

    it('actualiza lista de items y registra evento inmutable en auditoría', async () => {
      const resPut = await http.put(
        '/mantenimiento/catalogos-texto/hallazgos',
        {
          items: [
            'CUCARACHA AMERICANA (Periplaneta americana)',
            'MOSCA DOMESTICA (Musca domestica)',
          ],
        },
        await autorizacionDePersonal(t.db, 'ADMINISTRADOR', 'R.AGARATE'),
      );
      expect(resPut.status).toBe(200);
      expect(resPut.body.items).toEqual([
        'CUCARACHA AMERICANA (Periplaneta americana)',
        'MOSCA DOMESTICA (Musca domestica)',
      ]);

      // Verificar persistencia
      const resGet = await http.get('/mantenimiento/catalogos-texto/hallazgos');
      expect(resGet.status).toBe(200);
      expect(resGet.body.items).toHaveLength(2);

      // Agregar item individual sin duplicados
      const resPostItem = await http.post(
        '/mantenimiento/catalogos-texto/hallazgos/items',
        { item: 'ROEDOR DE TECHO (Rattus rattus)' },
        await autorizacionDePersonal(t.db, 'ADMINISTRADOR', 'R.AGARATE'),
      );
      expect(resPostItem.status).toBe(201);
      expect(resPostItem.body.items).toHaveLength(3);
      expect(resPostItem.body.items).toContain('ROEDOR DE TECHO (Rattus rattus)');
    });

    it('rechaza modificación de catálogos restringidos por usuarios no administradores', async () => {
      const resPut = await http.put(
        '/mantenimiento/catalogos-texto/motivos-modificacion',
        { items: ['Nuevo motivo no autorizado'] },
        autorizacion('SUPERVISOR'),
      );
      expect(resPut.status).toBe(403);

      const resPost = await http.post(
        '/mantenimiento/catalogos-texto/motivos-modificacion/items',
        { item: 'Otro motivo no autorizado' },
        autorizacion('SUPERVISOR'),
      );
      expect(resPost.status).toBe(403);
    });

    it('gestiona la configuración global del sistema y firma digital para PDFs (Decisión C7)', async () => {
      // 1. Obtener configuración inicial
      const resGet = await http.get('/mantenimiento/configuracion');
      expect(resGet.status).toBe(200);
      expect(resGet.body.id).toBe('global');
      expect(resGet.body.director.nombre).toBe('Ing. Carlos Medina Ruiz');
      expect(resGet.body.director.cip).toBe('84512');
      expect(resGet.body.resolucionSanitaria).toBe('0023-2024-DESA/MINSA');

      // 2. Rechaza actualización por no administrador
      const resPatchBloqueado = await http.patch(
        '/mantenimiento/configuracion',
        {
          director: { nombre: 'Ing. Intruso', cip: '11111' },
        },
        autorizacion('SUPERVISOR'),
      );
      expect(resPatchBloqueado.status).toBe(403);

      // 3. Permite actualización a ADMINISTRADOR
      const firmaMock =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
      const resPatchOk = await http.patch(
        '/mantenimiento/configuracion',
        {
          director: {
            nombre: 'Ing. Carlos Medina Ruiz',
            cip: '84512',
            firma: firmaMock,
          },
          resolucionSanitaria: '0023-2024-DESA/MINSA',
          parametros: { diasVigenciaCertificado: 30, versionPlantilla: '2.0' },
        },
        await autorizacionDePersonal(t.db, 'ADMINISTRADOR', 'R.AGARATE'),
      );
      expect(resPatchOk.status).toBe(200);
      expect(resPatchOk.body.director.firma).toBe(firmaMock);
      expect(resPatchOk.body.parametros).toEqual({
        diasVigenciaCertificado: 30,
        versionPlantilla: '2.0',
      });

      // 4. Comprobar que lectura refleja los cambios
      const resGetActualizado = await http.get('/mantenimiento/configuracion');
      expect(resGetActualizado.body.director.firma).toBe(firmaMock);
      expect(resGetActualizado.body.parametros.diasVigenciaCertificado).toBe(30);
    });

    it('permite consulta de auditoría exclusivamente a ADMINISTRADOR y registra trazabilidad', async () => {
      // 1. Bloquea si no es ADMINISTRADOR
      const resAuditoriaBloqueada = await http.get('/mantenimiento/auditoria', autorizacion('SUPERVISOR'));
      expect(resAuditoriaBloqueada.status).toBe(403);

      // 2. Ejecutar acción de mantenimiento que genera auditoría
      await http.put(
        '/mantenimiento/catalogos-texto/observaciones',
        { items: ['Observación de prueba auditada'] },
        await autorizacionDePersonal(t.db, 'ADMINISTRADOR', 'ADMIN_AUDIT'),
      );

      // 3. Consultar bitácora como ADMINISTRADOR
      const resAuditoria = await http.get(
        '/mantenimiento/auditoria?modulo=MANTENIMIENTO&limit=10',
        autorizacion('ADMINISTRADOR'),
      );
      expect(resAuditoria.status).toBe(200);
      expect(resAuditoria.body.total).toBeGreaterThanOrEqual(1);
      expect(resAuditoria.body.items.length).toBeGreaterThanOrEqual(1);

      const eventoObservaciones = resAuditoria.body.items.find(
        (e: any) => e.entidadId === 'observaciones',
      );
      expect(eventoObservaciones).toBeDefined();
      expect(eventoObservaciones.accion).toBe('ACTUALIZAR_CATALOGO_TEXTO');
      expect(eventoObservaciones.actorUsuario).toBe('ADMIN_AUDIT');
      expect(eventoObservaciones.payloadNuevo.items).toEqual([
        'Observación de prueba auditada',
      ]);
    });

    it('Garantía de Inmutabilidad (§13): editar catálogo o configuración no altera inspecciones pasadas', async () => {
      const clienteRes = await http.post('/mantenimiento/clientes', {
        razonSocial: 'Empresa Inmutable S.A.C.',
        ruc: '20999888771',
        codigoCorto: 'INMUTAB',
        direccionFiscal: 'Mollendo',
        giroNegocio: 'Industrial',
        contactoNombre: 'Contacto',
        contactoCargo: 'Jefe',
        contactoTelefono: '958000111',
        contactoCorreo: 'contacto@inmutable.pe',
      });
      const proyectoRes = await http.post('/mantenimiento/proyectos', {
        clienteId: clienteRes.body.id,
        nombre: 'SEDE_INMUTABLE',
        direccionSede: 'Sede Principal',
        distrito: 'Mollendo',
        provincia: 'Islay',
        departamento: 'Arequipa',
        contactoNombre: 'Contacto Sede',
        contactoCargo: 'Administrador Sede',
        contactoTelefono: '958000222',
      });
      expect(clienteRes.status).toBe(201);
      expect(proyectoRes.status).toBe(201);
      const insumoRes = await http.post('/mantenimiento/insumos', {
        nombreComercial: 'Insumo Inmutable',
        principioActivo: 'Principio',
        presentacion: 'LIQUIDO',
        unidadMedida: 'L',
        registroDigesa: 'RD-9999-2025/DIGESA/SA',
        concentracion: '1%',
        dosisEstandar: '5 ml/L',
        fichaTecnicaKey: 'insumos/fichas/inmutable.pdf',
        hojaMsdsKey: 'insumos/msds/inmutable.pdf',
      });
      const equipoRes = await http.post('/mantenimiento/equipos', {
        codigoInterno: 'EQ-INM-01',
        nombre: 'Equipo Inmutable',
        tipo: 'NEBULIZACION',
        marcaModelo: 'Model X',
        estadoOperativo: 'OPERATIVO',
      });
      const servicioRes = await http.post('/mantenimiento/servicios-contratados', {
        proyectoId: proyectoRes.body.id,
        tipoServicio: 'DSF',
        frecuencia: 'MENSUAL',
        areaTotalM2: 500,
        areaTratarM2: 400,
        insumosAutorizados: [insumoRes.body.id],
        equiposAutorizados: [equipoRes.body.id],
        dosisReferencial: { [insumoRes.body.id]: '5 ml / Litro' },
        requiereCertificado: true,
        vigenciaDias: 30,
      });
      expect(insumoRes.status).toBe(201);
      expect(equipoRes.status).toBe(201);
      expect(servicioRes.status).toBe(201);
      expect(servicioRes.body.id).toBeDefined();

      const snapshotHistorico = {
        catalogos: {
          hallazgos: ['CUCARACHA HISTORICA', 'MOSCA HISTORICA'],
          directorTecnico: {
            nombre: 'Ing. Carlos Medina Ruiz (Histórico)',
            cip: '84512',
          },
        },
      };

      const inspeccionId = '88888888-8888-4888-8888-888888888888';
      await sembrarInspeccionCerrada(t.db, {
        id: inspeccionId,
        servicioId: servicioRes.body.id,
        codigo: 'INSP-INMUTABLE-01',
        snapshot: snapshotHistorico,
      });

      // Modificamos catálogo y configuración
      await http.put(
        '/mantenimiento/catalogos-texto/hallazgos',
        { items: ['VECTOR MODERNO 2026'] },
        await autorizacionDePersonal(t.db, 'ADMINISTRADOR', 'ADMIN'),
      );
      await http.patch(
        '/mantenimiento/configuracion',
        { director: { nombre: 'Ing. Nuevo Director 2027', cip: '99999' } },
        await autorizacionDePersonal(t.db, 'ADMINISTRADOR', 'ADMIN'),
      );

      // Verificamos que el snapshot de la inspección cerrada permanece 100% INTACTO
      const snapshotEnBd = await leerSnapshotCrudo(t.db, inspeccionId);
      const snapshotParseado = JSON.parse(snapshotEnBd);

      expect(snapshotParseado.catalogos.hallazgos).toEqual([
        'CUCARACHA HISTORICA',
        'MOSCA HISTORICA',
      ]);
      expect(snapshotParseado.catalogos.directorTecnico.nombre).toBe(
        'Ing. Carlos Medina Ruiz (Histórico)',
      );
      expect(snapshotEnBd).not.toContain('VECTOR MODERNO 2026');
      expect(snapshotEnBd).not.toContain('Ing. Nuevo Director 2027');
    });
  });
});
