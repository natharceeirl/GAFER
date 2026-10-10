import type { Equipo, EquipoActualizacion, EquipoRegistro, TipoEquipo } from '@gafer/contracts';
import { repartirError, type ErroresDeServidor } from '../../cliente-expediente/model/errores-servidor';

/**
 * Traducción entre el API de equipos (`/mantenimiento/equipos`) y el formulario.
 *  - Los datos opcionales nulos se muestran como texto vacío y, vacíos, se mandan como nulos.
 *  - El estado operativo no se edita en la ficha: el alta lo deja en OPERATIVO y el cambio usa `PATCH equipos/:id/estado`.
 */

export interface DatosEquipo {
  codigoInterno: string;
  nombre: string;
  tipo: TipoEquipo | '';
  marcaModelo: string;
  /** Fechas AAAA-MM-DD; vacías si no se conocen. */
  fechaAdquisicion: string;
  ultimoMantenimiento: string;
  proximoMantenimiento: string;
}

export function datosDeEquipo(e: Equipo): DatosEquipo {
  return {
    codigoInterno: e.codigoInterno,
    nombre: e.nombre,
    tipo: e.tipo,
    marcaModelo: e.marcaModelo ?? '',
    fechaAdquisicion: e.fechaAdquisicion ?? '',
    ultimoMantenimiento: e.ultimoMantenimiento ?? '',
    proximoMantenimiento: e.proximoMantenimiento ?? '',
  };
}

const textoONulo = (v: string) => (v.trim() === '' ? null : v.trim());

/** Cuerpo común del alta y la edición. El tipo ya se validó como elegido antes de llegar aquí. */
function ficha(d: DatosEquipo): Omit<EquipoRegistro, 'estadoOperativo'> {
  return {
    codigoInterno: d.codigoInterno.trim().toUpperCase(),
    nombre: d.nombre.trim(),
    tipo: d.tipo as TipoEquipo,
    marcaModelo: textoONulo(d.marcaModelo),
    fechaAdquisicion: textoONulo(d.fechaAdquisicion),
    ultimoMantenimiento: textoONulo(d.ultimoMantenimiento),
    proximoMantenimiento: textoONulo(d.proximoMantenimiento),
  };
}

/** Cuerpo de `POST /mantenimiento/equipos`; sin estado, el servidor lo deja OPERATIVO. */
export function registroDeEquipo(d: DatosEquipo): EquipoRegistro {
  return ficha(d);
}

/** Cuerpo de `PATCH /mantenimiento/equipos/:id`. */
export function actualizacionDeEquipo(d: DatosEquipo): EquipoActualizacion {
  return ficha(d);
}

export function campoDeRutaEquipo(ruta: string): keyof DatosEquipo | null {
  const campos: Array<keyof DatosEquipo> = [
    'codigoInterno',
    'nombre',
    'tipo',
    'marcaModelo',
    'fechaAdquisicion',
    'ultimoMantenimiento',
    'proximoMantenimiento',
  ];
  return campos.find((c) => c === ruta) ?? null;
}

/** Reparte un error del API entre los campos del formulario del equipo y un mensaje general. */
export function camposDeErrorEquipo(error: unknown): ErroresDeServidor<keyof DatosEquipo> {
  return repartirError(error, campoDeRutaEquipo, (mensaje) =>
    /c[oó]digo interno/i.test(mensaje) ? { codigoInterno: 'Ya existe un equipo con ese código interno.' } : null,
  );
}
