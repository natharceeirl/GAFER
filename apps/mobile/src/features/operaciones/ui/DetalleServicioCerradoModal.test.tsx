import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ResumenServicioTecnico } from '@gafer/contracts';
import { flushMicrotasks } from '../../../test-utils/rn-test-harness';

const { testRuntime, rnTools } = await vi.hoisted(async () => {
  const { createReactTestRuntime, createReactNativeMock } = await import(
    '../../../test-utils/rn-test-harness'
  );
  return {
    testRuntime: createReactTestRuntime(),
    rnTools: createReactNativeMock(),
  };
});

vi.mock('react', () => testRuntime.reactMock);
vi.mock('react-native', () => rnTools.rnMock);
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: Record<string, unknown>) => ({ type: 'SafeAreaView', props }),
}));

import { MobileApiClient } from '../../../shared/api/api-client';
import { DetalleServicioCerradoModal } from './DetalleServicioCerradoModal';

const SERVICIO_CERRADO: ResumenServicioTecnico = {
  id: '11111111-1111-4111-8111-111111111111',
  servicioId: '22222222-2222-4222-8222-222222222222',
  codigoInspeccion: 'GAFER-2026-KALLPA-001',
  estado: 'CERRADO',
  versionSync: 2,
  fechaEjecucion: '2026-11-03',
  horaInicio: '08:30',
  horaFin: '10:15',
  tecnicosParticipantes: [{ id: '33333333-3333-4333-8333-333333333333', nombre: 'Juan Perez' }],
  puedeSolicitarCorreccion: true,
  clienteRazonSocial: 'KALLPA GENERACIÓN S.A.',
  sedeNombre: 'CENTRAL_CHILCA',
  servicioTipo: 'DRT',
  snapshotCatalogos: {
    insumos: [
      {
        insumoId: '44444444-4444-4444-8444-444444444444',
        nombreHistorico: 'Bromadiolona Bloque',
        dosisAplicada: '20 g / estación',
        lote: 'LOTE-B01',
        cantidadUtilizada: 12,
        unidadMedida: 'BLOQUE',
        registroDigesa: 'RD-2026-01',
      },
    ],
    equipos: [
      {
        equipoId: '55555555-5555-4555-8555-555555555555',
        codigoInterno: 'EQ-NEB-01',
        nombre: 'Nebulizadora ULV',
        tipo: 'NEBULIZACION',
        marcaModelo: 'Vector Fog C-150',
      },
    ],
    estaciones: [
      {
        numero: 12,
        estado: 'CON_CONSUMO',
        consumoGramos: 15,
        repuestoGramos: 20,
        observaciones: 'Estación repuesta',
      },
    ],
    fechaCierre: '2026-11-03T15:15:00.000Z',
  },
};

describe('DetalleServicioCerradoModal (GAF-104: F3, F5, F6, F7)', () => {
  beforeEach(() => {
    rnTools.reset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testRuntime.unmount();
  });

  it('renderiza snapshotCatalogos completo (insumos, equipos, estaciones) y datos reales sin placeholders ficticios (F5)', () => {
    testRuntime.render(DetalleServicioCerradoModal, {
      visible: true,
      servicio: SERVICIO_CERRADO,
      onCerrar: vi.fn(),
    });

    const texto = testRuntime.getTextContent();
    expect(texto).toContain('KALLPA GENERACIÓN S.A.');
    expect(texto).toContain('CENTRAL_CHILCA');
    expect(texto).toContain('Desratización (DRT)');
    expect(texto).toContain('08:30 - 10:15');
    expect(texto).toContain('Bromadiolona Bloque');
    expect(texto).toContain('LOTE-B01');
    expect(texto).toContain('Nebulizadora ULV');
    expect(texto).toContain('EQ-NEB-01');
    expect(texto).toContain('Estación #12');
    expect(texto).toContain('Consumo: 15 g');
    expect(texto).toContain('Repuesto: 20 g');
  });

  it('oculta el flujo de solicitud de corrección y refleja el estado real cuando puedeSolicitarCorreccion es false (F3)', () => {
    testRuntime.render(DetalleServicioCerradoModal, {
      visible: true,
      servicio: {
        ...SERVICIO_CERRADO,
        estado: 'BORRADOR',
        puedeSolicitarCorreccion: false,
      },
      abrirConCorreccion: true,
      onCerrar: vi.fn(),
    });

    const texto = testRuntime.getTextContent();
    expect(texto).toContain('SERVICIO BORRADOR — SOLO LECTURA');
    expect(testRuntime.queryByTestId('tarjeta-solicitar-correccion')).toBeNull();
    expect(testRuntime.queryByTestId('formulario-correccion')).toBeNull();
    expect(testRuntime.queryByTestId('aviso-sin-correccion')).not.toBeNull();
  });

  it('abre el formulario directamente cuando abrirConCorreccion es true, limita a 500 caracteres y evita enviar >500 al API (F6)', async () => {
    const spySolicitar = vi.spyOn(MobileApiClient.prototype, 'solicitarCorreccion');

    testRuntime.render(DetalleServicioCerradoModal, {
      visible: true,
      servicio: SERVICIO_CERRADO,
      token: 'jwt-test',
      abrirConCorreccion: true,
      onCerrar: vi.fn(),
    });
    await flushMicrotasks();

    const input = testRuntime.getByTestId('input-motivo-correccion');
    expect(input.props.maxLength).toBe(500);

    // Simular texto > 500 caracteres (ej. pegado o estado programático)
    (input.props.onChangeText as (t: string) => void)('a'.repeat(501));
    await flushMicrotasks();

    const botonEnviar = testRuntime.getByTestId('boton-enviar-correccion');
    await (botonEnviar.props.onPress as () => Promise<void>)();

    expect(spySolicitar).not.toHaveBeenCalled();
    expect(rnTools.alertMock).toHaveBeenCalledWith(
      'Motivo demasiado largo',
      'El motivo de la corrección no puede exceder los 500 caracteres.',
    );
  });

  it('envía una solicitud de corrección válida y notifica onCorreccionEnviada (F6, F7)', async () => {
    const spySolicitar = vi
      .spyOn(MobileApiClient.prototype, 'solicitarCorreccion')
      .mockResolvedValue({
        ok: true,
        mensaje: 'Solicitud registrada',
        inspeccionId: SERVICIO_CERRADO.id,
        solicitadaEn: '2026-11-03T16:00:00.000Z',
      });
    const onCorreccionEnviada = vi.fn();

    testRuntime.render(DetalleServicioCerradoModal, {
      visible: true,
      servicio: SERVICIO_CERRADO,
      token: 'jwt-test',
      abrirConCorreccion: true,
      onCerrar: vi.fn(),
      onCorreccionEnviada,
    });
    await flushMicrotasks();

    const input = testRuntime.getByTestId('input-motivo-correccion');
    (input.props.onChangeText as (t: string) => void)(
      'Se ingresó estación 12 en lugar de la estación 14',
    );
    await flushMicrotasks();

    await (testRuntime.getByTestId('boton-enviar-correccion').props.onPress as () => Promise<void>)();
    await flushMicrotasks();

    expect(spySolicitar).toHaveBeenCalledWith(
      SERVICIO_CERRADO.id,
      'Se ingresó estación 12 en lugar de la estación 14',
      'jwt-test',
    );
    expect(onCorreccionEnviada).toHaveBeenCalledWith(SERVICIO_CERRADO.id);
  });
});
