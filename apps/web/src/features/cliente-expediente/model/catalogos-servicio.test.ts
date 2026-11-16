import { describe, expect, it } from 'vitest';
import { EstadoTrabajoSchema, FrecuenciaServicioSchema, TipoServicioSchema } from '@gafer/contracts';
import {
  ESTADOS_TRABAJO,
  ETIQUETA_ESTADO,
  FRECUENCIAS,
  TIPOS_SERVICIO,
  colorEstadoTrabajo,
  etiquetaEstadoTrabajo,
  etiquetaFrecuencia,
  etiquetaTipoServicio,
} from './catalogos-servicio';

describe('catálogos de servicio: código del API ↔ etiqueta de pantalla', () => {
  it('ofrece todas las frecuencias del contrato, con su etiqueta capitalizada', () => {
    expect(FRECUENCIAS.map((f) => f.codigo)).toEqual(FrecuenciaServicioSchema.options);
    expect(etiquetaFrecuencia('QUINCENAL')).toBe('Quincenal');
    expect(etiquetaFrecuencia('PUNTUAL')).toBe('Puntual');
  });

  it('ofrece los 7 tipos del contrato y arma la etiqueta "CÓDIGO — nombre"', () => {
    expect(TIPOS_SERVICIO.map((t) => t.id)).toEqual(TipoServicioSchema.options);
    expect(etiquetaTipoServicio('DRT')).toBe('DRT — Desratización');
  });

  it('etiqueta el estado', () => {
    expect(ETIQUETA_ESTADO.ACTIVO).toBe('Activo');
    expect(ETIQUETA_ESTADO.INACTIVO).toBe('Inactivo');
  });

  it('etiqueta los cuatro estados de trabajo del contrato y les da color (GAF-99)', () => {
    expect(ESTADOS_TRABAJO.map((e) => e.codigo)).toEqual(EstadoTrabajoSchema.options);
    expect(etiquetaEstadoTrabajo('PENDIENTE')).toBe('Pendiente');
    expect(etiquetaEstadoTrabajo('EN_CURSO')).toBe('En curso');
    expect(etiquetaEstadoTrabajo('COMPLETADO')).toBe('Completado');
    expect(etiquetaEstadoTrabajo('CANCELADO')).toBe('Cancelado');
    expect(colorEstadoTrabajo('COMPLETADO')).toBe('VERDE');
    expect(colorEstadoTrabajo('CANCELADO')).toBe('ROJO');
  });
});
