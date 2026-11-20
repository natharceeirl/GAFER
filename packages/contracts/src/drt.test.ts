import { describe, it, expect } from 'vitest';
import {
  ActaServicioDrtSchema,
  ActividadDrtSchema,
  TipoCeboDrtSchema,
  TipoTrampaDrtSchema,
  EspecieRoedorDrtSchema,
  EstadoEstacionPlanillaSchema,
} from './drt';

describe('Contrato ActaServicioDrt (GAF-103)', () => {
  it('valida un acta completa con las 8 secciones oficiales', () => {
    const dataValida = {
      servicioId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      clienteRazonSocial: 'ALMACENES CENTRALES S.A.C.',
      sedeDireccion: 'Av. Industrial 456, Callao',
      fecha: '2026-11-03',
      areaTratadaM2: 1250.5,
      horaInicio: '08:30',
      horaTermino: '11:45',
      actividad: 'MONITOREO',
      tipoCebo: 'BLOQUE_10G',
      cebosInstalados: 50,
      cebosConsumidos: 12,
      cebosRepuestos: 12,
      tipoTrampa: 'MECANICA',
      trampasInstaladas: 20,
      trampasActivadas: 3,
      roedoresDetectados: ['R_NORVEGICUS', 'MUS_MUSCULUS'],
      resultadosRecomendaciones: 'Se evidencia actividad leve en perímetro norte.',
      observacionesCliente: 'Conforme con el cambio de cebos.',
      firmas: {
        personalResponsableNombre: 'Juan Perez',
        personalResponsableCargo: 'Técnico Aplicador',
        clienteConformidadNombre: 'Carlos Gomez',
        clienteConformidadCargo: 'Jefe de Planta',
        fecha: '2026-11-03',
        firmaDigitalBase64: 'data:image/png;base64,mock',
      },
      planillaEstaciones: [
        { numero: 1, estado: 'SIN_ACTIVIDAD' },
        { numero: 2, estado: 'CON_CONSUMO', consumoGramos: 10, repuestoGramos: 10 },
        { numero: 3, estado: 'SIN_ACCESO', observaciones: 'Puerta con candado' },
        { numero: 4, estado: 'EXTRAVIADA', observaciones: 'Cebadera destruida por montacarga' },
      ],
    };

    const resultado = ActaServicioDrtSchema.safeParse(dataValida);
    expect(resultado.success).toBe(true);
  });

  it('permite valores por defecto para campos de conteo y observaciones', () => {
    const dataMinima = {
      servicioId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      clienteRazonSocial: 'CLIENTE PRUEBA',
      sedeDireccion: 'Calle 123',
      fecha: '2026-11-03',
      horaInicio: '09:00',
      horaTermino: '10:00',
      actividad: 'EVALUACION',
      tipoCebo: 'NINGUNO',
      tipoTrampa: 'NINGUNA',
      firmas: {
        personalResponsableNombre: 'Tecnico',
        personalResponsableCargo: 'Operador',
        clienteConformidadNombre: 'Cliente',
        clienteConformidadCargo: 'Supervisor',
        fecha: '2026-11-03',
      },
    };

    const resultado = ActaServicioDrtSchema.safeParse(dataMinima);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.cebosInstalados).toBe(0);
      expect(resultado.data.trampasActivadas).toBe(0);
      expect(resultado.data.roedoresDetectados).toEqual([]);
      expect(resultado.data.resultadosRecomendaciones).toBe('');
      expect(resultado.data.planillaEstaciones).toEqual([]);
    }
  });

  it('rechaza estados de estación no soportados o números no enteros', () => {
    const dataInvalida = {
      numero: -5,
      estado: 'DESCONOCIDO',
    };
    const res = EstadoEstacionPlanillaSchema.safeParse(dataInvalida.estado);
    expect(res.success).toBe(false);
  });

  it('valida los enums oficiales de actividad, cebos, trampas y especies', () => {
    expect(ActividadDrtSchema.options).toEqual(['EVALUACION', 'INSTALACION', 'MONITOREO', 'EMERGENCIA']);
    expect(TipoCeboDrtSchema.options).toContain('BLOQUE_5G');
    expect(TipoTrampaDrtSchema.options).toContain('PEGATINA');
    expect(EspecieRoedorDrtSchema.options).toEqual(['R_RATTUS', 'R_NORVEGICUS', 'MUS_MUSCULUS']);
    expect(EstadoEstacionPlanillaSchema.options).toContain('SIN_ACCESO');
    expect(EstadoEstacionPlanillaSchema.options).toContain('EXTRAVIADA');
  });
});
