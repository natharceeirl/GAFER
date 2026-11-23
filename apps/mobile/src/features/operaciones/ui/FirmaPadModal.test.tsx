import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

import { esFirmaDataUriValida } from '../model/firma-svg';
import { FirmaPadModal, ResultadoFirma } from './FirmaPadModal';

describe('FirmaPadModal (Prioridad 0a, F3, F4, F10)', () => {
  beforeEach(() => {
    rnTools.reset();
  });

  afterEach(() => {
    testRuntime.unmount();
  });

  it('no sufre closure obsoleto de noDisponible en PanResponder: abrir con responsableNoDisponibleInicial=true y desmarcar permite firmar (F4)', async () => {
    const onGuardar = vi.fn<(r: ResultadoFirma) => void>();
    const onCerrar = vi.fn();

    testRuntime.render(FirmaPadModal, {
      visible: true,
      onGuardar,
      onCerrar,
      responsableNoDisponibleInicial: true,
      motivoNoDisponibleInicial: 'Turno nocturno',
    });

    // Al abrir con responsableNoDisponibleInicial=true, se muestra el input de motivo y no el lienzo
    expect(testRuntime.queryByTestId('input-modal-motivo-no-disponible')).not.toBeNull();
    expect(testRuntime.queryByTestId('lienzo-firma')).toBeNull();

    // Desmarcar "Responsable no disponible"
    (testRuntime.getByTestId('toggle-modal-responsable-no-disponible').props.onPress as () => void)();
    expect(testRuntime.queryByTestId('lienzo-firma')).not.toBeNull();

    // Dibujar trazo real en el lienzo: PanResponder debe ver noDisponible=false (sin closure obsoleto)
    const lienzo = testRuntime.getByTestId('lienzo-firma');
    expect((lienzo.props.onStartShouldSetPanResponder as () => boolean)()).toBe(true);

    (lienzo.props.onPanResponderGrant as (e: unknown) => void)({
      nativeEvent: { locationX: 15, locationY: 60 },
    });
    (lienzo.props.onPanResponderMove as (e: unknown) => void)({
      nativeEvent: { locationX: 145, locationY: 90 },
    });
    (lienzo.props.onPanResponderRelease as () => void)();

    // Confirmar firma y verificar SVG válido
    await (testRuntime.getByTestId('boton-confirmar-firma').props.onPress as () => Promise<void>)();

    expect(onGuardar).toHaveBeenCalledTimes(1);
    const resultado = onGuardar.mock.calls[0][0];
    expect(resultado.responsableNoDisponible).toBe(false);
    expect(resultado.firmaBase64).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(esFirmaDataUriValida(resultado.firmaBase64)).toBe(true);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('resincroniza noDisponible, motivo y trazos al cambiar props y reabrir el modal (F4)', async () => {
    const onGuardar = vi.fn();
    const onCerrar = vi.fn();

    const Wrapper = (props: {
      visible: boolean;
      noDisp: boolean;
      motivo: string;
    }) =>
      testRuntime.reactMock.createElement(FirmaPadModal, {
        visible: props.visible,
        onGuardar,
        onCerrar,
        responsableNoDisponibleInicial: props.noDisp,
        motivoNoDisponibleInicial: props.motivo,
      });

    // Abrir inicialmente con noDisponible=false y dibujar trazo sin confirmar
    testRuntime.render(Wrapper, { visible: true, noDisp: false, motivo: '' });
    const lienzo = testRuntime.getByTestId('lienzo-firma');
    (lienzo.props.onPanResponderGrant as (e: unknown) => void)({
      nativeEvent: { locationX: 10, locationY: 10 },
    });
    (lienzo.props.onPanResponderMove as (e: unknown) => void)({
      nativeEvent: { locationX: 90, locationY: 90 },
    });
    (lienzo.props.onPanResponderRelease as () => void)();

    // Reabrir con otro borrador que tiene responsableNoDisponibleInicial=true y nuevo motivo
    testRuntime.render(Wrapper, {
      visible: true,
      noDisp: true,
      motivo: 'Planta cerrada por mantenimiento',
    });

    const inputMotivo = testRuntime.getByTestId('input-modal-motivo-no-disponible');
    expect(inputMotivo.props.value).toBe('Planta cerrada por mantenimiento');

    await (testRuntime.getByTestId('boton-confirmar-firma').props.onPress as () => Promise<void>)();
    expect(onGuardar).toHaveBeenCalledWith({
      firmaBase64: null,
      responsableNoDisponible: true,
      motivoNoDisponible: 'Planta cerrada por mantenimiento',
    });
  });

  it('funciona en modo FormularioCampoScreen (onConfirmar/onCancelar) sin usar global Buffer (Prioridad 0a, F3)', async () => {
    const onConfirmar = vi.fn<(uri: string) => void>();
    const onCancelar = vi.fn();

    const bufferFromSpy = vi.spyOn(Buffer, 'from');
    try {
      testRuntime.render(FirmaPadModal, {
        visible: true,
        firmanteNombre: 'Ana Quispe',
        firmanteCargo: 'Jefa de Calidad',
        onConfirmar,
        onCancelar,
      });

      // No muestra toggle de ausencia en modo FormularioCampoScreen
      expect(testRuntime.queryByTestId('toggle-modal-responsable-no-disponible')).toBeNull();

      const lienzo = testRuntime.getByTestId('lienzo-firma');
      (lienzo.props.onPanResponderGrant as (e: unknown) => void)({
        nativeEvent: { locationX: 30, locationY: 40 },
      });
      (lienzo.props.onPanResponderMove as (e: unknown) => void)({
        nativeEvent: { locationX: 180, locationY: 110 },
      });
      (lienzo.props.onPanResponderRelease as () => void)();

      await (testRuntime.getByTestId('boton-confirmar-firma').props.onPress as () => Promise<void>)();

      const llamadasBase64OBinario = (bufferFromSpy.mock.calls as readonly unknown[][]).filter(
        (call) =>
          typeof call[0] === 'string' || call[0] instanceof Uint8Array || call[1] === 'base64',
      );
      expect(llamadasBase64OBinario).toHaveLength(0);
      expect(onConfirmar).toHaveBeenCalledTimes(1);
      expect(esFirmaDataUriValida(onConfirmar.mock.calls[0][0])).toBe(true);
    } finally {
      bufferFromSpy.mockRestore();
    }
  });
});
