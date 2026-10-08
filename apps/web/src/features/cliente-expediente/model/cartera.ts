import { CLIENTES_MOCK, type ClienteFila } from './clientes-mock';
import { PROYECTOS_MOCK } from './expediente-mock';
import type { ProyectoExpediente } from './proyecto-mapper';

/**
 * Clientes y sedes de ejemplo que todavía usan la programación, el tablero y el mapa murino.
 * La cartera real, con sus sedes y servicios, viene del API (`useClientes`, `useSedes`).
 */
export interface CarteraEstado {
  clientes: ClienteFila[];
}

export function estadoInicialCartera(): CarteraEstado {
  return { clientes: CLIENTES_MOCK };
}

/** Los clientes de ejemplo comparten las sedes de muestra; cualquier otro (los del API) no las tiene aquí. */
export function esClienteDeEjemplo(estado: CarteraEstado, clienteId: string): boolean {
  return estado.clientes.some((c) => c.id === clienteId);
}

export function esClienteNuevo(estado: CarteraEstado, clienteId: string): boolean {
  return !esClienteDeEjemplo(estado, clienteId);
}

export function proyectosDe(estado: CarteraEstado, clienteId: string): ProyectoExpediente[] {
  return esClienteDeEjemplo(estado, clienteId) ? PROYECTOS_MOCK : [];
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
