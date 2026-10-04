import 'reflect-metadata';
import { APP_GUARD, ModulesContainer } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { AuthGuard } from './infrastructure/guards/auth.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';
import { enumerarRutas, RutaRegistrada } from '../../test/support/rutas';


/**
 * Matriz de roles esperada (Spec §12 y decisiones de GAF-93). A = Administrador, S = Supervisor, T = Técnico Operador.
 * Cambiar el rol de una ruta obliga a tocar esta tabla a propósito.
 */
const MATRIZ_ESPERADA: Array<[string, string]> = [
  ['POST /api/auth/login', 'público'],
  ['GET /api/auth/perfil', 'AST'],
  ['GET /api/auth/verificar-admin', 'A'],
  ['GET /api/auth/verificar-gestion', 'AS'],
  // Mantenimiento: clientes, proyectos y servicios (Supervisor y Técnico solo leen)
  ['POST /api/mantenimiento/clientes', 'A'],
  ['GET /api/mantenimiento/clientes', 'AST'],
  ['GET /api/mantenimiento/clientes/:id', 'AST'],
  ['PATCH /api/mantenimiento/clientes/:id', 'A'],
  ['PATCH /api/mantenimiento/clientes/:id/desactivar', 'A'],
  ['PATCH /api/mantenimiento/clientes/:id/activar', 'A'],
  ['POST /api/mantenimiento/proyectos', 'A'],
  ['GET /api/mantenimiento/proyectos/cliente/:clienteId', 'AST'],
  ['GET /api/mantenimiento/proyectos/:id', 'AST'],
  ['PATCH /api/mantenimiento/proyectos/:id', 'A'],
  ['PATCH /api/mantenimiento/proyectos/:id/desactivar', 'A'],
  ['PATCH /api/mantenimiento/proyectos/:id/activar', 'A'],
  ['POST /api/mantenimiento/servicios-contratados', 'A'],
  ['GET /api/mantenimiento/servicios-contratados/proyecto/:proyectoId', 'AST'],
  ['GET /api/mantenimiento/servicios-contratados/:id', 'AST'],
  ['PATCH /api/mantenimiento/servicios-contratados/:id', 'A'],
  ['PATCH /api/mantenimiento/servicios-contratados/:id/desactivar', 'A'],
  ['PATCH /api/mantenimiento/servicios-contratados/:id/activar', 'A'],
  // Mantenimiento: insumos y equipos (el Técnico los lee para el formulario de campo; el Supervisor no)
  ['POST /api/mantenimiento/insumos', 'A'],
  ['GET /api/mantenimiento/insumos', 'AT'],
  ['GET /api/mantenimiento/insumos/:id', 'AT'],
  ['PATCH /api/mantenimiento/insumos/:id', 'A'],
  ['PATCH /api/mantenimiento/insumos/:id/desactivar', 'A'],
  ['PATCH /api/mantenimiento/insumos/:id/activar', 'A'],
  ['POST /api/mantenimiento/equipos', 'A'],
  ['GET /api/mantenimiento/equipos', 'AT'],
  ['GET /api/mantenimiento/equipos/:id', 'AT'],
  ['PATCH /api/mantenimiento/equipos/:id', 'A'],
  ['PATCH /api/mantenimiento/equipos/:id/estado', 'A'],
  // Mantenimiento: personal, almacenamiento, catálogos, configuración y auditoría
  ['POST /api/mantenimiento/personal', 'A'],
  ['GET /api/mantenimiento/personal', 'A'],
  ['GET /api/mantenimiento/personal/:id', 'A'],
  ['PATCH /api/mantenimiento/personal/:id', 'A'],
  ['PATCH /api/mantenimiento/personal/:id/desactivar', 'A'],
  ['PATCH /api/mantenimiento/personal/:id/activar', 'A'],
  ['POST /api/mantenimiento/storage/upload-url', 'A'],
  ['POST /api/mantenimiento/storage/download-url', 'AT'],
  ['GET /api/mantenimiento/catalogos-texto', 'AST'],
  ['GET /api/mantenimiento/catalogos-texto/:id', 'AST'],
  ['PUT /api/mantenimiento/catalogos-texto/:id', 'AS'],
  ['POST /api/mantenimiento/catalogos-texto/:id/items', 'AS'],
  ['GET /api/mantenimiento/configuracion', 'AS'],
  ['PATCH /api/mantenimiento/configuracion', 'A'],
  ['GET /api/mantenimiento/auditoria', 'A'],
  // Operaciones
  ['POST /api/operaciones/inspecciones', 'AST'],
  ['GET /api/operaciones/inspecciones', 'AST'],
  ['GET /api/operaciones/inspecciones/:id', 'AST'],
  ['POST /api/operaciones/inspecciones/:id/cerrar', 'AST'],
  ['GET /api/operaciones/inspecciones/:id/auditoria', 'A'],
  ['POST /api/operaciones/inspecciones/:id/sincronizar', 'AST'],
  // Fases 2 a 5 y expediente heredado
  ['POST /api/documentos', 'AS'],
  ['POST /api/documentos/:id/transicion', 'AS'],
  ['POST /api/cliente-expediente/clientes', 'A'],
  ['POST /api/mapa-murino/estaciones/:id/inspeccion', 'AST'],
  ['GET /api/estadisticas/clientes/:id/resumen', 'AS'],
  ['POST /api/inventario/insumos/:id/descuento', 'A'],
];

/**
 * GAF-93: denegar por defecto. Esta prueba falla si alguien agrega una ruta sin decidir quién entra.
 */
describe('Cobertura de protección de rutas (GAF-93)', () => {
  let moduleRef: TestingModule;
  let rutas: RutaRegistrada[];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    rutas = enumerarRutas(moduleRef.get(ModulesContainer, { strict: false }));
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('encuentra las rutas de todos los módulos (la enumeración no está vacía por error)', () => {
    const controladores = new Set(rutas.map((r) => r.controlador));
    for (const esperado of [
      'AuthController',
      'MantenimientoController',
      'OperacionesController',
      'DocumentosController',
      'ClienteExpedienteController',
      'MapaMurinoController',
      'EstadisticasController',
      'InventarioController',
    ]) {
      expect(controladores).toContain(esperado);
    }
    expect(rutas.length).toBeGreaterThanOrEqual(60);
  });

  it('toda ruta es pública o declara al menos un rol', () => {
    const sinProteger = rutas
      .filter((r) => !r.publica && r.roles.length === 0)
      .map((r) => `${r.metodo} ${r.ruta} (${r.controlador}.${r.handler})`);

    expect(sinProteger).toEqual([]);
  });

  it('las únicas rutas públicas son el login', () => {
    const publicas = rutas.filter((r) => r.publica).map((r) => `${r.metodo} ${r.ruta}`);

    expect(publicas).toEqual(['POST /api/auth/login']);
  });

  it('ninguna ruta pública declara roles, y los roles declarados son cargos válidos', () => {
    const validos = ['ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR'];
    for (const ruta of rutas) {
      if (ruta.publica) expect(ruta.roles).toEqual([]);
      for (const rol of ruta.roles) expect(validos).toContain(rol);
    }
  });

  it('AuthGuard y RolesGuard están registrados como guards globales, en ese orden', () => {
    const globales: unknown[] = [];
    for (const modulo of moduleRef.get(ModulesContainer, { strict: false }).values()) {
      for (const [token, proveedor] of modulo.providers) {
        if (typeof token === 'string' && token.startsWith(`${APP_GUARD as string}`)) {
          globales.push(proveedor.metatype);
        }
      }
    }

    expect(globales).toEqual([AuthGuard, RolesGuard]);
  });

  it('los roles de cada ruta coinciden con la matriz de la especificación (§12) y las decisiones de GAF-93', () => {
    const letras: Record<string, string> = { ADMINISTRADOR: 'A', SUPERVISOR: 'S', TECNICO_OPERADOR: 'T' };
    const actual = rutas.map((r): [string, string] => [
      `${r.metodo} ${r.ruta}`,
      r.publica ? 'público' : r.roles.map((rol) => letras[rol]).sort().join(''),
    ]);
    const ordenar = (filas: Array<[string, string]>) => [...filas].sort((a, b) => a[0].localeCompare(b[0]));

    expect(ordenar(actual)).toEqual(ordenar(MATRIZ_ESPERADA));
  });

  it('el Técnico no escribe en Mantenimiento y el Supervisor solo escribe en catálogos de texto', () => {
    const escrituras = rutas.filter(
      (r) => r.ruta.startsWith('/api/mantenimiento/') && r.metodo !== 'GET' && !r.ruta.endsWith('/storage/download-url'),
    );

    for (const ruta of escrituras) {
      expect({ ruta: `${ruta.metodo} ${ruta.ruta}`, tecnico: ruta.roles.includes('TECNICO_OPERADOR') }).toEqual({
        ruta: `${ruta.metodo} ${ruta.ruta}`,
        tecnico: false,
      });
      expect({
        ruta: `${ruta.metodo} ${ruta.ruta}`,
        supervisor: ruta.roles.includes('SUPERVISOR'),
      }).toEqual({
        ruta: `${ruta.metodo} ${ruta.ruta}`,
        supervisor: ruta.ruta.includes('/catalogos-texto/'),
      });
    }
  });

  it('la auditoría y el stock son solo del Administrador', () => {
    const sensibles = rutas.filter((r) => /auditoria|\/inventario\//.test(r.ruta));

    expect(sensibles.length).toBeGreaterThanOrEqual(3);
    for (const ruta of sensibles) expect(ruta.roles).toEqual(['ADMINISTRADOR']);
  });
});
