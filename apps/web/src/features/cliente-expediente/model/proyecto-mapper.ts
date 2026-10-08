import type { EstadoActivoInactivo, ProyectoActualizacion, ProyectoRegistro } from '@gafer/contracts';
import type { ServicioContratado } from './servicio-mapper';
import type { DatosProyecto } from './validaciones';

/**
 * Traducción entre el API de sedes (`/mantenimiento/proyectos`) y el modelo de vista.
 * Diferencias que se resuelven aquí:
 *  - `direccionSede` es `direccion` en la vista y `observaciones` nulo se muestra como cadena vacía.
 *  - El estado no viaja en el alta ni en la edición: tiene sus propias rutas (`activar` / `desactivar`).
 */

/** Sede de un cliente con los servicios contratados en ella (§7.2). */
export interface ProyectoExpediente {
  id: string;
  clienteId: string;
  nombre: string;
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoTelefono: string;
  observaciones: string;
  estado: EstadoActivoInactivo;
  servicios: ServicioContratado[];
}

export function datosDeProyecto(p: ProyectoExpediente): DatosProyecto {
  return {
    nombre: p.nombre,
    direccion: p.direccion,
    distrito: p.distrito,
    provincia: p.provincia,
    departamento: p.departamento,
    contactoNombre: p.contactoNombre,
    contactoCargo: p.contactoCargo,
    contactoTelefono: p.contactoTelefono,
    observaciones: p.observaciones,
  };
}

function ficha(d: DatosProyecto) {
  return {
    direccionSede: d.direccion.trim(),
    distrito: d.distrito.trim(),
    provincia: d.provincia.trim(),
    departamento: d.departamento.trim(),
    contactoNombre: d.contactoNombre.trim(),
    contactoCargo: d.contactoCargo.trim(),
    contactoTelefono: d.contactoTelefono.trim(),
    observaciones: d.observaciones.trim() === '' ? null : d.observaciones.trim(),
  };
}

/** Cuerpo de `POST /mantenimiento/proyectos`; el estado inicial lo fija el servidor (ACTIVO). */
export function registroDeProyecto(clienteId: string, d: DatosProyecto): ProyectoRegistro {
  return { clienteId, nombre: d.nombre.trim(), ...ficha(d) };
}

/** Cuerpo de `PATCH /mantenimiento/proyectos/:id`: el cliente propietario no cambia. */
export function actualizacionDeProyecto(d: DatosProyecto): ProyectoActualizacion {
  return { nombre: d.nombre.trim(), ...ficha(d) };
}

/** Campo del formulario al que corresponde una ruta del cuerpo del API. */
export function campoDeRutaProyecto(ruta: string): keyof DatosProyecto | null {
  const campos: Record<string, keyof DatosProyecto> = {
    nombre: 'nombre',
    direccionSede: 'direccion',
    distrito: 'distrito',
    provincia: 'provincia',
    departamento: 'departamento',
    contactoNombre: 'contactoNombre',
    contactoCargo: 'contactoCargo',
    contactoTelefono: 'contactoTelefono',
    observaciones: 'observaciones',
  };
  return campos[ruta] ?? null;
}
