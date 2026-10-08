import type { Equipo as EquipoApi, EstadoOperativoEquipo, Insumo as InsumoApi, TipoEquipo } from '@gafer/contracts';
import type { Equipo, EstadoOperativo, Insumo } from '../../mantenimiento/model/tipos';

/**
 * Puente entre los catálogos del API (`/mantenimiento/insumos`, `/mantenimiento/equipos`) y el modelo que
 * hoy usan el formulario de servicio y la vista del técnico. Los catálogos de Mantenimiento siguen en mock
 * (GAF-26/27 los migran): aquí solo se leen los insumos y equipos reales para elegirlos en un servicio.
 */

const ESTADO_OPERATIVO: Record<EstadoOperativoEquipo, EstadoOperativo> = {
  OPERATIVO: 'OPERATIVO',
  MANTENIMIENTO: 'EN_MANTENIMIENTO',
  FUERA_SERVICIO: 'FUERA_DE_SERVICIO',
};

const ETIQUETA_TIPO_EQUIPO: Record<TipoEquipo, string> = {
  FUMIGACION: 'Fumigación',
  NEBULIZACION: 'Nebulización',
  ASPERSION: 'Aspersión',
  LIMPIEZA: 'Limpieza',
  MEDICION: 'Medición',
  PROTECCION: 'Protección',
  OTRO: 'Otro',
};

export function insumoDeApi(api: InsumoApi): Insumo {
  return {
    id: api.id,
    nombre: api.nombreComercial,
    principioActivo: api.principioActivo,
    presentacion: api.presentacion,
    concentracion: api.concentracion,
    registroDigesa: api.registroDigesa,
    dosisReferencial: api.dosisEstandar,
    estado: api.estado,
  };
}

export function equipoDeApi(api: EquipoApi): Equipo {
  return {
    id: api.id,
    nombre: api.nombre,
    codigoInterno: api.codigoInterno,
    tipo: ETIQUETA_TIPO_EQUIPO[api.tipo] ?? api.tipo,
    estadoOperativo: ESTADO_OPERATIVO[api.estadoOperativo] ?? 'OPERATIVO',
  };
}
