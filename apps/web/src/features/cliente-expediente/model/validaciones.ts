import {
  ClienteActualizacionSchema,
  ClienteRegistroSchema,
  ProyectoActualizacionSchema,
  ProyectoRegistroSchema,
  ServicioContratadoActualizacionSchema,
  type EstadoActivoInactivo,
  type FrecuenciaServicio,
  type TipoServicio,
} from '@gafer/contracts';
import { actualizacionDeDatos, campoDeRuta, registroDeDatos } from './cliente-mapper';
import { actualizacionDeProyecto, campoDeRutaProyecto, registroDeProyecto } from './proyecto-mapper';
import { actualizacionDeServicio, campoDeRutaServicio } from './servicio-mapper';

export type Errores<K extends string> = Partial<Record<K, string>>;

/** Código reservado para personas naturales, que se registran bajo el cliente VARIOS (§7.1). */
export const RUC_VARIOS = '12345678910';

const OBLIGATORIO = 'Campo obligatorio.';

function vacio(v: string) {
  return v.trim() === '';
}

export function normalizarCodigo(v: string): string {
  return v.replace(/\s+/g, '').toUpperCase();
}

export interface DatosCliente {
  razonSocial: string;
  ruc: string;
  codigoCorto: string;
  direccionFiscal: string;
  giro: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoTelefono: string;
  contactoCorreo: string;
  estado: EstadoActivoInactivo;
}

type Incidencia = NonNullable<ReturnType<typeof ClienteRegistroSchema.safeParse>['error']>['issues'][number];

const MENSAJE_CORREO = 'Ingrese un correo válido, por ejemplo nombre@empresa.pe.';

/** Los textos de los esquemas compartidos ya vienen en español; solo se completan los genéricos de zod. */
function mensajeDe(incidencia: Incidencia): string {
  if (incidencia.code === 'invalid_string' && incidencia.validation === 'email') return MENSAJE_CORREO;
  if (incidencia.code === 'too_small' || incidencia.code === 'invalid_type') return OBLIGATORIO;
  return incidencia.message;
}

/**
 * Valida la ficha con los esquemas de `@gafer/contracts` (los mismos del API). En edición el RUC y el
 * código corto no se tocan, por eso se validan contra el esquema de actualización, que no los incluye.
 * La unicidad del RUC y del código la resuelve el servidor (409).
 */
export function validarCliente(d: DatosCliente, { edicion = false }: { edicion?: boolean } = {}): Errores<keyof DatosCliente> {
  const e: Errores<keyof DatosCliente> = {};
  const resultado = edicion
    ? ClienteActualizacionSchema.safeParse(actualizacionDeDatos(d, 1))
    : ClienteRegistroSchema.safeParse(registroDeDatos(d, 1));

  if (!resultado.success) {
    for (const incidencia of resultado.error.issues) {
      const campo = campoDeRuta(String(incidencia.path[0]));
      if (!campo || e[campo]) continue;
      e[campo] = vacio(d[campo]) ? OBLIGATORIO : mensajeDe(incidencia);
    }
  }

  if (!edicion && !e.ruc && d.ruc === RUC_VARIOS) {
    e.ruc = 'Ese código es de personas naturales: regístrelas como sede del cliente VARIOS.';
  }

  return e;
}

export interface DatosProyecto {
  nombre: string;
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoTelefono: string;
  observaciones: string;
}

/** Id de cliente de relleno: el esquema de alta lo exige, pero el cliente ya está elegido y no se valida aquí. */
const CLIENTE_DE_RELLENO = '00000000-0000-4000-8000-000000000000';

/**
 * Valida la sede con los esquemas de `@gafer/contracts`. En edición el nombre admite de 3 a 50 caracteres,
 * como lo guarda la base. La unicidad del nombre dentro del cliente se revisa aquí contra las sedes ya cargadas
 * y el servidor la confirma (409).
 */
export function validarProyecto(
  d: DatosProyecto,
  nombresDelCliente: string[],
  { edicion = false }: { edicion?: boolean } = {},
): Errores<keyof DatosProyecto> {
  const e: Errores<keyof DatosProyecto> = {};
  const resultado = edicion
    ? ProyectoActualizacionSchema.safeParse(actualizacionDeProyecto(d))
    : ProyectoRegistroSchema.safeParse(registroDeProyecto(CLIENTE_DE_RELLENO, d));

  if (!resultado.success) {
    for (const incidencia of resultado.error.issues) {
      const campo = campoDeRutaProyecto(String(incidencia.path[0]));
      if (!campo || e[campo]) continue;
      e[campo] = vacio(d[campo]) ? OBLIGATORIO : incidencia.message;
    }
  }

  if (!e.nombre && nombresDelCliente.includes(d.nombre.trim())) e.nombre = 'Este cliente ya tiene una sede con ese nombre.';

  return e;
}

export interface DatosServicio {
  tipo: TipoServicio | '';
  frecuencia: FrecuenciaServicio | '';
  areaTotal: string;
  areaTratar: string;
  insumos: string[];
  /** Dosis referencial por insumo elegido, indexada por id de insumo (§7.3). */
  dosis: Record<string, string>;
  equipos: string[];
  requiereCertificado: boolean | null;
  /** Vigencia del certificado en días; solo aplica si el servicio lo requiere. */
  vigenciaDias: string;
}

const MENSAJE_SUPERFICIE = 'Ingrese una superficie mayor a 0 m².';
const MENSAJE_VIGENCIA = 'Ingrese un número entero de días mayor a 0.';

/**
 * Valida el servicio con las reglas de `@gafer/contracts` (esquema de actualización, que comparte con el alta las
 * reglas cruzadas: el área a tratar cabe en el local y el certificado exige vigencia). El tipo no está en ese
 * esquema porque no se edita: aquí se exige que se elija. Que haya al menos un insumo y un equipo, y la dosis de
 * cada insumo, son reglas de la pantalla (§7.3) que el API deja opcionales.
 */
export function validarServicio(d: DatosServicio): Errores<keyof DatosServicio> {
  const e: Errores<keyof DatosServicio> = {};

  const resultado = ServicioContratadoActualizacionSchema.safeParse(actualizacionDeServicio(d));
  if (!resultado.success) {
    for (const incidencia of resultado.error.issues) {
      const campo = campoDeRutaServicio(String(incidencia.path[0]));
      if (!campo || e[campo]) continue;
      if (campo === 'areaTotal' || campo === 'areaTratar') {
        e[campo] = vacio(d[campo]) ? OBLIGATORIO : incidencia.code === 'custom' ? incidencia.message : MENSAJE_SUPERFICIE;
      } else if (campo === 'vigenciaDias') {
        e[campo] = vacio(d.vigenciaDias) ? OBLIGATORIO : MENSAJE_VIGENCIA;
      } else if (campo === 'frecuencia') {
        e[campo] = OBLIGATORIO;
      }
    }
  }

  if (d.tipo === '') e.tipo = OBLIGATORIO;
  if (d.frecuencia === '') e.frecuencia = OBLIGATORIO;
  if (vacio(d.areaTotal)) e.areaTotal = OBLIGATORIO;
  if (vacio(d.areaTratar)) e.areaTratar = OBLIGATORIO;

  if (d.insumos.length === 0) e.insumos = 'Seleccione al menos un insumo autorizado.';
  else if (d.insumos.some((id) => vacio(d.dosis[id] ?? ''))) e.dosis = 'Indique la dosis de cada insumo seleccionado.';

  if (d.equipos.length === 0) e.equipos = 'Seleccione al menos un equipo.';

  if (d.requiereCertificado === null) e.requiereCertificado = 'Indique si el servicio requiere certificado.';

  return e;
}
