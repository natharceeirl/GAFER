import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActaServicioDrtSchema } from '@gafer/contracts';
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
vi.mock('zustand', () => testRuntime.createZustandMock());
vi.mock('react-native', () => rnTools.rnMock);
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: Record<string, unknown>) => ({ type: 'SafeAreaView', props }),
}));
vi.mock('expo-status-bar', () => ({
  StatusBar: (props: Record<string, unknown>) => ({ type: 'StatusBar', props }),
}));

import { inicializarBaseDeDatos, cerrarBaseDeDatos } from '../../../shared/db/sqlite';
import { useAuthStore } from '../../auth/model/use-auth-store';
import { useAgendaStore } from '../model/agenda';
import { useBorradorStore } from '../../operaciones/model/use-borrador-store';
import { AgendaScreen } from './AgendaScreen';

const TECNICO_UUID = '33333333-3333-4000-8000-000000000001';

describe('AgendaScreen (F1, F3, F6)', () => {
  beforeEach(async () => {
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
    await cerrarBaseDeDatos();
  });

  it('espera a persistir el borrador antes de montar FormularioDrtScreen con los datos reales de la visita (F1)', async () => {
    let resolverInicio!: (ok: boolean) => void;
    const iniciarOriginal = useAgendaStore.getState().iniciarAtencionVisita;
    const iniciarSpy = vi.fn((visitaId: string) => {
      return new Promise<boolean>((resolve) => {
        resolverInicio = async (ok: boolean) => {
          if (ok) {
            await iniciarOriginal(visitaId);
          }
          resolve(ok);
        };
      });
    });
    useAgendaStore.setState({ iniciarAtencionVisita: iniciarSpy });
    try {
      testRuntime.render(AgendaScreen);
      await flushMicrotasks();

      const visita = useAgendaStore.getState().items[0];
      expect(visita).toBeDefined();

      const botonIniciar = testRuntime.getByTestId(`boton-atender-${visita.id}`);
      const promesaClick = (botonIniciar.props.onPress as () => Promise<void>)();

      // Mientras SQLite aún no confirmó el borrador, FormularioDrtScreen NO debe montarse
      expect(testRuntime.queryByTestId('boton-finalizar-drt')).toBeNull();
      expect(testRuntime.getTextContent()).not.toContain('ACTA DE SERVICIO DRT');

      // Ahora sí termina la persistencia en SQLite
      resolverInicio(true);
      await promesaClick;
      await flushMicrotasks();

      // FormularioDrtScreen se montó con los datos reales de la visita (no el fallback 'Cliente Asignado')
      expect(testRuntime.getTextContent()).toContain('ACTA DE SERVICIO DRT');
      const inputCliente = testRuntime.getByTestId('input-cliente-razon-social');
      const inputSede = testRuntime.getByTestId('input-sede-direccion');
      expect(inputCliente.props.value).toBe(visita.clienteRazonSocial);
      expect(inputSede.props.value).toBe(visita.sedeNombre);
      expect(useBorradorStore.getState().borrador?.servicioId).toBe(visita.servicioId);
      expect(
        ActaServicioDrtSchema.shape.servicioId.safeParse(
          useBorradorStore.getState().borrador?.servicioId,
        ).success,
      ).toBe(true);
    } finally {
      useAgendaStore.setState({ iniciarAtencionVisita: iniciarOriginal });
    }
  });

  it('si falla la persistencia en SQLite (GAF-33), NO abre FormularioDrtScreen y muestra el error en AgendaScreen (F1)', async () => {
    testRuntime.render(AgendaScreen);
    await flushMicrotasks();

    const visita = useAgendaStore.getState().items[0];
    await cerrarBaseDeDatos();

    const botonIniciar = testRuntime.getByTestId(`boton-atender-${visita.id}`);
    await (botonIniciar.props.onPress as () => Promise<void>)();
    await flushMicrotasks();

    expect(testRuntime.queryByTestId('boton-finalizar-drt')).toBeNull();
    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(useBorradorStore.getState().errorPersistencia).not.toBeNull();
    expect(testRuntime.getTextContent()).toContain('No se pudo guardar en el almacenamiento');
  });

  it('espera iniciarAtencionEnSede y abre FormularioDrtScreen con servicioId UUID válido (F1, F3)', async () => {
    testRuntime.render(AgendaScreen);
    await flushMicrotasks();

    // Cambiar a la pestaña SEDES ACTIVAS
    const tabSedes = testRuntime.findAll(
      (n) => n.type === 'TouchableOpacity' && testRuntime.getTextContent(n).includes('SEDES ACTIVAS'),
    )[0];
    (tabSedes.props.onPress as () => void)();
    await flushMicrotasks();

    const sede = useAgendaStore.getState().sedesActivas[1]; // CD_LURIN
    const botonSede = testRuntime.getByTestId(`boton-sede-${sede.id}`);
    await (botonSede.props.onPress as () => Promise<void>)();
    await flushMicrotasks();

    expect(testRuntime.getTextContent()).toContain('ACTA DE SERVICIO DRT');
    const borrador = useBorradorStore.getState().borrador;
    expect(borrador?.clienteRazonSocial).toBe(sede.clienteRazonSocial);
    expect(borrador?.sedeNombre).toBe(sede.nombre);
    expect(ActaServicioDrtSchema.shape.servicioId.safeParse(borrador?.servicioId).success).toBe(true);
  });
});
