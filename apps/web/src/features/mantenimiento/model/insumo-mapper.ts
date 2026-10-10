import type { Insumo, InsumoActualizacion, InsumoRegistro, PresentacionInsumo, UnidadMedidaInsumo } from '@gafer/contracts';
import { repartirError, type ErroresDeServidor } from '../../cliente-expediente/model/errores-servidor';

/**
 * Traducción entre el API de insumos (`/mantenimiento/insumos`) y el formulario.
 *  - El proveedor nulo se muestra como texto vacío y, vacío, se manda como nulo (para poder quitarlo).
 *  - El estado no viaja en el alta ni en la edición: tiene sus propias rutas (`activar` / `desactivar`).
 *  - La resolución del insumo (`resolucionKey`) no se edita desde esta pantalla: no se manda.
 */

export interface DatosInsumo {
  nombreComercial: string;
  principioActivo: string;
  presentacion: PresentacionInsumo | '';
  unidadMedida: UnidadMedidaInsumo | '';
  registroDigesa: string;
  concentracion: string;
  dosisEstandar: string;
  proveedor: string;
  /** Clave de la ficha técnica en el almacenamiento; vacía mientras no se haya subido el PDF. */
  fichaTecnicaKey: string;
  /** Clave de la hoja MSDS en el almacenamiento; vacía mientras no se haya subido el PDF. */
  hojaMsdsKey: string;
}

export function datosDeInsumo(i: Insumo): DatosInsumo {
  return {
    nombreComercial: i.nombreComercial.trim(),
    principioActivo: i.principioActivo,
    presentacion: i.presentacion,
    unidadMedida: i.unidadMedida,
    registroDigesa: i.registroDigesa,
    concentracion: i.concentracion,
    dosisEstandar: i.dosisEstandar,
    proveedor: i.proveedor ?? '',
    fichaTecnicaKey: i.fichaTecnicaKey,
    hojaMsdsKey: i.hojaMsdsKey,
  };
}

/** Cuerpo común del alta y la edición. La presentación y la unidad ya se validaron como elegidas antes de llegar aquí. */
function ficha(d: DatosInsumo): InsumoRegistro {
  const proveedor = d.proveedor.trim();
  return {
    nombreComercial: d.nombreComercial.trim(),
    principioActivo: d.principioActivo.trim(),
    presentacion: d.presentacion as PresentacionInsumo,
    unidadMedida: d.unidadMedida as UnidadMedidaInsumo,
    registroDigesa: d.registroDigesa.trim(),
    concentracion: d.concentracion.trim(),
    dosisEstandar: d.dosisEstandar.trim(),
    fichaTecnicaKey: d.fichaTecnicaKey,
    hojaMsdsKey: d.hojaMsdsKey,
    proveedor: proveedor === '' ? null : proveedor,
  };
}

/** Cuerpo de `POST /mantenimiento/insumos`; el estado inicial lo fija el servidor (ACTIVO). */
export function registroDeInsumo(d: DatosInsumo): InsumoRegistro {
  return ficha(d);
}

/** Cuerpo de `PATCH /mantenimiento/insumos/:id`. */
export function actualizacionDeInsumo(d: DatosInsumo): InsumoActualizacion {
  return ficha(d);
}

/** Campo del formulario al que corresponde una ruta del cuerpo del API. */
export function campoDeRutaInsumo(ruta: string): keyof DatosInsumo | null {
  const campos: Array<keyof DatosInsumo> = [
    'nombreComercial',
    'principioActivo',
    'presentacion',
    'unidadMedida',
    'registroDigesa',
    'concentracion',
    'dosisEstandar',
    'proveedor',
    'fichaTecnicaKey',
    'hojaMsdsKey',
  ];
  return campos.find((c) => c === ruta) ?? null;
}

/** Reparte un error del API entre los campos del formulario del insumo y un mensaje general. */
export function camposDeErrorInsumo(error: unknown): ErroresDeServidor<keyof DatosInsumo> {
  return repartirError(error, campoDeRutaInsumo, (mensaje) =>
    /digesa/i.test(mensaje) ? { registroDigesa: 'Ya existe un insumo con ese registro DIGESA.' } : null,
  );
}
