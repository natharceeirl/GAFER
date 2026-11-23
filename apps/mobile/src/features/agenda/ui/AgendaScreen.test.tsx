import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperacionSyncSchema } from '@gafer/contracts';
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
import { MobileApiClient, ErrorDeConexion } from '../../../shared/api/api-client';
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

  it('espera a persistir el borrador antes de montar FormularioCampoScreen con los datos reales de la visita (F1, F2, F5)', async () => {
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

      // Mientras SQLite aún no confirmó el borrador, FormularioCampoScreen NO debe montarse
      expect(testRuntime.queryByTestId('boton-cerrar-inspeccion')).toBeNull();
      expect(testRuntime.queryByTestId('boton-finalizar-drt')).toBeNull();

      // Ahora sí termina la persistencia en SQLite
      resolverInicio(true);
      await promesaClick;
      await flushMicrotasks();

      // FormularioCampoScreen se montó con los datos reales de la visita y botón Planilla DRT habilitado
      expect(testRuntime.queryByTestId('boton-cerrar-inspeccion')).not.toBeNull();
      expect(testRuntime.queryByTestId('boton-abrir-planilla-drt')).not.toBeNull();
      const texto = testRuntime.getTextContent();
      expect(texto).toContain(visita.clienteRazonSocial);
      expect(texto).toContain(visita.sedeNombre);
      expect(texto).toContain('DemoRaticida Bloque B');
      expect(useBorradorStore.getState().borrador?.servicioId).toBe(visita.servicioId);
      expect(
        OperacionSyncSchema.shape.agregadoId.safeParse(
          useBorradorStore.getState().borrador?.servicioId,
        ).success,
      ).toBe(true);
    } finally {
      useAgendaStore.setState({ iniciarAtencionVisita: iniciarOriginal });
    }
  });

  it('si falla la persistencia en SQLite (GAF-33), NO abre FormularioCampoScreen y muestra el error en AgendaScreen (F1)', async () => {
    testRuntime.render(AgendaScreen);
    await flushMicrotasks();

    const visita = useAgendaStore.getState().items[0];
    await cerrarBaseDeDatos();

    const botonIniciar = testRuntime.getByTestId(`boton-atender-${visita.id}`);
    await (botonIniciar.props.onPress as () => Promise<void>)();
    await flushMicrotasks();

    expect(testRuntime.queryByTestId('boton-cerrar-inspeccion')).toBeNull();
    expect(testRuntime.queryByTestId('boton-finalizar-drt')).toBeNull();
    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(useBorradorStore.getState().errorPersistencia).not.toBeNull();
    expect(testRuntime.getTextContent()).toContain('No se pudo guardar en el almacenamiento');
  });

  it('espera iniciarAtencionEnSede y abre FormularioCampoScreen con servicioId UUID válido y sin exigir certificado (F1, F3, F5)', async () => {
    testRuntime.render(AgendaScreen);
    await flushMicrotasks();

    // Cambiar a la pestaña SEDES
    const tabSedes = testRuntime.findAll(
      (n) => n.type === 'TouchableOpacity' && testRuntime.getTextContent(n).includes('SEDES'),
    )[0];
    (tabSedes.props.onPress as () => void)();
    await flushMicrotasks();

    const sede = useAgendaStore.getState().sedesActivas[1]; // CD_LURIN
    const botonSede = testRuntime.getByTestId(`boton-sede-${sede.id}`);
    await (botonSede.props.onPress as () => Promise<void>)();
    await flushMicrotasks();

    expect(testRuntime.queryByTestId('boton-cerrar-inspeccion')).not.toBeNull();
    // Contingencia no exige bloque de certificado por defecto
    expect(testRuntime.queryByTestId('input-certificado-numero')).toBeNull();
    const borrador = useBorradorStore.getState().borrador;
    expect(borrador?.clienteRazonSocial).toBe(sede.clienteRazonSocial);
    expect(borrador?.sedeNombre).toBe(sede.nombre);
    expect(OperacionSyncSchema.shape.agregadoId.safeParse(borrador?.servicioId).success).toBe(true);
  });

  it('al alternar entre FormularioCampoScreen y FormularioDrtScreen en el mismo servicio preserva ambos borradores (F1)', async () => {
    testRuntime.render(AgendaScreen);
    await flushMicrotasks();

    const visita = useAgendaStore.getState().items[0];
    await (testRuntime.getByTestId(`boton-atender-${visita.id}`).props.onPress as () => Promise<void>)();
    await flushMicrotasks();

    // Editar observación en FormularioCampoScreen
    const inputObs = testRuntime.getByTestId('input-observaciones-libre');
    (inputObs.props.onChangeText as (t: string) => void)('Observación de campo persistente');

    // Abrir Planilla DRT desde el botón integrado (debe guardar datosCampo antes de cambiar)
    await (testRuntime.getByTestId('boton-abrir-planilla-drt').props.onPress as () => Promise<void>)();
    await flushMicrotasks();

    expect(testRuntime.queryByTestId('boton-finalizar-drt')).not.toBeNull();

    // Editar conformidad en FormularioDrtScreen y volver (guarda datosDrt)
    (testRuntime.getByTestId('input-cliente-conformidad-nombre').props.onChangeText as (t: string) => void)(
      'Elena Ruiz',
    );
    await (testRuntime.getByTestId('boton-volver-drt').props.onPress as () => Promise<void>)();
    await flushMicrotasks();

    // Reabrir FormularioCampoScreen desde la placa activa
    (testRuntime.getByTestId('boton-abrir-formulario-campo').props.onPress as () => void)();
    await flushMicrotasks();

    expect(testRuntime.getByTestId('input-observaciones-libre').props.value).toBe(
      'Observación de campo persistente',
    );
    const borrador = useBorradorStore.getState().borrador;
    expect(borrador?.datosCampo?.observacionesLibre).toBe('Observación de campo persistente');
    expect(borrador?.datosDrt?.firmas.clienteConformidadNombre).toBe('Elena Ruiz');
  });

  describe('Pestaña CERRADOS (GAF-104: F1, F3, F5, F6, F7)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('cuando la API devuelve lista vacía muestra ListEmptyComponent y NO inyecta datos ficticios ALICORP/GLORIA (F1)', async () => {
      vi.spyOn(MobileApiClient.prototype, 'obtenerMisServicios').mockResolvedValue([]);

      testRuntime.render(AgendaScreen);
      await flushMicrotasks();

      const tabCerrados = testRuntime.getByTestId('tab-cerrados');
      (tabCerrados.props.onPress as () => void)();
      await flushMicrotasks();

      const texto = testRuntime.getTextContent();
      expect(texto).toContain('Sin servicios cerrados');
      expect(texto).not.toContain('GAFER-2026-ALICORP-001');
      expect(texto).not.toContain('GAFER-2026-GLORIA-004');
    });

    it('cuando la API falla muestra error real con opción de reintentar y NO inyecta datos ficticios (F1)', async () => {
      vi.spyOn(MobileApiClient.prototype, 'obtenerMisServicios').mockRejectedValue(
        new ErrorDeConexion('Sin conexión al servidor de operaciones'),
      );

      testRuntime.render(AgendaScreen);
      await flushMicrotasks();

      const tabCerrados = testRuntime.getByTestId('tab-cerrados');
      (tabCerrados.props.onPress as () => void)();
      await flushMicrotasks();

      const texto = testRuntime.getTextContent();
      expect(texto).toContain('Sin conexión al servidor de operaciones');
      expect(testRuntime.queryByTestId('boton-reintentar-cerrados')).not.toBeNull();
      expect(texto).not.toContain('GAFER-2026-ALICORP-001');
      expect(texto).not.toContain('GAFER-2026-GLORIA-004');
    });

    it('muestra metadatos reales, respeta puedeSolicitarCorreccion y diferencia Ver Reporte vs Pedir Corrección (F3, F5, F6)', async () => {
      const idCerrado = 'c1111111-2222-4000-8000-000000000011';
      const idObservado = 'c1111111-2222-4000-8000-000000000012';
      vi.spyOn(MobileApiClient.prototype, 'obtenerMisServicios').mockResolvedValue([
        {
          id: idCerrado,
          servicioId: 'd1111111-1111-4000-8000-000000000011',
          codigoInspeccion: 'GAFER-2026-KALLPA-099',
          estado: 'CERRADO',
          versionSync: 2,
          fechaEjecucion: '2026-11-03',
          horaInicio: '09:00',
          horaFin: '11:30',
          tecnicosParticipantes: [{ id: TECNICO_UUID, nombre: 'Juan Perez' }],
          puedeSolicitarCorreccion: true,
          clienteRazonSocial: 'KALLPA GENERACIÓN S.A.',
          sedeNombre: 'CENTRAL_CHILCA',
          servicioTipo: 'DSF',
          snapshotCatalogos: {
            insumos: [{ nombreHistorico: 'Amonio Cuaternario', lote: 'L-99' }],
          },
        },
        {
          id: idObservado,
          servicioId: 'd1111111-1111-4000-8000-000000000012',
          codigoInspeccion: 'GAFER-2026-OBS-001',
          estado: 'OBSERVADO',
          versionSync: 2,
          fechaEjecucion: '2026-11-02',
          horaInicio: null,
          horaFin: null,
          tecnicosParticipantes: [{ id: TECNICO_UUID, nombre: 'Juan Perez' }],
          puedeSolicitarCorreccion: false,
          clienteRazonSocial: 'MINERA SUR S.A.',
          sedeNombre: 'CAMPAMENTO_NORTE',
          servicioTipo: 'LRA',
        },
      ]);

      testRuntime.render(AgendaScreen);
      await flushMicrotasks();

      (testRuntime.getByTestId('tab-cerrados').props.onPress as () => void)();
      await flushMicrotasks();

      const texto = testRuntime.getTextContent();
      expect(texto).toContain('KALLPA GENERACIÓN S.A.');
      expect(texto).toContain('CENTRAL_CHILCA');
      expect(texto).toContain('Desinfección (DSF)');
      expect(texto).toContain('OBSERVADO');
      expect(testRuntime.queryByTestId(`boton-pedir-correccion-${idCerrado}`)).not.toBeNull();
      expect(testRuntime.queryByTestId(`boton-pedir-correccion-${idObservado}`)).toBeNull();

      // 1) Ver Reporte abre el modal SIN formulario de corrección abierto
      (testRuntime.getByTestId(`boton-ver-reporte-${idCerrado}`).props.onPress as () => void)();
      await flushMicrotasks();
      expect(testRuntime.queryByTestId('formulario-correccion')).toBeNull();
      expect(testRuntime.getTextContent()).toContain('Amonio Cuaternario');

      // Cerrar modal
      (testRuntime.getByTestId('boton-cerrar-modal-detalle').props.onPress as () => void)();
      await flushMicrotasks();

      // 2) Pedir Corrección abre el modal CON el formulario de corrección ya desplegado
      (testRuntime.getByTestId(`boton-pedir-correccion-${idCerrado}`).props.onPress as () => void)();
      await flushMicrotasks();
      expect(testRuntime.queryByTestId('formulario-correccion')).not.toBeNull();
      expect(testRuntime.queryByTestId('input-motivo-correccion')).not.toBeNull();
    });
  });
});
