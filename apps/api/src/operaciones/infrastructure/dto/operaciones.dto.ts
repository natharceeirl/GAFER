import {
  CerrarInspeccionSchema,
  ConsumoInsumoSchema,
  CrearInspeccionSchema,
  LoteSyncRequestSchema,
  OperacionSyncSchema,
} from '@gafer/contracts';
import { createZodDtoDocumentado } from '../../../shared/infrastructure/dto/zod-dto-documentado';

const consumoDeEjemplo = {
  insumoId: 'a1111111-1111-4111-8111-111111111111',
  dosisAplicada: '10 ml/L',
  lote: 'LOTE-2026-X',
  cantidadUtilizada: 2.5,
};

const operacionDeEjemplo = {
  operationId: '11111111-1111-4111-8111-111111111111',
  tipo: 'REGISTRO_ESTACION',
  agregadoId: '22222222-2222-4222-8222-222222222222',
  actorId: '33333333-3333-4333-8333-333333333333',
  clienteTimestamp: '2026-09-20T18:00:00.000Z',
  // Alcance provisorio Fase 1: el payload se recibe como objeto libre para no congelar antes de tiempo el
  // esquema de la Fase 3. Migración programada: unión discriminada por `tipo` en `sync.v1`.
  payload: { numeroEstacion: 1, huboConsumo: true },
};

export class ConsumoInsumoDto extends createZodDtoDocumentado(ConsumoInsumoSchema, consumoDeEjemplo) {}

export class CerrarInspeccionDto extends createZodDtoDocumentado(CerrarInspeccionSchema, {
  consumos: [consumoDeEjemplo],
  equiposIds: ['e1111111-1111-4111-8111-111111111111'],
  personalIds: ['b1111111-1111-4111-8111-111111111111'],
}) {}

export class CrearInspeccionDto extends createZodDtoDocumentado(CrearInspeccionSchema, {
  servicioId: 'a1111111-1111-4111-8111-111111111111',
}) {}

export class OperacionSyncDto extends createZodDtoDocumentado(OperacionSyncSchema, operacionDeEjemplo) {}

// La inspección la identifica la ruta (`/inspecciones/:id/sincronizar`), por eso el `inspeccionId` del cuerpo es opcional.
export class SincronizarLoteDto extends createZodDtoDocumentado(LoteSyncRequestSchema.partial({ inspeccionId: true }), {
  inspeccionId: '22222222-2222-4222-8222-222222222222',
  operaciones: [operacionDeEjemplo],
}) {}
