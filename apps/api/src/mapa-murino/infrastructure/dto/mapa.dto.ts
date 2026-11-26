import { CrearPlanoSchema, RegistrarVisitaMapaSchema } from '@gafer/contracts';
import { createZodDtoDocumentado } from '../../../shared/infrastructure/dto/zod-dto-documentado';

export class CrearPlanoDto extends createZodDtoDocumentado(CrearPlanoSchema, {
  nombre: 'Planta baja',
  puntos: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
  ],
  cerrado: true,
}) {}

export class RegistrarVisitaMapaDto extends createZodDtoDocumentado(RegistrarVisitaMapaSchema, {
  estaciones: [
    {
      estacionId: 'c1111111-1111-4111-8111-111111111111',
      numero: 1,
      tipoEstacion: 'CEBO_RATICIDA',
      posicion: { x: 120, y: 80 },
      instalada: true,
      reubicada: false,
      inspeccion: null,
    },
  ],
}) {}
