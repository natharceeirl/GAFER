import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActaServicioDrt, OperacionSyncSchema } from '@gafer/contracts';
import { useBorradorStore, MENSAJE_ERROR_PERSISTENCIA } from './use-borrador-store';
import { BorradorRepository } from './borrador-repository';
import { crearFormularioCampo, FormularioCampo } from './formulario-campo';
import { inicializarBaseDeDatos, cerrarBaseDeDatos } from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';

function reiniciarStore() {
  useBorradorStore.setState({ borrador: null, colaEnvioPendiente: false, errorPersistencia: null });
}

describe('useBorradorStore (Mobile)', () => {
  beforeEach(async () => {
    await cerrarBaseDeDatos();
    await inicializarBaseDeDatos();
    reiniciarStore();
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
    reiniciarStore();
  });

  it('inicia un borrador con servicioId y cola en false', async () => {
    const ok = await useBorradorStore.getState().iniciarBorrador('srv-123');
    const state = useBorradorStore.getState();
    expect(ok).toBe(true);
    expect(state.borrador?.servicioId).toBe('srv-123');
    expect(state.colaEnvioPendiente).toBe(false);
  });

  it('actualiza observaciones del borrador activo', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-123');
    const ok = await useBorradorStore.getState().actualizarObservaciones('Sin novedad en cebadero 1');
    expect(ok).toBe(true);
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Sin novedad en cebadero 1');
  });

  it('almacena metadatos legibles (cliente, sede, orden, servicio) en el borrador', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-123', {
      clienteRazonSocial: 'ALICORP S.A.A.',
      sedeNombre: 'PLANTA_CALLAO',
      numeroOrden: 'ORD-2026-001',
      servicioTipo: 'DESINSECTACION',
    });
    const borrador = useBorradorStore.getState().borrador;
    expect(borrador?.clienteRazonSocial).toBe('ALICORP S.A.A.');
    expect(borrador?.sedeNombre).toBe('PLANTA_CALLAO');
    expect(borrador?.numeroOrden).toBe('ORD-2026-001');
    expect(borrador?.servicioTipo).toBe('DESINSECTACION');
  });

  it('al reabrir la visita conserva las notas ya escritas (hallazgo 1 del PR #29)', async () => {
    const store = useBorradorStore.getState();
    await store.iniciarBorrador('srv-reabrir', { usuarioId: 'tec-A' }, 'Nota de la programación');
    await useBorradorStore.getState().actualizarObservaciones('Notas del técnico en campo');

    // La app se cierra y el técnico vuelve a tocar la visita.
    reiniciarStore();
    await useBorradorStore
      .getState()
      .iniciarBorrador('srv-reabrir', { usuarioId: 'tec-A' }, 'Nota de la programación');

    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Notas del técnico en campo');
    const enDisco = await new BorradorRepository().obtenerPorServicioId('srv-reabrir', 'tec-A');
    expect(enDisco?.observaciones).toBe('Notas del técnico en campo');
  });

  it('si SQLite no está disponible no muestra datos y expone el error (hallazgo 3 del PR #29)', async () => {
    await cerrarBaseDeDatos();

    const ok = await useBorradorStore.getState().iniciarBorrador('srv-sin-db');

    expect(ok).toBe(false);
    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(useBorradorStore.getState().errorPersistencia).toContain(MENSAJE_ERROR_PERSISTENCIA);
  });

  it('si falla el guardado de observaciones la pantalla conserva el último valor guardado', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-falla', undefined, 'Guardado');
    await cerrarBaseDeDatos();

    const ok = await useBorradorStore.getState().actualizarObservaciones('No llegó al disco');

    expect(ok).toBe(false);
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Guardado');
    expect(useBorradorStore.getState().errorPersistencia).not.toBeNull();
  });

  it('descargarDeMemoria quita el borrador de la pantalla pero lo deja en disco', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-sesion', { usuarioId: 'tec-A' });

    useBorradorStore.getState().descargarDeMemoria();

    expect(useBorradorStore.getState().borrador).toBeNull();
    const enDisco = await new BorradorRepository().obtenerPorServicioId('srv-sesion', 'tec-A');
    expect(enDisco).not.toBeNull();
  });

  it('limpiar elimina el borrador del disco y de la pantalla', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-fin');

    await useBorradorStore.getState().limpiar();

    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(await new BorradorRepository().obtenerPorServicioId('srv-fin')).toBeNull();
  });


  it('actualiza y almacena el formulario del Acta DRT (GAF-103)', async () => {
    const acta: ActaServicioDrt = {
      servicioId: 'f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
      clienteRazonSocial: 'BACKUS & JOHNSTON',
      sedeDireccion: 'Planta Ate',
      fecha: '2026-11-03',
      horaInicio: '08:00',
      horaTermino: '10:00',
      actividad: 'MONITOREO',
      tipoCebo: 'BLOQUE_5G',
      cebosInstalados: 20,
      cebosConsumidos: 5,
      cebosRepuestos: 5,
      tipoTrampa: 'MECANICA',
      trampasInstaladas: 10,
      trampasActivadas: 1,
      roedoresDetectados: ['MUS_MUSCULUS'],
      resultadosRecomendaciones: 'Monitoreo mensual sin incidencias críticas.',
      observacionesCliente: 'Conforme.',
      firmas: {
        personalResponsableNombre: 'Carlos Prado',
        personalResponsableCargo: 'Técnico Especialista',
        clienteConformidadNombre: 'Ana Rivas',
        clienteConformidadCargo: 'Jefa de Calidad',
        fecha: '2026-11-03',
        responsableNoDisponible: false,
      },
      planillaEstaciones: [
        { numero: 1, estado: 'SIN_ACTIVIDAD' },
        { numero: 2, estado: 'CON_CONSUMO', consumoGramos: 5, repuestoGramos: 5 },
      ],
      fotos: [],
    };

    await useBorradorStore.getState().iniciarBorrador(acta.servicioId, { usuarioId: 'tec-drt' });
    const ok = await useBorradorStore.getState().actualizarDrt(acta);
    expect(ok).toBe(true);
    const estado = useBorradorStore.getState();
    expect(estado.borrador?.servicioId).toBe(acta.servicioId);
    expect(estado.borrador?.datosDrt?.tipoCebo).toBe('BLOQUE_5G');
    expect(estado.borrador?.datosDrt?.planillaEstaciones.length).toBe(2);
    // El upsert del acta conserva al dueño del borrador (hallazgo 5 del PR #29).
    expect(estado.borrador?.usuarioId).toBe('tec-drt');
  });

  it('actualiza y almacena el formulario de campo por bloques (GAF-34)', async () => {
    const f: FormularioCampo = crearFormularioCampo({
      cliente: { razonSocial: 'SAN FERNANDO S.A.' },
      sede: { nombre: 'PLANTA_CHORRILLOS' },
      servicio: {
        id: 'srv-sanfernando-01',
        tipo: 'DESINSECTACION Y DESRATIZACION',
        tipoServicio: 'DSS',
        requiereCertificado: false,
      },
      tecnicoNombre: 'Marco Ipusari',
    });

    f.observacionesLibre = 'Aplicación focalizada en almacén 3.';

    const ok = await useBorradorStore.getState().actualizarCampo(f);
    expect(ok).toBe(true);
    const estado = useBorradorStore.getState();
    expect(estado.borrador?.servicioId).toBe('srv-sanfernando-01');
    expect(estado.borrador?.clienteRazonSocial).toBe('SAN FERNANDO S.A.');
    expect(estado.borrador?.datosCampo?.tipoServicio).toBe('DSS');
    expect(estado.borrador?.datosCampo?.insumos.length).toBeGreaterThan(0);
    expect(estado.borrador?.observaciones).toBe('Aplicación focalizada en almacén 3.');
  });

  it('actualizarCampo conserva usuarioId activo y expone errorPersistencia si SQLite falla (F3, F8)', async () => {
    const servicioUuid = 'd5555555-5555-4000-8000-000000000005';
    const usuarioUuid = '33333333-3333-4000-8000-000000000005';
    await useBorradorStore.getState().iniciarBorrador(servicioUuid, { usuarioId: usuarioUuid });

    const f = crearFormularioCampo({
      cliente: { razonSocial: 'SAN FERNANDO S.A.' },
      sede: { nombre: 'PLANTA_CHORRILLOS' },
      servicio: { id: servicioUuid, tipo: 'DESINFECCION AMBIENTAL', requiereCertificado: false },
      tecnicoNombre: 'Marco Ipusari',
    });
    f.observacionesLibre = 'Guardado ok';

    const ok1 = await useBorradorStore.getState().actualizarCampo(f);
    expect(ok1).toBe(true);
    expect(useBorradorStore.getState().borrador?.usuarioId).toBe(usuarioUuid);

    // Simular fallo de SQLite
    await cerrarBaseDeDatos();
    const ok2 = await useBorradorStore
      .getState()
      .actualizarCampo({ ...f, observacionesLibre: 'No guardado' });
    expect(ok2).toBe(false);
    expect(useBorradorStore.getState().errorPersistencia).toContain(MENSAJE_ERROR_PERSISTENCIA);
    expect(useBorradorStore.getState().borrador?.datosCampo?.observacionesLibre).toBe('Guardado ok');
  });

  it('una restauración tardía no sobrescribe un borrador iniciado después (F3)', async () => {
    let resolverLectura!: (valor: { servicioId: string; usuarioId: string; observaciones: string } | null) => void;
    const lecturaPendiente = new Promise<{
      servicioId: string;
      usuarioId: string;
      observaciones: string;
    } | null>((resolve) => {
      resolverLectura = resolve;
    });

    const restauracionEnCurso = useBorradorStore
      .getState()
      .restaurarActivoDeUsuario('tec-A', { obtenerActivo: () => lecturaPendiente });

    // Antes de que resuelva la lectura previa, el técnico inicia otra visita.
    await useBorradorStore
      .getState()
      .iniciarBorrador('srv-nuevo', { usuarioId: 'tec-A' }, 'Trabajo recién iniciado');

    // Ahora llega la respuesta obsoleta de SQLite.
    resolverLectura({
      servicioId: 'srv-viejo',
      usuarioId: 'tec-A',
      observaciones: 'Borrador antiguo',
    });
    await restauracionEnCurso;

    expect(useBorradorStore.getState().borrador?.servicioId).toBe('srv-nuevo');
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Trabajo recién iniciado');
  });

  it('dos técnicos pueden trabajar y limpiar el mismo servicioId sin afectar al otro (F2)', async () => {
    await useBorradorStore
      .getState()
      .iniciarBorrador('srv-compartido', { usuarioId: 'tec-A' }, 'Notas A');
    useBorradorStore.getState().descargarDeMemoria();

    await useBorradorStore
      .getState()
      .iniciarBorrador('srv-compartido', { usuarioId: 'tec-B' }, 'Notas B');
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Notas B');
    await useBorradorStore.getState().limpiar();

    const restauradoA = await useBorradorStore.getState().restaurarActivoDeUsuario('tec-A');
    expect(restauradoA?.observaciones).toBe('Notas A');
    expect(restauradoA?.usuarioId).toBe('tec-A');
  });

  describe('finalizarServicioDrt (F2, F5, F6)', () => {
    const usuarioUuid = '33333333-3333-4000-8000-000000000001';
    const actaValida: ActaServicioDrt = {
      servicioId: 'd1111111-1111-4000-8000-000000000001',
      clienteRazonSocial: 'ALICORP S.A.A.',
      sedeDireccion: 'PLANTA_CALLAO',
      fecha: '2026-11-03',
      areaTratadaM2: 500,
      horaInicio: '08:30',
      horaTermino: '11:00',
      actividad: 'MONITOREO',
      tipoCebo: 'BLOQUE_10G',
      cebosInstalados: 20,
      cebosConsumidos: 2,
      cebosRepuestos: 3,
      tipoTrampa: 'MECANICA',
      trampasInstaladas: 5,
      trampasActivadas: 1,
      roedoresDetectados: ['MUS_MUSCULUS'],
      resultadosRecomendaciones: 'Sin novedad crítica.',
      observacionesCliente: 'Conforme.',
      firmas: {
        personalResponsableNombre: 'Juan Perez',
        personalResponsableCargo: 'Técnico',
        clienteConformidadNombre: 'Maria Lopez',
        clienteConformidadCargo: 'Jefa de Planta',
        fecha: '2026-11-03',
      },
      planillaEstaciones: [
        { numero: 1, estado: 'CON_CONSUMO', consumoGramos: 10, repuestoGramos: 20 },
      ],
    };

    it('finaliza el servicio DRT, encola OperacionSync válida y limpia el borrador en memoria y disco', async () => {
      await useBorradorStore
        .getState()
        .iniciarBorrador(actaValida.servicioId, { usuarioId: usuarioUuid });
      await useBorradorStore.getState().actualizarDrt(actaValida);

      const res = await useBorradorStore.getState().finalizarServicioDrt(actaValida, usuarioUuid);

      expect(res.operationId).toBeDefined();
      const state = useBorradorStore.getState();
      expect(state.borrador).toBeNull();
      expect(state.colaEnvioPendiente).toBe(true);
      expect(
        await new BorradorRepository().obtenerPorServicioId(actaValida.servicioId, usuarioUuid),
      ).toBeNull();

      const outbox = new OutboxQueue();
      await outbox.inicializar();
      const pendientes = outbox.obtenerPendientes();
      expect(pendientes).toHaveLength(1);
      expect(OperacionSyncSchema.safeParse(pendientes[0].operacion).success).toBe(true);
      expect(pendientes[0].operacion.operationId).toBe(res.operationId);
      expect(pendientes[0].operacion.actorId).toBe(usuarioUuid);
    });

    it('rechaza finalizarServicioDrt con actorId no-UUID sin borrar el borrador ni encolar', async () => {
      await useBorradorStore
        .getState()
        .iniciarBorrador(actaValida.servicioId, { usuarioId: 'tecnico-local-01' });

      await expect(
        useBorradorStore.getState().finalizarServicioDrt(actaValida, 'tecnico-local-01'),
      ).rejects.toThrow();

      expect(useBorradorStore.getState().borrador?.servicioId).toBe(actaValida.servicioId);
      const outbox = new OutboxQueue();
      await outbox.inicializar();
      expect(outbox.obtenerPendientes()).toHaveLength(0);
    });

    it('un actualizarDrt en vuelo que resuelve tras finalizarServicioDrt no resucita el borrador en el store', async () => {
      await useBorradorStore
        .getState()
        .iniciarBorrador(actaValida.servicioId, { usuarioId: usuarioUuid });

      let liberarGuardarDrt!: () => void;
      const esperaGuardar = new Promise<void>((resolve) => {
        liberarGuardarDrt = resolve;
      });
      const guardarOriginal = BorradorRepository.prototype.guardarDrt;
      const spyGuardar = vi
        .spyOn(BorradorRepository.prototype, 'guardarDrt')
        .mockImplementationOnce(async function (this: BorradorRepository, a, m) {
          const resultado = await guardarOriginal.call(this, a, m);
          await esperaGuardar;
          return resultado;
        });

      const autoGuardadoEnVuelo = useBorradorStore.getState().actualizarDrt(actaValida);
      await Promise.resolve();

      await useBorradorStore.getState().finalizarServicioDrt(actaValida, usuarioUuid);
      expect(useBorradorStore.getState().borrador).toBeNull();

      liberarGuardarDrt();
      await autoGuardadoEnVuelo;
      spyGuardar.mockRestore();

      expect(useBorradorStore.getState().borrador).toBeNull();
    });
  });

  describe('finalizarServicioCampo (F3, F6, F8)', () => {
    const usuarioUuid = '33333333-3333-4000-8000-000000000010';
    const servicioUuid = 'd6666666-6666-4000-8000-000000000010';

    function crearCampoValido(): FormularioCampo {
      const f = crearFormularioCampo({
        cliente: { razonSocial: 'GLORIA S.A.' },
        sede: { nombre: 'PLANTA_HUACHIPA' },
        servicio: {
          id: servicioUuid,
          tipo: 'DESINFECCION AMBIENTAL',
          requiereCertificado: false,
        },
        tecnicoNombre: 'Juan Perez',
        tecnicoId: usuarioUuid,
      });
      f.insumos[0].lote = 'L-STORE-01';
      f.insumos[0].vencimiento = '2027-12-31';
      f.insumos[0].cantidad = '12';
      f.insumos[0].zonas = 'Almacén central';
      f.temperatura = '21';
      f.humedad = '62';
      f.viento = '8';
      f.estadoGeneral = 'Bueno';
      f.nivelInfestacion = 'Nulo';
      f.responsableNoDisponible = true;
      return f;
    }

    it('finaliza el servicio de campo, encola OperacionSync válida y limpia memoria y disco', async () => {
      const campo = crearCampoValido();
      await useBorradorStore.getState().iniciarBorrador(servicioUuid, { usuarioId: usuarioUuid });
      await useBorradorStore.getState().actualizarCampo(campo);

      const res = await useBorradorStore.getState().finalizarServicioCampo(campo, usuarioUuid);

      expect(res.operationId).toBeDefined();
      const state = useBorradorStore.getState();
      expect(state.borrador).toBeNull();
      expect(state.colaEnvioPendiente).toBe(true);
      expect(state.errorPersistencia).toBeNull();
      expect(
        await new BorradorRepository().obtenerPorServicioId(servicioUuid, usuarioUuid),
      ).toBeNull();

      const outbox = new OutboxQueue();
      await outbox.inicializar();
      const pendientes = outbox.obtenerPendientes();
      expect(pendientes).toHaveLength(1);
      expect(OperacionSyncSchema.safeParse(pendientes[0].operacion).success).toBe(true);
      expect(pendientes[0].operacion.tipo).toBe('REGISTRO_SERVICIO_CAMPO');
      expect(pendientes[0].operacion.agregadoId).toBe(servicioUuid);
      expect(pendientes[0].operacion.actorId).toBe(usuarioUuid);
    });

    it('rechaza finalizarServicioCampo con actorId no-UUID sin borrar el borrador ni encolar (F6)', async () => {
      const campo = crearCampoValido();
      await useBorradorStore
        .getState()
        .iniciarBorrador(servicioUuid, { usuarioId: 'tecnico-operador-local' });

      await expect(
        useBorradorStore.getState().finalizarServicioCampo(campo, 'tecnico-operador-local'),
      ).rejects.toThrow();

      expect(useBorradorStore.getState().borrador?.servicioId).toBe(servicioUuid);
      const outbox = new OutboxQueue();
      await outbox.inicializar();
      expect(outbox.obtenerPendientes()).toHaveLength(0);
    });

    it('un actualizarCampo en vuelo que resuelve tras finalizarServicioCampo no resucita el borrador (F3)', async () => {
      const campo = crearCampoValido();
      await useBorradorStore.getState().iniciarBorrador(servicioUuid, { usuarioId: usuarioUuid });

      let liberarGuardarCampo!: () => void;
      const esperaGuardar = new Promise<void>((resolve) => {
        liberarGuardarCampo = resolve;
      });
      const guardarOriginal = BorradorRepository.prototype.guardarCampo;
      const spyGuardar = vi
        .spyOn(BorradorRepository.prototype, 'guardarCampo')
        .mockImplementationOnce(async function (this: BorradorRepository, f, m) {
          const resultado = await guardarOriginal.call(this, f, m);
          await esperaGuardar;
          return resultado;
        });

      const autoGuardadoEnVuelo = useBorradorStore.getState().actualizarCampo(campo);
      await Promise.resolve();

      await useBorradorStore.getState().finalizarServicioCampo(campo, usuarioUuid);
      expect(useBorradorStore.getState().borrador).toBeNull();

      liberarGuardarCampo();
      await autoGuardadoEnVuelo;
      spyGuardar.mockRestore();

      expect(useBorradorStore.getState().borrador).toBeNull();
    });
  });
});
