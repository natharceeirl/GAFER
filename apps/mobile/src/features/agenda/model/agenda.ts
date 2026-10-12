import { create } from 'zustand';
import { VisitaProgramada, EstadoCampo } from '@gafer/contracts';
import { useBorradorStore } from '../../operaciones/model/use-borrador-store';

export type ModoFiltroAgenda = 'MIS_VISITAS' | 'TODAS' | 'DISPONIBLES';
export type TipoPrioridadVisita = 'ASIGNADA' | 'ABIERTA' | 'OTRO_TECNICO';

export interface ItemAgenda extends VisitaProgramada {
  clienteRazonSocial: string;
  sedeNombre: string;
  sedeDireccion: string;
  servicioTipo: string;
  tecnicoTitularNombre?: string | null;
  numeroOrden?: string;
}

export interface SedeActiva {
  id: string;
  clienteId: string;
  clienteRazonSocial: string;
  nombre: string;
  direccionSede: string;
  distrito: string;
  estado: 'ACTIVO' | 'INACTIVO';
}

/**
 * Clasifica la relación de la visita respecto al técnico actual (Decisión C12 / Spec §8.1).
 * - ASIGNADA: El técnico actual es el titular explícito.
 * - ABIERTA: La visita no tiene técnico titular asignado (disponible para cualquier técnico).
 * - OTRO_TECNICO: La visita tiene asignado a otro titular (colaboración/contingencia).
 */
export function clasificarPrioridadVisita(
  item: Pick<ItemAgenda, 'tecnicoTitularId'>,
  tecnicoId: string,
): TipoPrioridadVisita {
  if (!item.tecnicoTitularId) {
    return 'ABIERTA';
  }
  return item.tecnicoTitularId === tecnicoId ? 'ASIGNADA' : 'OTRO_TECNICO';
}

/**
 * Ordena las visitas cronológicamente por hora (HH:mm).
 */
export function ordenarAgendaPorHora(items: ItemAgenda[]): ItemAgenda[] {
  return [...items].sort((a, b) => a.hora.localeCompare(b.hora));
}

/**
 * Filtra los elementos de la agenda según la vista seleccionada por el técnico.
 */
export function filtrarAgendaPorTecnico(
  items: ItemAgenda[],
  tecnicoId: string,
  modo: ModoFiltroAgenda,
): ItemAgenda[] {
  switch (modo) {
    case 'MIS_VISITAS':
      return items.filter((item) => item.tecnicoTitularId === tecnicoId);
    case 'DISPONIBLES':
      return items.filter((item) => item.tecnicoTitularId === null);
    case 'TODAS':
    default:
      return items;
  }
}

/**
 * Filtra la lista de sedes activas por texto de búsqueda (nombre, razón social o distrito).
 */
export function filtrarSedesActivas(
  sedes: SedeActiva[],
  busqueda: string,
): SedeActiva[] {
  const termino = busqueda.trim().toLowerCase();
  if (!termino) {
    return sedes.filter((s) => s.estado === 'ACTIVO');
  }

  return sedes.filter(
    (s) =>
      s.estado === 'ACTIVO' &&
      (s.nombre.toLowerCase().includes(termino) ||
        s.clienteRazonSocial.toLowerCase().includes(termino) ||
        s.distrito.toLowerCase().includes(termino) ||
        s.direccionSede.toLowerCase().includes(termino)),
  );
}

// Catálogo base de sedes y agenda demostrativa para contingencias y trabajo offline (§8.2)
export const SEDES_ACTIVAS_SEMILLA: SedeActiva[] = [
  {
    id: 'b1a2c3d4-0001-4000-8000-000000000001',
    clienteId: 'c1a2c3d4-0001-4000-8000-000000000001',
    clienteRazonSocial: 'ALICORP S.A.A.',
    nombre: 'PLANTA_CALLAO',
    direccionSede: 'Av. Argentina 4793',
    distrito: 'Carmen de la Legua Reynoso',
    estado: 'ACTIVO',
  },
  {
    id: 'b1a2c3d4-0002-4000-8000-000000000002',
    clienteId: 'c1a2c3d4-0001-4000-8000-000000000001',
    clienteRazonSocial: 'ALICORP S.A.A.',
    nombre: 'CD_LURIN',
    direccionSede: 'Km 38.5 Panamericana Sur',
    distrito: 'Lurín',
    estado: 'ACTIVO',
  },
  {
    id: 'b1a2c3d4-0003-4000-8000-000000000003',
    clienteId: 'c1a2c3d4-0002-4000-8000-000000000002',
    clienteRazonSocial: 'GRUPO GLORIA S.A.',
    nombre: 'PLANTA_HUACHIPA',
    direccionSede: 'Autopista Ramiro Prialé Km 8.5',
    distrito: 'Lurigancho',
    estado: 'ACTIVO',
  },
  {
    id: 'b1a2c3d4-0004-4000-8000-000000000004',
    clienteId: 'c1a2c3d4-0003-4000-8000-000000000003',
    clienteRazonSocial: 'PLAZA VEA / SUPERMERCADOS PERUANOS',
    nombre: 'TIENDA_SAN_BORJA',
    direccionSede: 'Av. Javier Prado Este 2050',
    distrito: 'San Borja',
    estado: 'ACTIVO',
  },
  {
    id: 'b1a2c3d4-0005-4000-8000-000000000005',
    clienteId: 'c1a2c3d4-0004-4000-8000-000000000004',
    clienteRazonSocial: 'NESTLE PERU S.A.',
    nombre: 'SEDE_CENTRAL_LIMA',
    direccionSede: 'Av. Los Libertadores 210',
    distrito: 'San Isidro',
    estado: 'ACTIVO',
  },
];

export interface AgendaState {
  items: ItemAgenda[];
  sedesActivas: SedeActiva[];
  sedeSeleccionada: SedeActiva | null;
  visitaSeleccionada: ItemAgenda | null;
  filtroModo: ModoFiltroAgenda;
  cargando: boolean;
  error: string | null;
  fechaAgenda: string;

  setFiltroModo: (modo: ModoFiltroAgenda) => void;
  seleccionarSede: (sede: SedeActiva | null) => void;
  seleccionarVisita: (visita: ItemAgenda | null) => void;
  cargarAgenda: (tecnicoId: string) => Promise<void>;
  iniciarAtencionVisita: (visitaId: string) => boolean;
  iniciarAtencionEnSede: (sede: SedeActiva, servicioId?: string) => void;
  reiniciarEstado: () => void;
}

export const useAgendaStore = create<AgendaState>((set, get) => ({
  items: [],
  sedesActivas: SEDES_ACTIVAS_SEMILLA,
  sedeSeleccionada: null,
  visitaSeleccionada: null,
  filtroModo: 'MIS_VISITAS',
  cargando: false,
  error: null,
  fechaAgenda: new Date().toISOString().split('T')[0],

  setFiltroModo: (modo) => set({ filtroModo: modo }),

  seleccionarSede: (sede) => set({ sedeSeleccionada: sede }),

  seleccionarVisita: (visita) => set({ visitaSeleccionada: visita }),

  cargarAgenda: async (tecnicoId: string) => {
    set({ cargando: true, error: null });

    try {
      const hoy = new Date().toISOString().split('T')[0];

      // Visitas iniciales de agenda demostrando Decisión C12:
      // - Una asignada al técnico logueado
      // - Una abierta (sin técnico titular)
      // - Una asignada a otro colega (cobertura)
      const visitasSimuladas: ItemAgenda[] = [
        {
          id: 'a1111111-1111-4000-8000-000000000001',
          numeroOrden: 'ORD-2026-001',
          fecha: hoy,
          hora: '08:30',
          clienteId: 'c1a2c3d4-0001-4000-8000-000000000001',
          clienteRazonSocial: 'ALICORP S.A.A.',
          proyectoId: 'b1a2c3d4-0001-4000-8000-000000000001',
          sedeNombre: 'PLANTA_CALLAO',
          sedeDireccion: 'Av. Argentina 4793',
          servicioId: 's1111111-1111-4000-8000-000000000001',
          servicioTipo: 'DESINSECTACION Y DESRATIZACION',
          tecnicoTitularId: tecnicoId,
          observaciones: 'Ingreso por garita 2 con EPP completo. Revisión de estaciones cebaderas perimetrales.',
          estadoCampo: 'PENDIENTE',
        },
        {
          id: 'a2222222-2222-4000-8000-000000000002',
          numeroOrden: 'ORD-2026-002',
          fecha: hoy,
          hora: '11:15',
          clienteId: 'c1a2c3d4-0002-4000-8000-000000000002',
          clienteRazonSocial: 'GRUPO GLORIA S.A.',
          proyectoId: 'b1a2c3d4-0003-4000-8000-000000000003',
          sedeNombre: 'PLANTA_HUACHIPA',
          sedeDireccion: 'Autopista Ramiro Prialé Km 8.5',
          servicioId: 's2222222-2222-4000-8000-000000000002',
          servicioTipo: 'DESINFECCION AMBIENTAL',
          tecnicoTitularId: null, // Decisión C12: Sin titular, disponible para cualquier técnico
          observaciones: 'Visita abierta disponible. Aplicación en áreas de almacenamiento y vestuarios.',
          estadoCampo: 'PENDIENTE',
        },
        {
          id: 'a3333333-3333-4000-8000-000000000003',
          numeroOrden: 'ORD-2026-003',
          fecha: hoy,
          hora: '15:00',
          clienteId: 'c1a2c3d4-0003-4000-8000-000000000003',
          clienteRazonSocial: 'PLAZA VEA / SUPERMERCADOS PERUANOS',
          proyectoId: 'b1a2c3d4-0004-4000-8000-000000000004',
          sedeNombre: 'TIENDA_SAN_BORJA',
          sedeDireccion: 'Av. Javier Prado Este 2050',
          servicioId: 's3333333-3333-4000-8000-000000000003',
          servicioTipo: 'CONTROL DE ROEDORES (MURINO)',
          tecnicoTitularId: 'otro-tecnico-uuid-999',
          tecnicoTitularNombre: 'Carlos Paredes',
          observaciones: 'Inspección de lámparas UV y trampas de golpe en trastienda.',
          estadoCampo: 'PENDIENTE',
        },
      ];

      set({
        items: ordenarAgendaPorHora(visitasSimuladas),
        fechaAgenda: hoy,
        cargando: false,
        error: null,
      });
    } catch {
      set({
        cargando: false,
        error: 'No se pudo cargar la agenda del día',
      });
    }
  },

  iniciarAtencionVisita: (visitaId: string): boolean => {
    const { items } = get();
    const visita = items.find((v) => v.id === visitaId);
    if (!visita) return false;

    // Actualizar estado de la visita a EN_CURSO
    const actualizados = items.map((v) =>
      v.id === visitaId ? { ...v, estadoCampo: 'EN_CURSO' as EstadoCampo } : v,
    );

    // Conectar reactivamente con el borrador de inspección de campo
    useBorradorStore.getState().iniciarBorrador(visita.servicioId, {
      clienteRazonSocial: visita.clienteRazonSocial,
      sedeNombre: visita.sedeNombre,
      numeroOrden: visita.numeroOrden,
      servicioTipo: visita.servicioTipo,
    });
    if (visita.observaciones) {
      useBorradorStore.getState().actualizarObservaciones(visita.observaciones);
    }

    set({
      items: actualizados,
      visitaSeleccionada: { ...visita, estadoCampo: 'EN_CURSO' },
    });

    return true;
  },

  iniciarAtencionEnSede: (sede: SedeActiva, servicioId?: string) => {
    const idServicio = servicioId || `contingencia-${sede.id.substring(0, 8)}`;
    useBorradorStore.getState().iniciarBorrador(idServicio, {
      clienteRazonSocial: sede.clienteRazonSocial,
      sedeNombre: sede.nombre,
      numeroOrden: 'CONTINGENCIA',
      servicioTipo: 'ATENCIÓN EN SEDE ACTIVA',
    });
    set({ sedeSeleccionada: sede });
  },

  reiniciarEstado: () => {
    set({
      items: [],
      sedeSeleccionada: null,
      visitaSeleccionada: null,
      filtroModo: 'MIS_VISITAS',
      cargando: false,
      error: null,
    });
  },
}));
