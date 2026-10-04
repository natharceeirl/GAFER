import { describe, expect, it } from 'vitest';
import {
  ConsultaAuditoriaFiltrosSchema,
  EventoAuditoriaRegistroSchema,
  EventoAuditoriaSchema,
  ModuloAuditoriaSchema,
} from './auditoria';
import { esperarFallaEn } from './pruebas';

describe('Auditoria Schemas (Spec §8.4, C6 / GAF-23)', () => {
  const eventoValido = {
    actorId: '11111111-1111-1111-1111-111111111111',
    actorUsuario: 'ADMIN',
    actorRol: 'ADMINISTRADOR',
    modulo: 'MANTENIMIENTO',
    accion: 'ACTUALIZAR_INSUMO',
    entidad: 'insumo',
    entidadId: '22222222-2222-2222-2222-222222222222',
    payloadAnterior: { dosisEstandar: '5 ml/L' },
    payloadNuevo: { dosisEstandar: '10 ml/L' },
    detalles: { motivo: 'Corrección técnica' },
  };

  it('valida registro de evento de auditoría con datos correctos', () => {
    expect(EventoAuditoriaRegistroSchema.safeParse(eventoValido).success).toBe(true);
  });

  it('rechaza módulo inválido o campos obligatorios vacíos', () => {
    esperarFallaEn(
      EventoAuditoriaRegistroSchema,
      { ...eventoValido, modulo: 'INVALIDO' },
      'modulo',
    );
    esperarFallaEn(
      EventoAuditoriaRegistroSchema,
      { ...eventoValido, accion: '' },
      'accion',
    );
    esperarFallaEn(
      EventoAuditoriaRegistroSchema,
      { ...eventoValido, actorUsuario: '' },
      'actorUsuario',
    );
  });

  it('valida evento de auditoría persistido con ID y timestamp', () => {
    const eventoPersistido = {
      ...eventoValido,
      id: '33333333-3333-3333-3333-333333333333',
      createdAt: '2026-10-03T20:00:00.000Z',
    };
    expect(EventoAuditoriaSchema.safeParse(eventoPersistido).success).toBe(true);
  });

  it('valida filtros de consulta con paginación por defecto', () => {
    const filtros = ConsultaAuditoriaFiltrosSchema.parse({
      modulo: 'CONFIGURACION',
    });
    expect(filtros.modulo).toBe('CONFIGURACION');
    expect(filtros.limit).toBe(20);
    expect(filtros.offset).toBe(0);
  });
});
