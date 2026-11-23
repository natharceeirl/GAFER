import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperacionSyncSchema, PayloadEstacionSyncSchema } from '@gafer/contracts';
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
    expect(enDisco?.datosDrt?.planillaEstaciones[0].cantidadReposicion).toBe(25);
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

    // Encola exactamente 5 REGISTRO_ESTACION + 1 REGISTRO_SERVICIO_DRT válidas (sin duplicados)
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes).toHaveLength(6);
    expect(pendientes.filter((p) => p.operacion.tipo === 'REGISTRO_ESTACION')).toHaveLength(5);
    expect(pendientes.filter((p) => p.operacion.tipo === 'REGISTRO_SERVICIO_DRT')).toHaveLength(1);
    for (const p of pendientes) {
      expect(OperacionSyncSchema.safeParse(p.operacion).success).toBe(true);
      if (p.operacion.tipo === 'REGISTRO_ESTACION') {
        expect(PayloadEstacionSyncSchema.safeParse(p.operacion.payload).success).toBe(true);
      }
    }
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
    expect(pendientes).toHaveLength(6);
    expect(pendientes.filter((p) => p.operacion.tipo === 'REGISTRO_ESTACION')).toHaveLength(5);
    expect(pendientes.filter((p) => p.operacion.tipo === 'REGISTRO_SERVICIO_DRT')).toHaveLength(1);
    for (const p of pendientes) {
      expect(OperacionSyncSchema.safeParse(p.operacion).success).toBe(true);
      expect(p.operacion.agregadoId).toBe(primeraVisita.servicioId);
      expect(p.operacion.actorId).toBe(TECNICO_UUID);
      if (p.operacion.tipo === 'REGISTRO_ESTACION') {
        expect(PayloadEstacionSyncSchema.safeParse(p.operacion.payload).success).toBe(true);
      }
    }
  });

  it('editar Gramos Base actualiza consumoGramos, repuestoGramos y cantidadReposicion en UI y sync (PR35-F1)', async () => {
    await prepararBorradorActivo();
    const onVolver = vi.fn();

    testRuntime.render(FormularioDrtScreen, { onVolver });
    completarConformidadCliente();

    // Estación #1: marcar CON_CONSUMO y seleccionar 50% (base 20g -> consumo 10g, reposición 10g)
    (testRuntime.getByTestId('chip-estacion-1-CON_CONSUMO').props.onPress as () => void)();
    (testRuntime.getByTestId('chip-porcentaje-estacion-1-50').props.onPress as () => void)();

    expect(testRuntime.getByTestId('input-consumo-estacion-1').props.value).toBe('10');
    expect(testRuntime.getByTestId('input-repuesto-estacion-1').props.value).toBe('10');

    // Corregir Gramos Base a 40g -> consumo 20g y reposición 20g tanto en UI como en sync
    (testRuntime.getByTestId('input-gramos-base-estacion-1').props.onChangeText as (t: string) => void)('40');

    expect(testRuntime.getByTestId('input-consumo-estacion-1').props.value).toBe('20');
    expect(testRuntime.getByTestId('input-repuesto-estacion-1').props.value).toBe('20');

    // Finalizar y comprobar payload sincronizado
    await (testRuntime.getByTestId('boton-finalizar-drt').props.onPress as () => Promise<void>)();
    const botones = rnTools.alertMock.mock.calls[0][2] as AlertButtonLike[];
    await botones.find((b) => b.text === 'Concluir y Encolar')!.onPress!();
    await flushMicrotasks();

    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const opEst1 = outbox
      .obtenerPendientes()
      .find(
        (p) =>
          p.operacion.tipo === 'REGISTRO_ESTACION' &&
          (p.operacion.payload as Record<string, unknown>).numeroEstacion === 1,
      );
    expect(opEst1).toBeDefined();
    expect(opEst1?.operacion.payload.consumoGramos).toBe(20);
    expect(opEst1?.operacion.payload.cantidadReposicion).toBe(20);
  });

  it('mantiene coherencia entre estado de estación y consumo (CON_CONSUMO abre porcentajes >0%, SIN_ACCESO limpia consumo) (PR35-F2)', async () => {
    await prepararBorradorActivo();
    const onVolver = vi.fn();

    testRuntime.render(FormularioDrtScreen, { onVolver });

    // Tocar CON_CONSUMO abre porcentajes (25..100, sin 0%) y marca huboConsumo=true
    (testRuntime.getByTestId('chip-estacion-1-CON_CONSUMO').props.onPress as () => void)();
    expect(testRuntime.queryByTestId('chip-porcentaje-estacion-1-0')).toBeNull();
    expect(testRuntime.getByTestId('chip-porcentaje-estacion-1-50')).toBeDefined();

    // Seleccionar 50% (10g)
    (testRuntime.getByTestId('chip-porcentaje-estacion-1-50').props.onPress as () => void)();
    expect(testRuntime.getByTestId('input-consumo-estacion-1').props.value).toBe('10');

    // Cambiar a SIN_ACCESO debe limpiar huboConsumo y cerrar controles de consumo
    (testRuntime.getByTestId('chip-estacion-1-SIN_ACCESO').props.onPress as () => void)();
    expect(testRuntime.queryByTestId('input-consumo-estacion-1')).toBeNull();

    // Guardar borrador y verificar que no quedó consumo residual
    await (testRuntime.getByTestId('boton-guardar-borrador').props.onPress as () => Promise<void>)();
    const enDisco = await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID);
    expect(enDisco?.datosDrt?.planillaEstaciones[0].estado).toBe('SIN_ACCESO');
    expect(enDisco?.datosDrt?.planillaEstaciones[0].huboConsumo).toBe(false);
    expect(enDisco?.datosDrt?.planillaEstaciones[0].porcentajeConsumo).toBe(0);
    expect(enDisco?.datosDrt?.planillaEstaciones[0].consumoGramos).toBe(0);
    expect(enDisco?.datosDrt?.planillaEstaciones[0].cantidadReposicion).toBe(0);
  });

  it('activar Primera Visita preserva tipoCebo y cantidadGramos personalizados de las estaciones (PR35-F4)', async () => {
    await prepararBorradorActivo();
    const onVolver = vi.fn();

    testRuntime.render(FormularioDrtScreen, { onVolver });

    // Personalizar Estación #1 a PASTA y 40g
    (testRuntime.getByTestId('input-tipo-cebo-estacion-1').props.onChangeText as (t: string) => void)('PASTA');
    (testRuntime.getByTestId('input-gramos-base-estacion-1').props.onChangeText as (t: string) => void)('40');

    // Alternar Primera Visita (Instalación)
    (testRuntime.getByTestId('chip-primera-visita-true').props.onPress as () => void)();

    expect(testRuntime.getByTestId('input-tipo-cebo-estacion-1').props.value).toBe('PASTA');
    expect(testRuntime.getByTestId('input-gramos-base-estacion-1').props.value).toBe('40');

    // Guardar borrador y verificar persistencia
    await (testRuntime.getByTestId('boton-guardar-borrador').props.onPress as () => Promise<void>)();
    const enDisco = await new BorradorRepository().obtenerPorServicioId(SERVICIO_UUID, TECNICO_UUID);
    expect(enDisco?.datosDrt?.primeraVisita).toBe(true);
    expect(enDisco?.datosDrt?.planillaEstaciones[0].esInstalacion).toBe(true);
    expect(enDisco?.datosDrt?.planillaEstaciones[0].tipoCebo).toBe('PASTA');
    expect(enDisco?.datosDrt?.planillaEstaciones[0].cantidadGramos).toBe(40);
  });
});
