import type { ClienteActualizacion, ClienteDetalle, ClienteRegistro } from '@gafer/contracts';
import { ErrorApi, mensajeDeError } from '../../../shared/api/errores';
import type { ClienteFila } from './clientes-mock';
import type { DatosCliente, Errores } from './validaciones';

/**
 * Único punto de traducción entre el API de clientes (`/mantenimiento/clientes`) y el modelo de vista.
 * Diferencias que se resuelven aquí:
 *  - `giroNegocio` es `giro` en la vista y el contacto llega plano (`contactoNombre`…) pero se muestra agrupado.
 *  - El API no guarda la anticipación de la alerta de vencimiento: se persiste en `camposExtra.anticipacionAlertaDias`.
 *  - El API aún no expone último servicio ni próximo vencimiento: llegan como `null` (se muestran como “—”).
 */

/** Fila de la cartera: lo que el listado del API alcanza a mostrar. */
export type ClienteListado = Pick<
  ClienteFila,
  'id' | 'codigoCorto' | 'razonSocial' | 'ruc' | 'giro' | 'ultimoServicio' | 'proximoVencimiento' | 'estado'
>;

/** Elemento de `GET /mantenimiento/clientes` (ClienteResponseDto). */
export interface ClienteResumenApi {
  id: string;
  razonSocial: string;
  ruc: string;
  codigoCorto: string;
  estado: 'ACTIVO' | 'INACTIVO';
  giroNegocio: string;
  contactoNombre: string;
  contactoTelefono: string;
  contactoCorreo: string;
}

export const ANTICIPACION_ALERTA_POR_DEFECTO = 30;
const CLAVE_ANTICIPACION = 'anticipacionAlertaDias';

export function anticipacionDe(camposExtra: Record<string, unknown> | undefined): number {
  const dias = camposExtra?.[CLAVE_ANTICIPACION];
  return typeof dias === 'number' && Number.isInteger(dias) && dias > 0 ? dias : ANTICIPACION_ALERTA_POR_DEFECTO;
}

export function listadoDeApi(api: ClienteResumenApi): ClienteListado {
  return {
    id: api.id,
    codigoCorto: api.codigoCorto,
    razonSocial: api.razonSocial,
    ruc: api.ruc,
    giro: api.giroNegocio,
    ultimoServicio: null,
    proximoVencimiento: null,
    estado: api.estado,
  };
}

export function filaDeApi(api: ClienteDetalle): ClienteFila {
  return {
    id: api.id,
    codigoCorto: api.codigoCorto,
    razonSocial: api.razonSocial,
    ruc: api.ruc,
    giro: api.giroNegocio,
    direccionFiscal: api.direccionFiscal,
    contacto: {
      nombre: api.contactoNombre,
      cargo: api.contactoCargo,
      telefono: api.contactoTelefono,
      correo: api.contactoCorreo,
    },
    ultimoServicio: null,
    proximoVencimiento: null,
    anticipacionAlertaDias: anticipacionDe(api.camposExtra),
    estado: api.estado,
  };
}

export function datosDeFila(c: ClienteFila): DatosCliente {
  return {
    razonSocial: c.razonSocial,
    ruc: c.ruc,
    codigoCorto: c.codigoCorto,
    direccionFiscal: c.direccionFiscal,
    giro: c.giro,
    contactoNombre: c.contacto.nombre,
    contactoCargo: c.contacto.cargo,
    contactoTelefono: c.contacto.telefono,
    contactoCorreo: c.contacto.correo,
    estado: c.estado,
  };
}

function ficha(d: DatosCliente, anticipacionAlertaDias: number) {
  return {
    razonSocial: d.razonSocial.trim(),
    direccionFiscal: d.direccionFiscal.trim(),
    giroNegocio: d.giro.trim(),
    contactoNombre: d.contactoNombre.trim(),
    contactoCargo: d.contactoCargo.trim(),
    contactoTelefono: d.contactoTelefono.trim(),
    contactoCorreo: d.contactoCorreo.trim(),
    camposExtra: { [CLAVE_ANTICIPACION]: anticipacionAlertaDias },
  };
}

/** Cuerpo de `POST /mantenimiento/clientes`; el estado inicial lo fija el servidor (ACTIVO). */
export function registroDeDatos(d: DatosCliente, anticipacionAlertaDias: number): ClienteRegistro {
  return { ...ficha(d, anticipacionAlertaDias), ruc: d.ruc.trim(), codigoCorto: d.codigoCorto.trim() };
}

/** Cuerpo de `PATCH /mantenimiento/clientes/:id`: el RUC y el código corto no cambian (§2) y el estado tiene sus propias rutas. */
export function actualizacionDeDatos(d: DatosCliente, anticipacionAlertaDias: number): ClienteActualizacion {
  return ficha(d, anticipacionAlertaDias);
}

/** Campo del formulario al que corresponde una ruta del cuerpo del API. */
export function campoDeRuta(ruta: string): keyof DatosCliente | null {
  const campos: Record<string, keyof DatosCliente> = {
    razonSocial: 'razonSocial',
    ruc: 'ruc',
    codigoCorto: 'codigoCorto',
    direccionFiscal: 'direccionFiscal',
    giroNegocio: 'giro',
    contactoNombre: 'contactoNombre',
    contactoCargo: 'contactoCargo',
    contactoTelefono: 'contactoTelefono',
    contactoCorreo: 'contactoCorreo',
  };
  return campos[ruta] ?? null;
}

export interface ErroresDeServidor {
  campos: Errores<keyof DatosCliente>;
  /** Mensaje para mostrar sobre el formulario cuando el error no es de un campo concreto. */
  general: string | null;
}

/** Reparte un error del API entre los campos del formulario y un mensaje general. */
export function camposDeError(error: unknown): ErroresDeServidor {
  if (!(error instanceof ErrorApi)) return { campos: {}, general: mensajeDeError(error) };

  if (error.tipo === 'validacion') {
    const campos: Errores<keyof DatosCliente> = {};
    for (const [ruta, mensaje] of Object.entries(error.campos)) {
      const campo = campoDeRuta(ruta);
      if (campo) campos[campo] = mensaje;
    }
    return { campos, general: error.message };
  }

  if (error.tipo === 'conflicto') {
    if (/\bRUC\b/.test(error.message)) return { campos: { ruc: 'Ya hay un cliente registrado con ese RUC.' }, general: null };
    if (/código corto/i.test(error.message)) {
      return { campos: { codigoCorto: 'Ese código ya lo usa otro cliente.' }, general: null };
    }
  }

  return { campos: {}, general: error.message };
}
