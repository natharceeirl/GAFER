import type { CargoPersonal, Personal, PersonalActualizacion, PersonalRegistro } from '@gafer/contracts';
import { repartirError, type ErroresDeServidor } from '../../cliente-expediente/model/errores-servidor';

/**
 * Traducción entre el API de personal (`/mantenimiento/personal`) y el formulario.
 *  - El API guarda `nombres` y `apellidos` por separado; la pantalla los muestra como un solo nombre y el
 *    formulario los pide en dos campos.
 *  - El usuario nulo se muestra como texto vacío y, vacío, se manda como nulo.
 *  - La clave no viaja nunca por aquí: el API no tiene un campo para ella (se asigna con `pnpm db:crear-usuario`).
 *  - El estado tiene sus propias rutas (`activar` / `desactivar`).
 */

export interface DatosPersonal {
  dni: string;
  nombres: string;
  apellidos: string;
  cargo: CargoPersonal | '';
  telefono: string;
  usuario: string;
}

/** Nombre con el que se muestra a la persona en las listas y selectores. */
export function nombreCompleto(p: Pick<Personal, 'nombres' | 'apellidos'>): string {
  return `${p.nombres} ${p.apellidos}`.trim();
}

export function datosDePersonal(p: Personal): DatosPersonal {
  return {
    dni: p.dni,
    nombres: p.nombres.trim(),
    apellidos: p.apellidos.trim(),
    cargo: p.cargo,
    telefono: p.telefono,
    usuario: p.usuario ?? '',
  };
}

/** Cuerpo común del alta y la edición. El cargo ya se validó como elegido antes de llegar aquí. */
function ficha(d: DatosPersonal): PersonalRegistro {
  const usuario = d.usuario.trim();
  return {
    dni: d.dni.trim(),
    nombres: d.nombres.trim(),
    apellidos: d.apellidos.trim(),
    cargo: d.cargo as CargoPersonal,
    telefono: d.telefono.trim(),
    usuario: usuario === '' ? null : usuario,
  };
}

/** Cuerpo de `POST /mantenimiento/personal`; el estado inicial lo fija el servidor (ACTIVO). */
export function registroDePersonal(d: DatosPersonal): PersonalRegistro {
  return ficha(d);
}

/** Cuerpo de `PATCH /mantenimiento/personal/:id`. */
export function actualizacionDePersonal(d: DatosPersonal): PersonalActualizacion {
  return ficha(d);
}

export function campoDeRutaPersonal(ruta: string): keyof DatosPersonal | null {
  const campos: Array<keyof DatosPersonal> = ['dni', 'nombres', 'apellidos', 'cargo', 'telefono', 'usuario'];
  return campos.find((c) => c === ruta) ?? null;
}

/** Reparte un error del API entre los campos del formulario del personal y un mensaje general. */
export function camposDeErrorPersonal(error: unknown): ErroresDeServidor<keyof DatosPersonal> {
  return repartirError(error, campoDeRutaPersonal, (mensaje) => {
    if (/\bDNI\b/.test(mensaje)) return { dni: 'Ya hay una persona registrada con ese DNI.' };
    if (/usuario/i.test(mensaje)) return { usuario: 'Ya hay una persona con ese usuario.' };
    return null;
  });
}
