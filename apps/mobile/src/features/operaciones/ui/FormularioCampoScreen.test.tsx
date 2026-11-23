import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperacionSyncSchema } from '@gafer/contracts';
import { flushMicrotasks, AlertButtonLike } from '../../../test-utils/rn-test-harness';

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
vi.mock('zustand', () => testRuntime.createZustandMock());
vi.mock('react-native', () => rnTools.rnMock);
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: Record<string, unknown>) => ({ type: 'SafeAreaView', props }),
}));
vi.mock('expo-status-bar', () => ({
  StatusBar: (props: Record<string, unknown>) => ({ type: 'StatusBar', props }),
}));

import { inicializarBaseDeDatos, cerrarBaseDeDatos } from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { useAuthStore } from '../../auth/model/use-auth-store';
import { BorradorRepository } from '../model/borrador-repository';
import { useBorradorStore } from '../model/use-borrador-store';
import { decodificarBase64Utf8, esFirmaDataUriValida } from '../model/firma-svg';
import {
  INSUMOS_CATALOGO_SEMILLA,
  EQUIPOS_CATALOGO_SEMILLA,
  ConfigServicioBorrador,
} from '../model/formulario-campo';
import { FormularioCampoScreen } from './FormularioCampoScreen';

const TECNICO_UUID = '33333333-3333-4000-8000-000000000001';
const SERVICIO_UUID = 'd1111111-1111-4000-8000-000000000001';

async function prepararBorrador(opciones?: {
  servicioId?: string;
  servicioTipo?: string;
  configServicio?: ConfigServicioBorrador;
  numeroOrden?: string;
}) {
  await useBorradorStore.getState().iniciarBorrador(opciones?.servicioId ?? SERVICIO_UUID, {
    usuarioId: TECNICO_UUID,
    clienteRazonSocial: 'ALICORP S.A.A.',
    sedeNombre: 'PLANTA_CALLAO',
    numeroOrden: opciones?.numeroOrden ?? 'ORD-2026-001',
    servicioTipo: opciones?.servicioTipo ?? 'DESINSECTACION Y DESRATIZACION',
    configServicio: opciones?.configServicio,
  });
}

function llenarBloquesMinimosSinCertificado(insumoId: string) {
  (testRuntime.getByTestId(`input-lote-${insumoId}`).props.onChangeText as (t: string) => void)(
    'L-2026-99',
  );
  (testRuntime.getByTestId(`input-vencimiento-${insumoId}`).props.onChangeText as (t: string) => void)(
    '2028-06-30',
  );
  (testRuntime.getByTestId(`input-cantidad-${insumoId}`).props.onChangeText as (t: string) => void)(
    '15',
  );
  (testRuntime.getByTestId(`input-zonas-${insumoId}`).props.onChangeText as (t: string) => void)(
    'Perímetro y nave 1',
  );
  (testRuntime.getByTestId('input-temperatura').props.onChangeText as (t: string) => void)('22');
  (testRuntime.getByTestId('input-humedad').props.onChangeText as (t: string) => void)('65');
  (testRuntime.getByTestId('input-viento').props.onChangeText as (t: string) => void)('10');
  (testRuntime.getByTestId('estado-general-Bueno').props.onPress as () => void)();
  (testRuntime.getByTestId('nivel-infestacion-Bajo').props.onPress as () => void)();
  (testRuntime.getByTestId('toggle-responsable-no-disponible').props.onPress as () => void)();
}

describe('FormularioCampoScreen (F1, F2, F3, F4, F5, F6, F7, F8)', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    rnTools.reset();
    await cerrarBaseDeDatos();
    await inicializarBaseDeDatos();
    useBorradorStore.setState({
      borrador: null,
      colaEnvioPendiente: false,
      errorPersistencia: null,
    });
    useAuthStore.setState({
      token: 'token-test',
      estado: 'AUTENTICADO',
      error: null,
      usuario: {
        id: TECNICO_UUID,
        dni: '12345678',
        nombres: 'Juan',
        apellidos: 'Perez',
        cargo: 'TECNICO_OPERADOR',
        usuario: 'JPEREZ',
      },
    });
  });

  afterEach(async () => {
    testRuntime.unmount();
    vi.useRealTimers();
    await cerrarBaseDeDatos();
  });

  it('precarga insumosAutorizados, dosisReferencial, equipos autorizados fuera de semilla y respeta requiereCertificado: false (F4, F5)', async () => {
    const equipoExterno = {
      id: 'e9999999-9999-4000-8000-000000000099',
      codigoInterno: 'EQ-ESP-999',
      nombre: 'Termonebulizador Industrial Pro',
      tipo: 'TERMONEBULIZACION',
    };

    await prepararBorrador({
      servicioTipo: 'DESINSECTACION Y DESRATIZACION',
      configServicio: {
        requiereCertificado: false,
        insumosAutorizados: [INSUMOS_CATALOGO_SEMILLA[1].id, INSUMOS_CATALOGO_SEMILLA[0].id],
        dosisReferencial: {
          [INSUMOS_CATALOGO_SEMILLA[1].id]: '2 bloques (40 g) por punto crítico',
          [INSUMOS_CATALOGO_SEMILLA[0].id]: '15 ml por litro de agua',
        },
        equiposAutorizados: [equipoExterno, EQUIPOS_CATALOGO_SEMILLA[4].id],
      },
    });

    testRuntime.render(FormularioCampoScreen, {
      onVolver: vi.fn(),
      onAbrirPlanillaDrt: vi.fn(),
    });

    const texto = testRuntime.getTextContent();
    // F4: servicio combinado DRT muestra botón de planilla DRT
    expect(testRuntime.queryByTestId('boton-abrir-planilla-drt')).not.toBeNull();
    // F5: insumos y dosis referencial personalizada precargados
    expect(texto).toContain('DemoRaticida Bloque B');
    expect(texto).toContain('2 bloques (40 g) por punto crítico');
    expect(texto).toContain('DemoCiper 25 EC');
    expect(texto).toContain('15 ml por litro de agua');
    // F5: equipo autorizado fuera de la semilla renderizado y seleccionable en Bloque 2
    expect(testRuntime.queryByTestId(`equipo-toggle-${equipoExterno.id}`)).not.toBeNull();
    expect(texto).toContain('Termonebulizador Industrial Pro');
    expect(texto).toContain('EQ-ESP-999');
    // F5: requiereCertificado: false oculta Bloque 8
    expect(testRuntime.queryByTestId('input-certificado-numero')).toBeNull();
  });

  it('captura firma táctil real en FirmaPadModal y genera un SVG Base64 válido en vez de mockFirmaTrace (F7)', async () => {
    await prepararBorrador({ configServicio: { requiereCertificado: false } });

    testRuntime.render(FormularioCampoScreen, { onVolver: vi.fn() });

    // Ingresar datos de contacto del cliente
    (testRuntime.getByTestId('input-firmante-nombre').props.onChangeText as (t: string) => void)(
      'Julio Valdivia',
    );
    (testRuntime.getByTestId('input-firmante-cargo').props.onChangeText as (t: string) => void)(
      'Jefe de Planta',
    );

    // Abrir modal de firma
    (testRuntime.getByTestId('boton-firmar-cliente').props.onPress as () => void)();
    expect(testRuntime.queryByTestId('modal-firma-pad')).not.toBeNull();

    // Intentar confirmar sin trazo debe fallar y mantener modal abierto
    (testRuntime.getByTestId('boton-confirmar-firma').props.onPress as () => void)();
    expect(testRuntime.queryByTestId('error-firma-pad')).not.toBeNull();
    expect(testRuntime.queryByTestId('modal-firma-pad')).not.toBeNull();

    // Dibujar un trazo real sobre el lienzo vía PanResponder
    const lienzo = testRuntime.getByTestId('lienzo-firma');
    (lienzo.props.onPanResponderGrant as (e: unknown) => void)({
      nativeEvent: { locationX: 20, locationY: 80 },
    });
    (lienzo.props.onPanResponderMove as (e: unknown) => void)({
      nativeEvent: { locationX: 110, locationY: 45 },
    });
    (lienzo.props.onPanResponderMove as (e: unknown) => void)({
      nativeEvent: { locationX: 210, locationY: 95 },
    });
    (lienzo.props.onPanResponderRelease as () => void)();

    // Confirmar firma
    (testRuntime.getByTestId('boton-confirmar-firma').props.onPress as () => void)();
    expect(testRuntime.queryByTestId('modal-firma-pad')).toBeNull();

    // Persistir y verificar que la firma almacenada es SVG Base64 real
    await (testRuntime.getByTestId('boton-guardar-borrador').props.onPress as () => Promise<void>)();
    const enDisco = await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID);
    const firma = enDisco?.datosCampo?.firma;
    expect(firma).toBeTruthy();
    expect(firma).not.toContain('mockFirmaTrace');
    expect(esFirmaDataUriValida(firma)).toBe(true);

    const base64 = firma!.replace('data:image/svg+xml;base64,', '');
    const svg = decodificarBase64Utf8(base64);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path d="M 20 80 L 110 45 L 210 95"');
  });

  it('tras finalizarServicioCampo, el timer debounced (1.5s), Volver y BackHandler NO resucitan el borrador (F3)', async () => {
    await prepararBorrador({
      configServicio: {
        requiereCertificado: false,
        insumosAutorizados: [INSUMOS_CATALOGO_SEMILLA[1].id],
      },
    });
    const onVolver = vi.fn();

    testRuntime.render(FormularioCampoScreen, { onVolver });
    llenarBloquesMinimosSinCertificado(INSUMOS_CATALOGO_SEMILLA[1].id);

    // Cerrar ANTES de que venza el timer debounced de 1.5s
    (testRuntime.getByTestId('boton-cerrar-inspeccion').props.onPress as () => void)();
    expect(rnTools.alertMock).toHaveBeenCalledTimes(1);

    const botones = rnTools.alertMock.mock.calls[0][2] as AlertButtonLike[];
    const botonConfirmar = botones.find((b) => b.text === 'Cerrar e Iniciar Sincronización');
    expect(botonConfirmar?.onPress).toBeDefined();

    await botonConfirmar!.onPress!();
    await flushMicrotasks();

    // Alert de éxito abierto, usuario aún no pulsa Aceptar
    expect(rnTools.alertMock).toHaveBeenCalledTimes(2);
    expect(rnTools.alertMock.mock.calls[1][0]).toBe('Inspección Cerrada Exitosamente');
    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(
      await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID),
    ).toBeNull();

    // 1) Avanzar 4 segundos (más allá del debounce de 1.5s)
    await vi.advanceTimersByTimeAsync(4000);
    await flushMicrotasks();

    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(
      await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID),
    ).toBeNull();

    // 2) Pulsar botón Volver y botón atrás de hardware en Android
    await (testRuntime.getByTestId('boton-volver-formulario').props.onPress as () => Promise<void>)();
    rnTools.triggerHardwareBack();
    await flushMicrotasks();

    expect(onVolver).toHaveBeenCalledTimes(2);
    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(
      await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID),
    ).toBeNull();

    // Exactamente 1 operación válida en sync_outbox
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes).toHaveLength(1);
    expect(OperacionSyncSchema.safeParse(pendientes[0].operacion).success).toBe(true);
  });

  it('handleVolver y BackHandler guardan en SQLite cambios recientes (<1.5s) antes de desmontar (F3)', async () => {
    await prepararBorrador({ configServicio: { requiereCertificado: false } });
    const onVolver = vi.fn();

    testRuntime.render(FormularioCampoScreen, { onVolver });

    // Editar observación sin esperar los 1500 ms del autoguardado
    (testRuntime.getByTestId('input-observaciones-libre').props.onChangeText as (t: string) => void)(
      'Cambio inmediato antes de salir',
    );

    // Pulsar botón atrás de hardware en Android
    rnTools.triggerHardwareBack();
    await flushMicrotasks(20);

    expect(onVolver).toHaveBeenCalledTimes(1);
    const enDisco = await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID);
    expect(enDisco?.datosCampo?.observacionesLibre).toBe('Cambio inmediato antes de salir');
  });

  it('impide cerrar si no existe usuario autenticado con UUID válido en vez de usar "tecnico-operador-local" (F6)', async () => {
    await prepararBorrador({
      configServicio: {
        requiereCertificado: false,
        insumosAutorizados: [INSUMOS_CATALOGO_SEMILLA[1].id],
      },
    });
    useAuthStore.setState({ usuario: null });

    testRuntime.render(FormularioCampoScreen, { onVolver: vi.fn() });
    llenarBloquesMinimosSinCertificado(INSUMOS_CATALOGO_SEMILLA[1].id);

    (testRuntime.getByTestId('boton-cerrar-inspeccion').props.onPress as () => void)();

    expect(rnTools.alertMock).toHaveBeenCalledTimes(1);
    expect(rnTools.alertMock.mock.calls[0][0]).toBe('Sesión de Técnico Requerida');

    const outbox = new OutboxQueue();
    await outbox.inicializar();
    expect(outbox.obtenerPendientes()).toHaveLength(0);
    expect(useBorradorStore.getState().borrador?.servicioId).toBe(SERVICIO_UUID);
  });

  it('sin borrador activo no inyecta datos ficticios ALICORP/PLANTA_CALLAO ni sobrescribe SQLite (F2)', async () => {
    testRuntime.render(FormularioCampoScreen, { onVolver: vi.fn() });

    const texto = testRuntime.getTextContent();
    expect(texto).not.toContain('ALICORP S.A.A.');
    expect(texto).not.toContain('PLANTA_CALLAO');
    expect(texto).not.toContain('Marco Ipusari');

    // Avanzar más allá de 1.5s: NO debe escribir ningún borrador ficticio en SQLite ni en el store
    await vi.advanceTimersByTimeAsync(3000);
    await flushMicrotasks();

    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(await new BorradorRepository().obtenerActivo(TECNICO_UUID)).toBeNull();
  });
});
