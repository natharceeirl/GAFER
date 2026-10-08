import type {
  EstadoActivoInactivo,
  FrecuenciaServicio,
  ServicioContratadoActualizacion,
  ServicioContratadoDetalle,
  ServicioContratadoRegistro,
  TipoServicio,
} from '@gafer/contracts';
import { repartirError, type ErroresDeServidor } from './errores-servidor';
import type { DatosServicio } from './validaciones';

/**
 * Traducción entre el API de servicios contratados (`/mantenimiento/servicios-contratados`) y el modelo de vista.
 * La vista conserva los códigos del contrato (tipo, frecuencia, estado); las etiquetas salen de `catalogos-servicio`.
 * Diferencias que se resuelven aquí:
 *  - El formulario trabaja con textos; el API recibe números (áreas, días de vigencia).
 *  - La vigencia del certificado se pide en días (`vigenciaDias`) y solo viaja si el servicio requiere certificado.
 *  - El estado no viaja en el alta ni en la edición: tiene sus propias rutas (`activar` / `desactivar`).
 */

/** Servicio contratado en una sede (§7.3): lo que después se precarga en el formulario de campo (§8.2). */
export interface ServicioContratado {
  id: string;
  proyectoId: string;
  tipoServicio: TipoServicio;
  frecuencia: FrecuenciaServicio;
  areaTotalM2: number;
  areaTratarM2: number;
  insumosAutorizados: string[];
  equiposAutorizados: string[];
  /** Dosis referencial por insumo, indexada por id de insumo. */
  dosisReferencial: Record<string, string>;
  requiereCertificado: boolean;
  vigenciaDias: number | null;
  estado: EstadoActivoInactivo;
}

export function servicioDeApi(api: ServicioContratadoDetalle): ServicioContratado {
  return {
    id: api.id,
    proyectoId: api.proyectoId,
    tipoServicio: api.tipoServicio,
    frecuencia: api.frecuencia,
    areaTotalM2: api.areaTotalM2,
    areaTratarM2: api.areaTratarM2,
    insumosAutorizados: api.insumosAutorizados ?? [],
    equiposAutorizados: api.equiposAutorizados ?? [],
    dosisReferencial: api.dosisReferencial ?? {},
    requiereCertificado: api.requiereCertificado ?? false,
    vigenciaDias: api.vigenciaDias ?? null,
    estado: api.estado,
  };
}

export function datosDeServicio(s: ServicioContratado): DatosServicio {
  return {
    tipo: s.tipoServicio,
    frecuencia: s.frecuencia,
    areaTotal: String(s.areaTotalM2),
    areaTratar: String(s.areaTratarM2),
    insumos: s.insumosAutorizados,
    dosis: s.dosisReferencial,
    equipos: s.equiposAutorizados,
    requiereCertificado: s.requiereCertificado,
    vigenciaDias: s.vigenciaDias === null ? '' : String(s.vigenciaDias),
  };
}

/** Días de vigencia que se envían: solo con certificado; un texto no numérico llega como NaN para que el esquema lo rechace. */
function vigenciaDe(d: DatosServicio): number | null {
  return d.requiereCertificado === true && d.vigenciaDias.trim() !== '' ? Number(d.vigenciaDias) : null;
}

function ficha(d: DatosServicio) {
  return {
    areaTotalM2: Number(d.areaTotal),
    areaTratarM2: Number(d.areaTratar),
    insumosAutorizados: d.insumos,
    equiposAutorizados: d.equipos,
    // Solo se guarda la dosis de los insumos elegidos.
    dosisReferencial: Object.fromEntries(d.insumos.map((id) => [id, (d.dosis[id] ?? '').trim()])),
    requiereCertificado: d.requiereCertificado === true,
    vigenciaDias: vigenciaDe(d),
  };
}

/** Cuerpo de `POST /mantenimiento/servicios-contratados`; quien llama garantiza tipo y frecuencia ya validados. */
export function registroDeServicio(proyectoId: string, d: DatosServicio): ServicioContratadoRegistro {
  return { proyectoId, tipoServicio: d.tipo as TipoServicio, frecuencia: d.frecuencia as FrecuenciaServicio, ...ficha(d) };
}

/** Cuerpo de `PATCH /mantenimiento/servicios-contratados/:id`: el tipo y la sede no cambian. */
export function actualizacionDeServicio(d: DatosServicio): ServicioContratadoActualizacion {
  return { frecuencia: d.frecuencia === '' ? undefined : d.frecuencia, ...ficha(d) };
}

/** Campo del formulario al que corresponde una ruta del cuerpo del API. */
export function campoDeRutaServicio(ruta: string): keyof DatosServicio | null {
  const campos: Record<string, keyof DatosServicio> = {
    tipoServicio: 'tipo',
    frecuencia: 'frecuencia',
    areaTotalM2: 'areaTotal',
    areaTratarM2: 'areaTratar',
    insumosAutorizados: 'insumos',
    equiposAutorizados: 'equipos',
    dosisReferencial: 'dosis',
    requiereCertificado: 'requiereCertificado',
    vigenciaDias: 'vigenciaDias',
  };
  return campos[ruta.split('.')[0]] ?? null;
}

/** Reparte un error del API entre los campos del formulario del servicio y un mensaje general. */
export function camposDeErrorServicio(error: unknown): ErroresDeServidor<keyof DatosServicio> {
  return repartirError(error, campoDeRutaServicio);
}
