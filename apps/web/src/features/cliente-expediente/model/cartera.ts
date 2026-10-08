import { CLIENTES_MOCK, type ClienteFila } from './clientes-mock';
import { PROYECTOS_MOCK } from './expediente-mock';
import type { ProyectoExpediente } from './proyecto-mapper';
import type { ServicioContratado } from './servicio-mapper';
import type { DatosProyecto, DatosServicio } from './validaciones';

/**
 * Sedes y servicios en memoria (todavía sin API) de CLIENTE → PROYECTO → SERVICIO (§7).
 * Los clientes de ejemplo comparten PROYECTOS_MOCK; un cliente del API arranca sin sedes.
 */
export interface CarteraEstado {
  /** Clientes de ejemplo que aún usan las demás pantallas de la maqueta; la cartera real viene del API (`useClientes`). */
  clientes: ClienteFila[];
  proyectosPorCliente: Record<string, ProyectoExpediente[]>;
}

export function estadoInicialCartera(): CarteraEstado {
  return { clientes: CLIENTES_MOCK, proyectosPorCliente: {} };
}

/** Los clientes de ejemplo comparten las sedes de muestra; cualquier otro (los del API) arranca sin sedes. */
export function esClienteDeEjemplo(estado: CarteraEstado, clienteId: string): boolean {
  return estado.clientes.some((c) => c.id === clienteId);
}

export function esClienteNuevo(estado: CarteraEstado, clienteId: string): boolean {
  return !esClienteDeEjemplo(estado, clienteId);
}

export function proyectosDe(estado: CarteraEstado, clienteId: string): ProyectoExpediente[] {
  return estado.proyectosPorCliente[clienteId] ?? (esClienteDeEjemplo(estado, clienteId) ? PROYECTOS_MOCK : []);
}

export function agregarProyecto(
  estado: CarteraEstado,
  clienteId: string,
  d: DatosProyecto,
): { estado: CarteraEstado; proyectoId: string } {
  const proyectoId = `${clienteId}-${d.nombre}`;
  const proyecto: ProyectoExpediente = {
    id: proyectoId,
    clienteId,
    nombre: d.nombre,
    direccion: d.direccion.trim(),
    distrito: d.distrito.trim(),
    provincia: d.provincia.trim(),
    departamento: d.departamento.trim(),
    contactoNombre: d.contactoNombre.trim(),
    contactoCargo: d.contactoCargo.trim(),
    contactoTelefono: d.contactoTelefono.trim(),
    observaciones: d.observaciones.trim(),
    estado: 'ACTIVO',
    servicios: [],
  };
  return {
    proyectoId,
    estado: {
      ...estado,
      proyectosPorCliente: { ...estado.proyectosPorCliente, [clienteId]: [...proyectosDe(estado, clienteId), proyecto] },
    },
  };
}

export function agregarServicio(estado: CarteraEstado, clienteId: string, proyectoId: string, d: DatosServicio): CarteraEstado {
  if (d.tipo === '') return estado;
  const tipoId = d.tipo;
  const actualizados = proyectosDe(estado, clienteId).map((p) => {
    if (p.id !== proyectoId) return p;
    const servicio: ServicioContratado = {
      id: `${proyectoId}-${tipoId}-${p.servicios.length + 1}`,
      proyectoId,
      tipoServicio: tipoId,
      frecuencia: d.frecuencia as ServicioContratado['frecuencia'],
      areaTotalM2: Number(d.areaTotal),
      areaTratarM2: Number(d.areaTratar),
      insumosAutorizados: d.insumos,
      equiposAutorizados: d.equipos,
      dosisReferencial: d.dosis,
      requiereCertificado: d.requiereCertificado === true,
      vigenciaDias: d.requiereCertificado === true ? Number(d.vigenciaDias) : null,
      estado: 'ACTIVO',
    };
    return { ...p, servicios: [...p.servicios, servicio] };
  });
  return { ...estado, proyectosPorCliente: { ...estado.proyectosPorCliente, [clienteId]: actualizados } };
}

/** Sedes activas de clientes activos: el técnico puede atender cualquiera (§3, §8.2). */
export function sedesActivas(estado: CarteraEstado): Array<{ cliente: ClienteFila; proyecto: ProyectoExpediente }> {
  return estado.clientes
    .filter((c) => c.estado === 'ACTIVO')
    .flatMap((cliente) =>
      proyectosDe(estado, cliente.id)
        .filter((p) => p.estado === 'ACTIVO')
        .map((proyecto) => ({ cliente, proyecto })),
    );
}
