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
import { useAgendaStore } from '../../agenda/model/agenda';
import { BorradorRepository } from '../model/borrador-repository';
import { useBorradorStore } from '../model/use-borrador-store';
import { FormularioDrtScreen } from './FormularioDrtScreen';

const TECNICO_UUID = '33333333-3333-4000-8000-000000000001';
const SERVICIO_UUID = 'd1111111-1111-4000-8000-000000000001';

async function prepararBorradorActivo(servicioId = SERVICIO_UUID) {
  await useBorradorStore.getState().iniciarBorrador(servicioId, {
    usuarioId: TECNICO_UUID,
    clienteRazonSocial: 'ALICORP S.A.A.',
    sedeNombre: 'PLANTA_CALLAO',
    numeroOrden: 'ORD-2026-001',
    servicioTipo: 'DESRATIZACION_DRT',
  });
}

function completarConformidadCliente() {
  const inputNombre = testRuntime.getByTestId('input-cliente-conformidad-nombre');
  (inputNombre.props.onChangeText as (t: string) => void)('Carlos Gomez');
  const inputCargo = testRuntime.getByTestId('input-cliente-conformidad-cargo');
  (inputCargo.props.onChangeText as (t: string) => void)('Jefe de Planta');
}

describe('FormularioDrtScreen (F2, F3, F4, F5, F6)', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    rnTools.reset();
    await cerrarBaseDeDatos();
    await inicializarBaseDeDatos();
    useAgendaStore.getState().reiniciarEstado();
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

  it('permite registrar gramos de consumo y de repuesto de forma independiente por estación (F4)', async () => {
    await prepararBorradorActivo();
    const onVolver = vi.fn();

    testRuntime.render(FormularioDrtScreen, { onVolver });

    // Marcar Estación #1 como CON_CONSUMO
    const chipConsumo = testRuntime.getByTestId('chip-estacion-1-CON_CONSUMO');
    (chipConsumo.props.onPress as () => void)();

    // Ingresar 15g de consumo y 25g de repuesto
    const inputConsumo = testRuntime.getByTestId('input-consumo-estacion-1');
    (inputConsumo.props.onChangeText as (t: string) => void)('15');

    const inputRepuesto = testRuntime.getByTestId('input-repuesto-estacion-1');
    (inputRepuesto.props.onChangeText as (t: string) => void)('25');

    // Verificar que los inputs mantienen valores independientes (sin sobrescribirse entre sí)
    expect(testRuntime.getByTestId('input-consumo-estacion-1').props.value).toBe('15');
    expect(testRuntime.getByTestId('input-repuesto-estacion-1').props.value).toBe('25');

    // Persistir manualmente y verificar en SQLite
    const botonGuardar = testRuntime.getByTestId('boton-guardar-borrador');
    await (botonGuardar.props.onPress as () => Promise<void>)();

    const enDisco = await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID);
    expect(enDisco?.datosDrt?.planillaEstaciones[0].consumoGramos).toBe(15);
    expect(enDisco?.datosDrt?.planillaEstaciones[0].repuestoGramos).toBe(25);
  });

  it('tras finalizarServicioDrt, el timer debounced (2.5s) y el botón atrás NO resucitan el borrador (F2)', async () => {
    await prepararBorradorActivo();
    const onVolver = vi.fn();

    testRuntime.render(FormularioDrtScreen, { onVolver });

    // Editar campos arma el timer debounced de 2.5s
    completarConformidadCliente();

    // Finalizar ANTES de que venza el timer de 2.5s
    const botonFinalizar = testRuntime.getByTestId('boton-finalizar-drt');
    await (botonFinalizar.props.onPress as () => Promise<void>)();

    expect(rnTools.alertMock).toHaveBeenCalledTimes(1);
    const botonesConfirmacion = rnTools.alertMock.mock.calls[0][2] as AlertButtonLike[];
    const botonConfirmar = botonesConfirmacion.find((b) => b.text === 'Concluir y Encolar');
    expect(botonConfirmar?.onPress).toBeDefined();

    await botonConfirmar!.onPress!();
    await flushMicrotasks();

    // Confirmar que se mostró el Alert de éxito pero el usuario aún NO pulsó OK
    expect(rnTools.alertMock).toHaveBeenCalledTimes(2);
    expect(rnTools.alertMock.mock.calls[1][0]).toBe('Servicio Registrado con Éxito');
    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(
      await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID),
    ).toBeNull();

    // 1) Avanzar 5 segundos (más allá del debounce de 2.5s) mientras la pantalla sigue montada
    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(
      await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID),
    ).toBeNull();

    // 2) Pulsar botón ← VOLVER y botón atrás de hardware en Android mientras sigue abierta la alerta
    const botonVolver = testRuntime.getByTestId('boton-volver-drt');
    await (botonVolver.props.onPress as () => Promise<void>)();
    rnTools.triggerHardwareBack();
    await flushMicrotasks();

    expect(onVolver).toHaveBeenCalledTimes(2);
    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(
      await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID),
    ).toBeNull();

    // Solo existe 1 operación válida en sync_outbox (sin duplicados)
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes).toHaveLength(1);
    expect(OperacionSyncSchema.safeParse(pendientes[0].operacion).success).toBe(true);
  });

  it('impide finalizar si no existe usuario autenticado con UUID válido en vez de usar fallback "tecnico-local-01" (F5)', async () => {
    await prepararBorradorActivo();
    useAuthStore.setState({ usuario: null });
    const onVolver = vi.fn();

    testRuntime.render(FormularioDrtScreen, { onVolver });
    completarConformidadCliente();

    const botonFinalizar = testRuntime.getByTestId('boton-finalizar-drt');
    await (botonFinalizar.props.onPress as () => Promise<void>)();

    expect(rnTools.alertMock).toHaveBeenCalledTimes(1);
    expect(rnTools.alertMock.mock.calls[0][0]).toBe('Sesión de Técnico Requerida');

    const outbox = new OutboxQueue();
    await outbox.inicializar();
    expect(outbox.obtenerPendientes()).toHaveLength(0);
    expect(useBorradorStore.getState().borrador?.servicioId).toBe(SERVICIO_UUID);
  });

  it('flujo completo desde visita semilla de agenda hasta finalizar y encolar OperacionSync válida (F3, F5)', async () => {
    await useAgendaStore.getState().cargarAgenda(TECNICO_UUID);
    const primeraVisita = useAgendaStore.getState().items[0];
    const iniciada = await useAgendaStore.getState().iniciarAtencionVisita(primeraVisita.id);
    expect(iniciada).toBe(true);

    const onVolver = vi.fn();
    testRuntime.render(FormularioDrtScreen, { onVolver });
    completarConformidadCliente();

    const botonFinalizar = testRuntime.getByTestId('boton-finalizar-drt');
    await (botonFinalizar.props.onPress as () => Promise<void>)();

    expect(rnTools.alertMock).toHaveBeenCalledTimes(1);
    expect(rnTools.alertMock.mock.calls[0][0]).toBe('Finalizar y Encolar Servicio');

    const botones = rnTools.alertMock.mock.calls[0][2] as AlertButtonLike[];
    await botones.find((b) => b.text === 'Concluir y Encolar')!.onPress!();
    await flushMicrotasks();

    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes).toHaveLength(1);
    expect(OperacionSyncSchema.safeParse(pendientes[0].operacion).success).toBe(true);
    expect(pendientes[0].operacion.agregadoId).toBe(primeraVisita.servicioId);
    expect(pendientes[0].operacion.actorId).toBe(TECNICO_UUID);
  });
});
