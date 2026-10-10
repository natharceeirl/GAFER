import { describe, expect, it } from 'vitest';
import { FrecuenciaServicioSchema, TipoServicioSchema } from '@gafer/contracts';
import { ETIQUETA_ESTADO, FRECUENCIAS, TIPOS_SERVICIO, etiquetaFrecuencia, etiquetaTipoServicio } from './catalogos-servicio';

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
});
