/**
 * sembrar-demo.ts
 * Carga y limpia los datos de ejemplo (GAF-94) con Kysely dentro de una sola transacción: o se aplica todo o nada.
 *
 * Por qué Kysely directo y no los casos de uso de Mantenimiento: los casos de uso piden un repositorio por entidad
 * y no tienen noción de "ya existe, no hagas nada"; el seed necesita buscar por clave natural, ser idempotente y
 * revertirse por completo si algo falla. Se respetan las mismas invariantes con los esquemas de @gafer/contracts
 * (validación previa, `validarDatosDemo`) y con las restricciones de la base. Las altas de usuarios sí reutilizan
 * `crearOActualizarUsuario` (db:crear-usuario), para no duplicar la validación ni el hash de claves.
 *
 * Regla de la sección 13: el seed nunca altera ni borra datos que no sean suyos. Una fila es "suya" solo si
 * coincide con sus claves naturales; lo que ya existe se deja tal cual (incluso si el usuario lo editó).
 *
 * Historial de versiones
 *   v1.0  2026-10-08  ihuayhuam  Creación del archivo (GAF-94).
 */
import { Kysely, Transaction, sql } from 'kysely';
import { generarHashClave } from '../../auth/domain/clave-hash';
import { crearOActualizarUsuario } from '../crear-usuario';
import { GaferDatabase } from '../types';
import { CredencialDemo, generarClaveDemo } from './claves-demo';
import { DATOS_DEMO, DatosDemo } from './datos-demo';
import { asegurarDatosDemoValidos } from './validar-datos-demo';

type Db = Kysely<GaferDatabase>;
type Trx = Transaction<GaferDatabase>;

/** De lo que otras entidades referencian a lo que depende de las demás; la limpieza recorre este orden al revés. */
export const ORDEN_SIEMBRA = ['personal', 'insumos', 'equipos', 'clientes', 'sedes', 'servicios', 'textos'] as const;
export type EntidadDemo = (typeof ORDEN_SIEMBRA)[number];

/** Servicios → sedes → clientes (y los textos primero, que no dependen de nadie). */
export const ORDEN_LIMPIEZA: readonly EntidadDemo[] = [...ORDEN_SIEMBRA].reverse();

export interface ConteoEntidad {
  creados: number;
  sinCambios: number;
}

export interface OpcionesSembrado {
  /** Genera una clave nueva para los usuarios de ejemplo que ya existen. */
  regenerarClaves: boolean;
}

export interface ResultadoSembrado {
  conteos: Record<EntidadDemo | 'configuracion', ConteoEntidad>;
  /** Solo los usuarios cuya clave se generó en esta corrida. */
  credenciales: CredencialDemo[];
}

export interface ResultadoLimpieza {
  eliminados: Record<EntidadDemo, number>;
  /** Filas de ejemplo que se conservaron porque ya tienen datos asociados o el usuario las modificó. */
  omitidos: string[];
}

const etiquetaSede = (clienteCodigo: string, sede: string): string => `${clienteCodigo}/${sede}`;

function conflicto(descripcion: string): Error {
  return new Error(
    `${descripcion} choca con una fila existente que no es de los datos de ejemplo (misma clave natural con otros datos). ` +
      'No se escribió nada. Revisa o elimina esa fila, o limpia con --limpiar si es de una carga anterior.',
  );
}

/* ----------------------------------------------------------------------------------------------- siembra */

export async function sembrarDatosDemo(
  db: Db,
  datos: DatosDemo = DATOS_DEMO,
  opciones: OpcionesSembrado = { regenerarClaves: false },
): Promise<ResultadoSembrado> {
  asegurarDatosDemoValidos(datos);

  return db.transaction().execute(async (trx) => {
    const conteos = Object.fromEntries(
      [...ORDEN_SIEMBRA, 'configuracion'].map((entidad) => [entidad, { creados: 0, sinCambios: 0 }]),
    ) as ResultadoSembrado['conteos'];
    const credenciales: CredencialDemo[] = [];

    await sembrarPersonal(trx, datos, opciones, conteos.personal, credenciales);
    const idsInsumo = await sembrarInsumos(trx, datos, conteos.insumos);
    const idsEquipo = await sembrarEquipos(trx, datos, conteos.equipos);
    const idsCliente = await sembrarClientes(trx, datos, conteos.clientes);
    const idsSede = await sembrarSedes(trx, datos, idsCliente, conteos.sedes);
    await sembrarServicios(trx, datos, { idsSede, idsInsumo, idsEquipo }, conteos.servicios);
    await sembrarTextos(trx, datos, conteos.textos);
    await completarDirector(trx, datos, conteos.configuracion);

    return { conteos, credenciales };
  });
}

async function sembrarPersonal(
  trx: Trx,
  datos: DatosDemo,
  opciones: OpcionesSembrado,
  conteo: ConteoEntidad,
  credenciales: CredencialDemo[],
): Promise<void> {
  for (const persona of datos.personal) {
    const usuario = persona.usuario.toUpperCase();
    const porDni = await trx.selectFrom('personal').select(['id']).where('dni', '=', persona.dni).executeTakeFirst();
    const porUsuario = await trx.selectFrom('personal').select(['id']).where('usuario', '=', usuario).executeTakeFirst();

    if (!porDni && !porUsuario) {
      const clave = generarClaveDemo();
      await crearOActualizarUsuario(trx, { ...persona, clave });
      credenciales.push({ usuario: persona.usuario, cargo: persona.cargo, clave, motivo: 'creado' });
      conteo.creados++;
      continue;
    }

    if (!porDni || !porUsuario || porDni.id !== porUsuario.id) {
      throw conflicto(`La persona de ejemplo ${persona.usuario} (DNI ${persona.dni})`);
    }
    if (opciones.regenerarClaves) {
      const clave = generarClaveDemo();
      await trx
        .updateTable('personal')
        .set({ clave_hash: await generarHashClave(clave), updated_at: new Date() })
        .where('id', '=', porDni.id)
        .execute();
      credenciales.push({ usuario: persona.usuario, cargo: persona.cargo, clave, motivo: 'regenerada' });
    }
    conteo.sinCambios++;
  }
}

async function sembrarInsumos(trx: Trx, datos: DatosDemo, conteo: ConteoEntidad): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const insumo of datos.insumos) {
    const existente = await trx
      .selectFrom('insumos')
      .select(['id'])
      .where('registro_digesa', '=', insumo.registroDigesa)
      .where('nombre_comercial', '=', insumo.nombreComercial)
      .executeTakeFirst();
    if (existente) {
      ids.set(insumo.registroDigesa, existente.id);
      conteo.sinCambios++;
      continue;
    }
    const otroConElRegistro = await trx.selectFrom('insumos').select(['id']).where('registro_digesa', '=', insumo.registroDigesa).executeTakeFirst();
    if (otroConElRegistro) throw conflicto(`El insumo de ejemplo ${insumo.registroDigesa}`);

    const creado = await trx
      .insertInto('insumos')
      .values({
        nombre_comercial: insumo.nombreComercial,
        principio_activo: insumo.principioActivo,
        presentacion: insumo.presentacion,
        unidad_medida: insumo.unidadMedida,
        registro_digesa: insumo.registroDigesa,
        concentracion: insumo.concentracion,
        dosis_estandar: insumo.dosisEstandar,
        ficha_tecnica_key: insumo.fichaTecnicaKey,
        hoja_msds_key: insumo.hojaMsdsKey,
        resolucion_key: insumo.resolucionKey ?? null,
        proveedor: insumo.proveedor ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.set(insumo.registroDigesa, creado.id);
    conteo.creados++;
  }
  return ids;
}

async function sembrarEquipos(trx: Trx, datos: DatosDemo, conteo: ConteoEntidad): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const equipo of datos.equipos) {
    const existente = await trx.selectFrom('equipos').select(['id']).where('codigo_interno', '=', equipo.codigoInterno).executeTakeFirst();
    if (existente) {
      ids.set(equipo.codigoInterno, existente.id);
      conteo.sinCambios++;
      continue;
    }
    const creado = await trx
      .insertInto('equipos')
      .values({
        codigo_interno: equipo.codigoInterno,
        nombre: equipo.nombre,
        tipo: equipo.tipo,
        marca_modelo: equipo.marcaModelo ?? null,
        estado_operativo: equipo.estadoOperativo ?? 'OPERATIVO',
        fecha_adquisicion: equipo.fechaAdquisicion ?? null,
        ultimo_mantenimiento: equipo.ultimoMantenimiento ?? null,
        proximo_mantenimiento: equipo.proximoMantenimiento ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.set(equipo.codigoInterno, creado.id);
    conteo.creados++;
  }
  return ids;
}

async function sembrarClientes(trx: Trx, datos: DatosDemo, conteo: ConteoEntidad): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const cliente of datos.clientes) {
    const coincidencias = await trx
      .selectFrom('clientes')
      .select(['id', 'codigo_corto', 'ruc'])
      .where((eb) => eb.or([eb('codigo_corto', '=', cliente.codigoCorto), eb('ruc', '=', cliente.ruc)]))
      .execute();

    if (coincidencias.length === 0) {
      const creado = await trx
        .insertInto('clientes')
        .values({
          razon_social: cliente.razonSocial,
          ruc: cliente.ruc,
          codigo_corto: cliente.codigoCorto,
          direccion_fiscal: cliente.direccionFiscal,
          giro_negocio: cliente.giroNegocio,
          contacto_nombre: cliente.contactoNombre,
          contacto_cargo: cliente.contactoCargo,
          contacto_telefono: cliente.contactoTelefono,
          contacto_correo: cliente.contactoCorreo,
          campos_extra: JSON.stringify(cliente.camposExtra ?? {}),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ids.set(cliente.codigoCorto, creado.id);
      conteo.creados++;
      continue;
    }

    const propio = coincidencias.length === 1 && coincidencias[0].codigo_corto === cliente.codigoCorto && coincidencias[0].ruc === cliente.ruc;
    if (!propio) throw conflicto(`El cliente de ejemplo ${cliente.codigoCorto} (RUC ${cliente.ruc})`);
    ids.set(cliente.codigoCorto, coincidencias[0].id);
    conteo.sinCambios++;
  }
  return ids;
}

async function sembrarSedes(trx: Trx, datos: DatosDemo, idsCliente: Map<string, string>, conteo: ConteoEntidad): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const sede of datos.sedes) {
    const clienteId = idsCliente.get(sede.clienteCodigo)!;
    const clave = etiquetaSede(sede.clienteCodigo, sede.nombre);
    const existente = await trx
      .selectFrom('proyectos')
      .select(['id'])
      .where('cliente_id', '=', clienteId)
      .where('nombre', '=', sede.nombre)
      .executeTakeFirst();
    if (existente) {
      ids.set(clave, existente.id);
      conteo.sinCambios++;
      continue;
    }
    const creada = await trx
      .insertInto('proyectos')
      .values({
        cliente_id: clienteId,
        nombre: sede.nombre,
        direccion_sede: sede.direccionSede,
        distrito: sede.distrito,
        provincia: sede.provincia,
        departamento: sede.departamento,
        contacto_nombre: sede.contactoNombre,
        contacto_cargo: sede.contactoCargo,
        contacto_telefono: sede.contactoTelefono,
        observaciones: sede.observaciones ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.set(clave, creada.id);
    conteo.creados++;
  }
  return ids;
}

async function sembrarServicios(
  trx: Trx,
  datos: DatosDemo,
  ids: { idsSede: Map<string, string>; idsInsumo: Map<string, string>; idsEquipo: Map<string, string> },
  conteo: ConteoEntidad,
): Promise<void> {
  for (const servicio of datos.servicios) {
    const proyectoId = ids.idsSede.get(etiquetaSede(servicio.clienteCodigo, servicio.sede))!;
    const existente = await trx
      .selectFrom('servicios_contratados')
      .select(['id'])
      .where('proyecto_id', '=', proyectoId)
      .where('tipo_servicio', '=', servicio.tipoServicio)
      .executeTakeFirst();
    if (existente) {
      conteo.sinCambios++;
      continue;
    }
    const dosis = Object.fromEntries(Object.entries(servicio.dosisReferencial).map(([registro, valor]) => [ids.idsInsumo.get(registro)!, valor]));
    await trx
      .insertInto('servicios_contratados')
      .values({
        proyecto_id: proyectoId,
        tipo_servicio: servicio.tipoServicio,
        frecuencia: servicio.frecuencia,
        area_total_m2: servicio.areaTotalM2,
        area_tratar_m2: servicio.areaTratarM2,
        insumos_autorizados: JSON.stringify(servicio.insumos.map((registro) => ids.idsInsumo.get(registro)!)),
        equipos_autorizados: JSON.stringify(servicio.equipos.map((codigo) => ids.idsEquipo.get(codigo)!)),
        dosis_referencial: JSON.stringify(dosis),
        requiere_certificado: servicio.requiereCertificado,
        vigencia_dias: servicio.vigenciaDias,
      })
      .execute();
    conteo.creados++;
  }
}

async function leerCatalogo(trx: Trx, id: string): Promise<string[]> {
  const fila = await trx.selectFrom('catalogos_texto').select(['items']).where('id', '=', id).executeTakeFirst();
  if (!fila) throw new Error(`Falta el catálogo de texto "${id}": ejecuta primero pnpm db:migrate.`);
  return fila.items;
}

async function sembrarTextos(trx: Trx, datos: DatosDemo, conteo: ConteoEntidad): Promise<void> {
  for (const [id, textos] of Object.entries(datos.catalogos)) {
    const actuales = await leerCatalogo(trx, id);
    const nuevos = (textos ?? []).filter((texto) => !actuales.includes(texto));
    conteo.sinCambios += (textos ?? []).length - nuevos.length;
    if (nuevos.length === 0) continue;

    await trx
      .updateTable('catalogos_texto')
      .set({ items: JSON.stringify([...actuales, ...nuevos]), updated_at: new Date() })
      .where('id', '=', id)
      .execute();
    conteo.creados += nuevos.length;
  }
}

/** La migración ya trae un Director Técnico de ejemplo; solo se completa si la fila estuviera vacía. */
async function completarDirector(trx: Trx, datos: DatosDemo, conteo: ConteoEntidad): Promise<void> {
  const config = await trx.selectFrom('configuracion_sistema').select(['director_nombre']).where('id', '=', 'global').executeTakeFirst();
  if (!config) throw new Error('Falta la configuración del sistema: ejecuta primero pnpm db:migrate.');
  if (config.director_nombre.trim() !== '') {
    conteo.sinCambios++;
    return;
  }
  await trx
    .updateTable('configuracion_sistema')
    .set({ director_nombre: datos.directorTecnico.nombre, director_cip: datos.directorTecnico.cip, updated_at: new Date() })
    .where('id', '=', 'global')
    .execute();
  conteo.creados++;
}

/* --------------------------------------------------------------------------------------------- limpieza */

type TablaConDependientes = 'visitas' | 'documentos' | 'correlativos' | 'inspecciones' | 'inspecciones_auditoria';
type ColumnaReferencia = 'cliente_id' | 'proyecto_id' | 'servicio_id' | 'tecnico_titular_id' | 'actor_id';

/** Tablas y columnas fijas (no vienen de datos externos): se usan como identificadores SQL. */
async function hayFilas(trx: Trx, tabla: TablaConDependientes, columna: ColumnaReferencia, valor: string): Promise<boolean> {
  const { rows } = await sql<{ existe: boolean }>`
    SELECT EXISTS (SELECT 1 FROM ${sql.table(tabla)} WHERE ${sql.ref(columna)} = ${valor}) AS existe`.execute(trx);
  return rows[0].existe;
}

async function mencionadoEnInspecciones(trx: Trx, id: string): Promise<boolean> {
  const fila = await trx
    .selectFrom('inspecciones')
    .select('id')
    .where(sql<boolean>`position(${id}::text in snapshot_catalogos::text) > 0 OR position(${id}::text in tecnicos_participantes::text) > 0`)
    .executeTakeFirst();
  return fila !== undefined;
}

async function usadoPorServicios(trx: Trx, columna: 'insumos_autorizados' | 'equipos_autorizados', id: string): Promise<boolean> {
  const fila = await trx
    .selectFrom('servicios_contratados')
    .select('id')
    .where(sql<boolean>`${sql.ref(columna)} @> ${JSON.stringify([id])}::jsonb`)
    .executeTakeFirst();
  return fila !== undefined;
}

/**
 * Borra solo las filas del conjunto de datos (por sus claves naturales), de las dependientes a las que otras
 * referencian. Si una fila de ejemplo ya tiene datos asociados (inspecciones, visitas, documentos) o el usuario
 * la modificó o le agregó otras, se conserva y se avisa: nunca se borra en cascada.
 */
export async function limpiarDatosDemo(db: Db, datos: DatosDemo = DATOS_DEMO): Promise<ResultadoLimpieza> {
  return db.transaction().execute(async (trx) => {
    const eliminados = Object.fromEntries(ORDEN_LIMPIEZA.map((entidad) => [entidad, 0])) as Record<EntidadDemo, number>;
    const omitidos: string[] = [];

    const pasos: Record<EntidadDemo, () => Promise<void>> = {
      textos: () => limpiarTextos(trx, datos, eliminados),
      servicios: () => limpiarServicios(trx, datos, eliminados, omitidos),
      sedes: () => limpiarSedes(trx, datos, eliminados, omitidos),
      clientes: () => limpiarClientes(trx, datos, eliminados, omitidos),
      equipos: () => limpiarEquipos(trx, datos, eliminados, omitidos),
      insumos: () => limpiarInsumos(trx, datos, eliminados, omitidos),
      personal: () => limpiarPersonal(trx, datos, eliminados, omitidos),
    };
    for (const entidad of ORDEN_LIMPIEZA) await pasos[entidad]();

    return { eliminados, omitidos };
  });
}

async function limpiarTextos(trx: Trx, datos: DatosDemo, eliminados: Record<EntidadDemo, number>): Promise<void> {
  for (const [id, textos] of Object.entries(datos.catalogos)) {
    const fila = await trx.selectFrom('catalogos_texto').select(['items']).where('id', '=', id).executeTakeFirst();
    if (!fila) continue;
    const restantes = fila.items.filter((texto) => !(textos ?? []).includes(texto));
    if (restantes.length === fila.items.length) continue;

    await trx.updateTable('catalogos_texto').set({ items: JSON.stringify(restantes), updated_at: new Date() }).where('id', '=', id).execute();
    eliminados.textos += fila.items.length - restantes.length;
  }
}

async function buscarCliente(trx: Trx, datos: DatosDemo, codigo: string): Promise<{ id: string } | undefined> {
  const ruc = datos.clientes.find((c) => c.codigoCorto === codigo)!.ruc;
  return trx.selectFrom('clientes').select(['id']).where('codigo_corto', '=', codigo).where('ruc', '=', ruc).executeTakeFirst();
}

async function buscarSede(trx: Trx, datos: DatosDemo, clienteCodigo: string, nombre: string): Promise<{ id: string } | undefined> {
  const cliente = await buscarCliente(trx, datos, clienteCodigo);
  if (!cliente) return undefined;
  return trx.selectFrom('proyectos').select(['id']).where('cliente_id', '=', cliente.id).where('nombre', '=', nombre).executeTakeFirst();
}

async function limpiarServicios(trx: Trx, datos: DatosDemo, eliminados: Record<EntidadDemo, number>, omitidos: string[]): Promise<void> {
  for (const servicio of datos.servicios) {
    const etiqueta = `${etiquetaSede(servicio.clienteCodigo, servicio.sede)}/${servicio.tipoServicio}`;
    const sede = await buscarSede(trx, datos, servicio.clienteCodigo, servicio.sede);
    if (!sede) continue;

    const propio = await trx
      .selectFrom('servicios_contratados')
      .select(['id'])
      .where('proyecto_id', '=', sede.id)
      .where('tipo_servicio', '=', servicio.tipoServicio)
      .where('frecuencia', '=', servicio.frecuencia)
      .where('area_total_m2', '=', servicio.areaTotalM2)
      .where('area_tratar_m2', '=', servicio.areaTratarM2)
      .executeTakeFirst();
    if (!propio) {
      const otro = await trx.selectFrom('servicios_contratados').select('id').where('proyecto_id', '=', sede.id).where('tipo_servicio', '=', servicio.tipoServicio).executeTakeFirst();
      if (otro) omitidos.push(`Servicio ${etiqueta}: fue modificado después del seed, se considera del usuario y se conserva.`);
      continue;
    }
    if ((await hayFilas(trx, 'inspecciones', 'servicio_id', propio.id)) || (await hayFilas(trx, 'visitas', 'servicio_id', propio.id))) {
      omitidos.push(`Servicio ${etiqueta}: tiene inspecciones o visitas asociadas, se conserva.`);
      continue;
    }
    await trx.deleteFrom('servicios_contratados').where('id', '=', propio.id).execute();
    eliminados.servicios++;
  }
}

async function limpiarSedes(trx: Trx, datos: DatosDemo, eliminados: Record<EntidadDemo, number>, omitidos: string[]): Promise<void> {
  for (const datosSede of datos.sedes) {
    const etiqueta = etiquetaSede(datosSede.clienteCodigo, datosSede.nombre);
    const sede = await buscarSede(trx, datos, datosSede.clienteCodigo, datosSede.nombre);
    if (!sede) continue;

    const restantes = await trx.selectFrom('servicios_contratados').select('id').where('proyecto_id', '=', sede.id).executeTakeFirst();
    if (restantes || (await hayFilas(trx, 'visitas', 'proyecto_id', sede.id)) || (await hayFilas(trx, 'documentos', 'proyecto_id', sede.id))) {
      omitidos.push(`Sede ${etiqueta}: sigue teniendo servicios, visitas o documentos que se conservan, así que también se conserva.`);
      continue;
    }
    await trx.deleteFrom('proyectos').where('id', '=', sede.id).execute();
    eliminados.sedes++;
  }
}

async function limpiarClientes(trx: Trx, datos: DatosDemo, eliminados: Record<EntidadDemo, number>, omitidos: string[]): Promise<void> {
  for (const datosCliente of datos.clientes) {
    const cliente = await buscarCliente(trx, datos, datosCliente.codigoCorto);
    if (!cliente) continue;

    const sedes = await trx.selectFrom('proyectos').select('id').where('cliente_id', '=', cliente.id).executeTakeFirst();
    const conDependientes =
      sedes !== undefined ||
      (await hayFilas(trx, 'visitas', 'cliente_id', cliente.id)) ||
      (await hayFilas(trx, 'documentos', 'cliente_id', cliente.id)) ||
      (await hayFilas(trx, 'correlativos', 'cliente_id', cliente.id));
    if (conDependientes) {
      omitidos.push(`Cliente ${datosCliente.codigoCorto}: sigue teniendo sedes, visitas o documentos que se conservan, así que también se conserva.`);
      continue;
    }
    await trx.deleteFrom('clientes').where('id', '=', cliente.id).execute();
    eliminados.clientes++;
  }
}

async function limpiarEquipos(trx: Trx, datos: DatosDemo, eliminados: Record<EntidadDemo, number>, omitidos: string[]): Promise<void> {
  for (const equipo of datos.equipos) {
    const fila = await trx.selectFrom('equipos').select(['id']).where('codigo_interno', '=', equipo.codigoInterno).executeTakeFirst();
    if (!fila) continue;
    if ((await usadoPorServicios(trx, 'equipos_autorizados', fila.id)) || (await mencionadoEnInspecciones(trx, fila.id))) {
      omitidos.push(`Equipo ${equipo.codigoInterno}: lo usa un servicio o una inspección que se conserva, así que también se conserva.`);
      continue;
    }
    await trx.deleteFrom('equipos').where('id', '=', fila.id).execute();
    eliminados.equipos++;
  }
}

async function limpiarInsumos(trx: Trx, datos: DatosDemo, eliminados: Record<EntidadDemo, number>, omitidos: string[]): Promise<void> {
  for (const insumo of datos.insumos) {
    const fila = await trx
      .selectFrom('insumos')
      .select(['id'])
      .where('registro_digesa', '=', insumo.registroDigesa)
      .where('nombre_comercial', '=', insumo.nombreComercial)
      .executeTakeFirst();
    if (!fila) continue;
    if ((await usadoPorServicios(trx, 'insumos_autorizados', fila.id)) || (await mencionadoEnInspecciones(trx, fila.id))) {
      omitidos.push(`Insumo ${insumo.registroDigesa}: lo usa un servicio o una inspección que se conserva, así que también se conserva.`);
      continue;
    }
    await trx.deleteFrom('insumos').where('id', '=', fila.id).execute();
    eliminados.insumos++;
  }
}

async function limpiarPersonal(trx: Trx, datos: DatosDemo, eliminados: Record<EntidadDemo, number>, omitidos: string[]): Promise<void> {
  for (const persona of datos.personal) {
    const fila = await trx
      .selectFrom('personal')
      .select(['id'])
      .where('dni', '=', persona.dni)
      .where('usuario', '=', persona.usuario.toUpperCase())
      .executeTakeFirst();
    if (!fila) continue;
    const conRegistros =
      (await hayFilas(trx, 'visitas', 'tecnico_titular_id', fila.id)) ||
      (await hayFilas(trx, 'inspecciones_auditoria', 'actor_id', fila.id)) ||
      (await mencionadoEnInspecciones(trx, fila.id));
    if (conRegistros) {
      omitidos.push(`Usuario ${persona.usuario}: figura en visitas o inspecciones, se conserva.`);
      continue;
    }
    await trx.deleteFrom('personal').where('id', '=', fila.id).execute();
    eliminados.personal++;
  }
}
