import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { inicializarBaseDeDatos, cerrarBaseDeDatos } from '../../../shared/db/sqlite';
import { BorradorRepository } from '../../operaciones/model/borrador-repository';
import {
  clasificarPrioridadVisita,
  ordenarAgendaPorHora,
  filtrarAgendaPorTecnico,
  filtrarSedesActivas,
  useAgendaStore,
  ItemAgenda,
  SedeActiva,
} from './agenda';
import { useBorradorStore } from '../../operaciones/model/use-borrador-store';

describe('Agenda de Campo (Decisión C12 / Spec §8.1)', () => {
  const tecnicoId = 'tec-1234-uuid';

  const visitaTitular: ItemAgenda = {
    id: 'visita-1',
    fecha: '2026-10-11',
    hora: '09:00',
    clienteId: 'cli-1',
    clienteRazonSocial: 'ALICORP',
    proyectoId: 'proy-1',
    sedeNombre: 'PLANTA_CALLAO',
    sedeDireccion: 'Av. Argentina 4793',
    servicioId: 'srv-1',
    servicioTipo: 'DESINSECTACION',
    tecnicoTitularId: tecnicoId,
    observaciones: 'Revisión periódica',
    estadoCampo: 'PENDIENTE',
  };

  const visitaAbierta: ItemAgenda = {
    id: 'visita-2',
    fecha: '2026-10-11',
    hora: '14:00',
    clienteId: 'cli-2',
    clienteRazonSocial: 'GLORIA',
    proyectoId: 'proy-2',
    sedeNombre: 'PLANTA_HUACHIPA',
    sedeDireccion: 'Km 8.5',
    servicioId: 'srv-2',
    servicioTipo: 'DESINFECCION',
    tecnicoTitularId: null, // Sin titular asignado (Decisión C12)
    observaciones: 'Disponible para cualquier técnico',
    estadoCampo: 'PENDIENTE',
  };

  const visitaOtroTecnico: ItemAgenda = {
    id: 'visita-3',
    fecha: '2026-10-11',
    hora: '08:00',
    clienteId: 'cli-3',
    clienteRazonSocial: 'NESTLE',
    proyectoId: 'proy-3',
    sedeNombre: 'SEDE_CENTRAL',
    sedeDireccion: 'Av. Libertadores',
    servicioId: 'srv-3',
    servicioTipo: 'DESRATIZACION',
    tecnicoTitularId: 'otro-tec-uuid',
    observaciones: 'Asignada a otro técnico',
    estadoCampo: 'PENDIENTE',
  };

  const listaVisitas: ItemAgenda[] = [visitaTitular, visitaAbierta, visitaOtroTecnico];

  beforeEach(async () => {
    await cerrarBaseDeDatos();
    await inicializarBaseDeDatos();
    useAgendaStore.getState().reiniciarEstado();
    useBorradorStore.setState({ borrador: null, colaEnvioPendiente: false, errorPersistencia: null });
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
  });

  describe('clasificarPrioridadVisita', () => {
    it('clasifica como ASIGNADA si el técnico actual es el titular', () => {
      expect(clasificarPrioridadVisita(visitaTitular, tecnicoId)).toBe('ASIGNADA');
    });

    it('clasifica como ABIERTA si no tiene técnico titular asignado (C12)', () => {
      expect(clasificarPrioridadVisita(visitaAbierta, tecnicoId)).toBe('ABIERTA');
    });

    it('clasifica como OTRO_TECNICO si tiene a otro colega asignado', () => {
      expect(clasificarPrioridadVisita(visitaOtroTecnico, tecnicoId)).toBe('OTRO_TECNICO');
    });
  });

  describe('ordenarAgendaPorHora', () => {
    it('ordena las visitas de forma ascendente según la hora', () => {
      const ordenadas = ordenarAgendaPorHora(listaVisitas);
      expect(ordenadas[0].hora).toBe('08:00');
      expect(ordenadas[1].hora).toBe('09:00');
      expect(ordenadas[2].hora).toBe('14:00');
    });
  });

  describe('filtrarAgendaPorTecnico', () => {
    it('filtra sólo mis visitas cuando el modo es MIS_VISITAS', () => {
      const resultado = filtrarAgendaPorTecnico(listaVisitas, tecnicoId, 'MIS_VISITAS');
      expect(resultado).toHaveLength(1);
      expect(resultado[0].id).toBe('visita-1');
    });

    it('filtra sólo visitas abiertas disponibles cuando el modo es DISPONIBLES', () => {
      const resultado = filtrarAgendaPorTecnico(listaVisitas, tecnicoId, 'DISPONIBLES');
      expect(resultado).toHaveLength(1);
      expect(resultado[0].id).toBe('visita-2');
    });

    it('devuelve todas las visitas cuando el modo es TODAS', () => {
      const resultado = filtrarAgendaPorTecnico(listaVisitas, tecnicoId, 'TODAS');
      expect(resultado).toHaveLength(3);
    });
  });

  describe('filtrarSedesActivas', () => {
    const sedes: SedeActiva[] = [
      {
        id: 's-1',
        clienteId: 'c-1',
        clienteRazonSocial: 'ALICORP S.A.A.',
        nombre: 'PLANTA_CALLAO',
        direccionSede: 'Av. Argentina',
        distrito: 'Callao',
        estado: 'ACTIVO',
      },
      {
        id: 's-2',
        clienteId: 'c-2',
        clienteRazonSocial: 'GRUPO GLORIA S.A.',
        nombre: 'PLANTA_HUACHIPA',
        direccionSede: 'Prialé',
        distrito: 'Lurigancho',
        estado: 'ACTIVO',
      },
      {
        id: 's-3',
        clienteId: 'c-3',
        clienteRazonSocial: 'SEDE CLAUSURADA',
        nombre: 'SEDE_INACTIVA',
        direccionSede: 'Av. Lima',
        distrito: 'Lima',
        estado: 'INACTIVO',
      },
    ];

    it('excluye sedes inactivas por defecto', () => {
      const resultado = filtrarSedesActivas(sedes, '');
      expect(resultado).toHaveLength(2);
      expect(resultado.some((s) => s.estado === 'INACTIVO')).toBe(false);
    });

    it('filtra sedes por coincidencia en razón social del cliente', () => {
      const resultado = filtrarSedesActivas(sedes, 'gloria');
      expect(resultado).toHaveLength(1);
      expect(resultado[0].nombre).toBe('PLANTA_HUACHIPA');
    });

    it('filtra sedes por nombre de la sede física', () => {
      const resultado = filtrarSedesActivas(sedes, 'callao');
      expect(resultado).toHaveLength(1);
      expect(resultado[0].clienteRazonSocial).toBe('ALICORP S.A.A.');
    });
  });

  describe('useAgendaStore', () => {
    it('carga la agenda y la ordena cronológicamente', async () => {
      const store = useAgendaStore.getState();
      await store.cargarAgenda(tecnicoId);

      const items = useAgendaStore.getState().items;
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].hora <= items[1].hora).toBe(true);
    });

    it('iniciarAtencionVisita cambia estado a EN_CURSO y vincula con useBorradorStore', async () => {
      const store = useAgendaStore.getState();
      await store.cargarAgenda(tecnicoId);

      const primeraVisita = useAgendaStore.getState().items[0];
      const exito = await store.iniciarAtencionVisita(primeraVisita.id);

      expect(exito).toBe(true);
      expect(useAgendaStore.getState().visitaSeleccionada?.estadoCampo).toBe('EN_CURSO');

      const borrador = useBorradorStore.getState().borrador;
      expect(borrador).not.toBeNull();
      expect(borrador?.servicioId).toBe(primeraVisita.servicioId);
      expect(borrador?.usuarioId).toBe(tecnicoId);
      expect(borrador?.observaciones).toBe(primeraVisita.observaciones);
    });

    it('reabrir una visita tras cerrar la app conserva las notas del técnico (hallazgos 1 y 2 del PR #29)', async () => {
      await useAgendaStore.getState().cargarAgenda(tecnicoId);
      const visita = useAgendaStore.getState().items[0];

      await useAgendaStore.getState().iniciarAtencionVisita(visita.id);
      await useBorradorStore.getState().actualizarObservaciones('Cebadero 4 con consumo total');

      // Cierre de la app: se pierde la memoria, queda SQLite.
      useBorradorStore.setState({ borrador: null });
      useAgendaStore.getState().reiniciarEstado();
      const restaurado = await new BorradorRepository().obtenerActivo(tecnicoId);
      useBorradorStore.getState().restaurarBorrador(restaurado);
      await useAgendaStore.getState().cargarAgenda(tecnicoId);

      // El técnico vuelve a tocar la visita para seguir.
      await useAgendaStore.getState().iniciarAtencionVisita(visita.id);

      expect(useBorradorStore.getState().borrador?.observaciones).toBe(
        'Cebadero 4 con consumo total',
      );
      const enDisco = await new BorradorRepository().obtenerPorServicioId(visita.servicioId);
      expect(enDisco?.observaciones).toBe('Cebadero 4 con consumo total');
    });

    it('si el borrador no se guarda en disco la visita no pasa a EN_CURSO', async () => {
      await useAgendaStore.getState().cargarAgenda(tecnicoId);
      const visita = useAgendaStore.getState().items[0];
      await cerrarBaseDeDatos();

      const exito = await useAgendaStore.getState().iniciarAtencionVisita(visita.id);

      expect(exito).toBe(false);
      expect(useAgendaStore.getState().visitaSeleccionada).toBeNull();
      expect(useBorradorStore.getState().errorPersistencia).not.toBeNull();
    });

    it('iniciarAtencionEnSede activa una sede y genera borrador para contingencia', async () => {
      const store = useAgendaStore.getState();
      const sede = store.sedesActivas[0];

      const exito = await store.iniciarAtencionEnSede(sede);

      expect(exito).toBe(true);
      expect(useAgendaStore.getState().sedeSeleccionada?.id).toBe(sede.id);
      const borrador = useBorradorStore.getState().borrador;
      expect(borrador).not.toBeNull();
      expect(borrador?.servicioId).toContain('contingencia-');
    });
  });
});
