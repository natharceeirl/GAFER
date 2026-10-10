import { describe, expect, it } from 'vitest';
import { EstadoOperativoEquipoSchema, PresentacionInsumoSchema, TipoEquipoSchema, UnidadMedidaInsumoSchema } from '@gafer/contracts';
import {
  ESTADOS_OPERATIVOS,
  PRESENTACIONES,
  TIPOS_EQUIPO,
  UNIDADES_MEDIDA,
  etiquetaEstadoActivo,
  etiquetaEstadoOperativo,
  etiquetaPresentacion,
  etiquetaTipoEquipo,
  etiquetaUnidad,
} from './catalogos-etiquetas';

const codigos = (lista: Array<{ codigo: string }>) => lista.map((e) => e.codigo);

describe('etiquetas de los catálogos de Mantenimiento', () => {
  it('cubren exactamente los códigos de @gafer/contracts', () => {
    expect(codigos(ESTADOS_OPERATIVOS)).toEqual(EstadoOperativoEquipoSchema.options);
    expect(codigos(TIPOS_EQUIPO)).toEqual(TipoEquipoSchema.options);
    expect(codigos(PRESENTACIONES)).toEqual(PresentacionInsumoSchema.options);
    expect(codigos(UNIDADES_MEDIDA)).toEqual(UnidadMedidaInsumoSchema.options);
  });

  it('el estado de la base FUERA_SERVICIO se muestra como "Fuera de servicio"', () => {
    expect(etiquetaEstadoOperativo('MANTENIMIENTO')).toBe('En mantenimiento');
    expect(etiquetaEstadoOperativo('FUERA_SERVICIO')).toBe('Fuera de servicio');
    expect(etiquetaEstadoOperativo('OPERATIVO')).toBe('Operativo');
  });

  it('traducen tipo de equipo, presentación, unidad y estado activo', () => {
    expect(etiquetaTipoEquipo('NEBULIZACION')).toBe('Nebulización');
    expect(etiquetaPresentacion('LIQUIDO')).toBe('Líquido');
    expect(etiquetaUnidad('ML')).toBe('Mililitros (ml)');
    expect(etiquetaEstadoActivo('ACTIVO')).toBe('Activo');
    expect(etiquetaEstadoActivo('INACTIVO')).toBe('Inactivo');
  });

  it('un código desconocido se muestra tal cual en vez de romper la pantalla', () => {
    expect(etiquetaTipoEquipo('NUEVO' as never)).toBe('NUEVO');
    expect(etiquetaEstadoOperativo('OTRO_ESTADO' as never)).toBe('OTRO_ESTADO');
  });
});
