import { describe, it, expect } from 'vitest';
import {
  OperacionSyncSchema,
  LoteSyncRequestSchema,
  LoteSyncResponseSchema,
  PayloadEstacionSyncSchema,
} from './sync.v1';

describe('Contrato sync.v1 (GAP-05)', () => {
  it('valida una operacion individual de estacion correctamente', () => {
    const operacionValida = {
      operationId: '11111111-1111-1111-1111-111111111111',
      tipo: 'REGISTRO_ESTACION',
      agregadoId: '22222222-2222-2222-2222-222222222222',
      actorId: '33333333-3333-3333-3333-333333333333',
      clienteTimestamp: '2026-09-20T18:00:00.000Z',
      payload: {
        estacionId: '44444444-4444-4444-4444-444444444444',
        numeroEstacion: 1,
        huboConsumo: true,
        colorIcono: 'ROJO',
        colorAura: 'VERDE',
      },
    };

    expect(() => OperacionSyncSchema.parse(operacionValida)).not.toThrow();
    expect(() => PayloadEstacionSyncSchema.parse(operacionValida.payload)).not.toThrow();
  });

  it('rechaza una operacion con operationId que no sea UUID', () => {
    const operacionInvalida = {
      operationId: 'no-es-uuid',
      tipo: 'REGISTRO_ESTACION',
      agregadoId: '22222222-2222-2222-2222-222222222222',
      actorId: '33333333-3333-3333-3333-333333333333',
      clienteTimestamp: '2026-09-20T18:00:00.000Z',
      payload: {},
    };

    expect(() => OperacionSyncSchema.parse(operacionInvalida)).toThrow();
  });

  it('valida un lote de sincronizacion completo', () => {
    const lote = {
      inspeccionId: '22222222-2222-2222-2222-222222222222',
      operaciones: [
        {
          operationId: '11111111-1111-1111-1111-111111111111',
          tipo: 'REGISTRO_ESTACION',
          agregadoId: '22222222-2222-2222-2222-222222222222',
          actorId: '33333333-3333-3333-3333-333333333333',
          clienteTimestamp: '2026-09-20T18:00:00.000Z',
          payload: { numeroEstacion: 1 },
        },
      ],
    };

    expect(() => LoteSyncRequestSchema.parse(lote)).not.toThrow();
  });

  it('valida la respuesta del servidor para un lote procesado', () => {
    const respuesta = {
      inspeccionId: '22222222-2222-2222-2222-222222222222',
      procesadas: ['11111111-1111-1111-1111-111111111111'],
      omitidasIdempotentes: [],
      conflictos: [],
      serverReceivedAt: '2026-09-20T18:00:01.000Z',
    };

    expect(() => LoteSyncResponseSchema.parse(respuesta)).not.toThrow();
  });
});
