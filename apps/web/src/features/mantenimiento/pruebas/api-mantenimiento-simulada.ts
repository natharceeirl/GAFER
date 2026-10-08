import type { Mock } from 'vitest';

/**
 * API simulada en memoria para las pruebas de las pantallas de Mantenimiento: insumos, equipos y almacenamiento.
 * Imita las respuestas reales del API (listados paginados, 409 por duplicados, 403 por rol).
 */

export const ORIGEN_ALMACENAMIENTO = 'http://almacenamiento.prueba';

export interface Registro {
  id: string;
  [campo: string]: unknown;
}

export interface EstadoApi {
  insumos: Registro[];
  equipos: Registro[];
  personal: Registro[];
  catalogos: Registro[];
  configuracion: Registro;
  /** Rol de la sesión simulada: el Supervisor no ve el personal, ni los catálogos solo de Administrador, ni escribe la configuración. */
  rol: 'ADMINISTRADOR' | 'SUPERVISOR';
  /** Responde 403 a todo lo de insumos y equipos, como el API a un rol sin acceso. */
  prohibido: boolean;
  /** Cantidad de PUT al almacenamiento que se rechazan antes de aceptar. */
  fallosDeSubida: number;
  /** Claves de los archivos subidos con PUT. */
  subidos: string[];
}

export const configuracionApi = (extra: Partial<Registro> = {}): Registro => ({
  id: 'global',
  director: { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: null },
  resolucionSanitaria: '0023-2024-DESA/MINSA',
  parametros: {},
  actualizadoPor: null,
  updatedAt: '2026-10-04T00:00:00.000Z',
  ...extra,
});

export const personalApi = (n: number, extra: Partial<Registro> = {}): Registro => ({
  id: `22222222-0000-4000-8000-${String(n).padStart(12, '0')}`,
  dni: String(40000000 + n),
  nombres: `Nombre${n}`,
  apellidos: `Apellido${n}`,
  cargo: 'TECNICO_OPERADOR',
  telefono: '958123456',
  usuario: null,
  estado: 'ACTIVO',
  ...extra,
});

export const catalogoApi = (id: string, titulo: string, items: string[], soloAdministrador = false): Registro => ({ id, titulo, items, soloAdministrador });

export const crearEstadoApi = (parcial: Partial<EstadoApi> = {}): EstadoApi => ({
  insumos: [],
  equipos: [],
  personal: [],
  catalogos: [],
  configuracion: configuracionApi(),
  rol: 'ADMINISTRADOR',
  prohibido: false,
  fallosDeSubida: 0,
  subidos: [],
  ...parcial,
});

export const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

let contador = 0;
const nuevoId = () => `aaaaaaaa-0000-4000-8000-${String(++contador).padStart(12, '0')}`;

export const insumoApi = (n: number, extra: Partial<Registro> = {}): Registro => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  nombreComercial: `Insumo ${n}`,
  principioActivo: 'Brodifacoum',
  presentacion: 'BLOQUE',
  unidadMedida: 'BLOQUE',
  registroDigesa: `DIG-${n}`,
  concentracion: '0.005%',
  dosisEstandar: '1 bloque por estación',
  fichaTecnicaKey: `insumos/ficha-tecnica/${n}.pdf`,
  hojaMsdsKey: `insumos/hoja-msds/${n}.pdf`,
  resolucionKey: null,
  proveedor: null,
  estado: 'ACTIVO',
  ...extra,
});

export const equipoApi = (n: number, extra: Partial<Registro> = {}): Registro => ({
  id: `11111111-0000-4000-8000-${String(n).padStart(12, '0')}`,
  codigoInterno: `EQ-${n}`,
  nombre: `Equipo ${n}`,
  tipo: 'ASPERSION',
  marcaModelo: null,
  estadoOperativo: 'OPERATIVO',
  fechaAdquisicion: null,
  ultimoMantenimiento: null,
  proximoMantenimiento: null,
  ...extra,
});

/** Conecta `fetch` con el estado en memoria. */
export function simularApiMantenimiento(fetchMock: Mock, estado: EstadoApi) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';

    if (String(url).startsWith(ORIGEN_ALMACENAMIENTO)) {
      if (estado.fallosDeSubida > 0) {
        estado.fallosDeSubida -= 1;
        return new Response('error', { status: 500 });
      }
      estado.subidos.push(decodeURIComponent(new URL(url).pathname.replace('/subida/', '')));
      return new Response(null, { status: 200 });
    }

    const ruta = new URL(url).pathname.replace('/api/mantenimiento', '');
    const cuerpo = init?.body ? JSON.parse(init.body as string) : undefined;

    if (ruta === '/storage/upload-url') {
      if (estado.prohibido) return json(403, { statusCode: 403, message: 'Forbidden resource' });
      return json(201, { key: cuerpo.key, uploadUrl: `${ORIGEN_ALMACENAMIENTO}/subida/${encodeURIComponent(cuerpo.key)}`, bucket: 'gafer-docs', expiresInSeconds: 900 });
    }
    if (ruta === '/storage/download-url') {
      return json(201, { key: cuerpo.key, downloadUrl: `${ORIGEN_ALMACENAMIENTO}/ver/${encodeURIComponent(cuerpo.key)}`, expiresInSeconds: 3600 });
    }

    const prohibidoParaElRol = () => json(403, { statusCode: 403, message: 'Forbidden resource' });

    if (ruta === '/configuracion') {
      if (metodo === 'GET') return json(200, estado.configuracion);
      if (estado.rol !== 'ADMINISTRADOR') return prohibidoParaElRol();
      if (cuerpo.director) estado.configuracion.director = { nombre: cuerpo.director.nombre, cip: cuerpo.director.cip, firma: cuerpo.director.firma ?? null };
      if (cuerpo.resolucionSanitaria) estado.configuracion.resolucionSanitaria = cuerpo.resolucionSanitaria;
      return json(200, estado.configuracion);
    }

    if (ruta === '/catalogos-texto' && metodo === 'GET') {
      return json(200, estado.catalogos.filter((c) => estado.rol === 'ADMINISTRADOR' || !c.soloAdministrador));
    }
    const catalogoRuta = ruta.match(/^\/catalogos-texto\/([^/]+)(\/items)?$/);
    if (catalogoRuta) {
      const catalogo = estado.catalogos.find((c) => c.id === catalogoRuta[1]);
      if (!catalogo) return json(404, { statusCode: 404, message: 'Catálogo no encontrado' });
      if (catalogo.soloAdministrador && estado.rol !== 'ADMINISTRADOR') return prohibidoParaElRol();
      if (catalogoRuta[2] && metodo === 'POST') {
        const items = catalogo.items as string[];
        if (!items.includes(cuerpo.item)) items.push(cuerpo.item);
        return json(201, catalogo);
      }
      if (metodo === 'PUT') {
        catalogo.items = cuerpo.items;
        return json(200, catalogo);
      }
      return json(200, catalogo);
    }

    if (ruta.startsWith('/personal') && estado.rol !== 'ADMINISTRADOR') return prohibidoParaElRol();

    const coleccion = ruta.startsWith('/personal') ? 'personal' : ruta.startsWith('/insumos') ? 'insumos' : ruta.startsWith('/equipos') ? 'equipos' : null;
    if (!coleccion) return json(404, { statusCode: 404, message: 'No encontrado' });
    if (estado.prohibido && coleccion !== 'personal') return json(403, { statusCode: 403, message: 'Forbidden resource' });

    const registros = estado[coleccion];
    const claveUnica = coleccion === 'insumos' ? 'registroDigesa' : coleccion === 'personal' ? 'dni' : 'codigoInterno';
    const mensajeDuplicado =
      coleccion === 'insumos'
        ? 'Ya existe un insumo registrado con el código DIGESA'
        : coleccion === 'personal'
          ? 'Ya existe un colaborador registrado con el DNI'
          : 'Ya existe un equipo registrado con el código interno';

    if (ruta === `/${coleccion}` && metodo === 'GET') return json(200, { total: registros.length, limit: 100, offset: 0, items: registros });
    if (ruta === `/${coleccion}` && metodo === 'POST') {
      if (registros.some((r) => r[claveUnica] === cuerpo[claveUnica])) {
        return json(409, { statusCode: 409, message: `${mensajeDuplicado}: ${cuerpo[claveUnica]}` });
      }
      const creado: Registro = { id: nuevoId(), ...(coleccion === 'equipos' ? { estadoOperativo: 'OPERATIVO' } : { estado: 'ACTIVO' }), ...cuerpo };
      registros.push(creado);
      return json(201, creado);
    }

    const recurso = ruta.match(new RegExp(`^/${coleccion}/([^/]+)(?:/(activar|desactivar|estado))?$`));
    const registro = recurso ? registros.find((r) => r.id === recurso[1]) : undefined;
    if (!recurso || !registro) return json(404, { statusCode: 404, message: 'No encontrado' });

    if (recurso[2] === 'activar' || recurso[2] === 'desactivar') {
      registro.estado = recurso[2] === 'activar' ? 'ACTIVO' : 'INACTIVO';
      return json(200, { id: registro.id, estado: registro.estado });
    }
    if (recurso[2] === 'estado') {
      registro.estadoOperativo = cuerpo.estadoOperativo;
      return json(200, registro);
    }
    Object.assign(registro, cuerpo);
    return json(200, registro);
  });
}

/** Llamadas hechas al API con un método y, opcionalmente, una ruta que termina en el sufijo dado. */
export function llamadasA(fetchMock: Mock, metodo: string, sufijo = ''): Array<{ url: string; cuerpo: unknown }> {
  return fetchMock.mock.calls
    .filter(([url, init]) => (init?.method ?? 'GET') === metodo && String(url).endsWith(sufijo))
    .map(([url, init]) => ({ url: String(url), cuerpo: init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined }));
}
