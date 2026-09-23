import { CLIENTES_MOCK, type ClienteFila } from './clientes-mock';
import { PROYECTOS_MOCK, type ProyectoExpediente, type ServicioContratado } from './expediente-mock';
import { etiquetaTipoServicio } from './catalogos-servicio';
import type { DatosCliente, DatosProyecto, DatosServicio } from './validaciones';

/**
 * Datos maestros CLIENTE → PROYECTO → SERVICIO (§7). Los clientes de
 * ejemplo comparten PROYECTOS_MOCK; un cliente dado de alta arranca sin sedes.
 */
export interface CarteraEstado {
  clientes: ClienteFila[];
  proyectosPorCliente: Record<string, ProyectoExpediente[]>;
  clientesNuevos: string[];
}

export function estadoInicialCartera(): CarteraEstado {
  return { clientes: CLIENTES_MOCK, proyectosPorCliente: {}, clientesNuevos: [] };
}

export function esClienteNuevo(estado: CarteraEstado, clienteId: string): boolean {
  return estado.clientesNuevos.includes(clienteId);
}

export function proyectosDe(estado: CarteraEstado, clienteId: string): ProyectoExpediente[] {
  return estado.proyectosPorCliente[clienteId] ?? (esClienteNuevo(estado, clienteId) ? [] : PROYECTOS_MOCK);
}

export function agregarCliente(estado: CarteraEstado, d: DatosCliente): { estado: CarteraEstado; clienteId: string } {
  const clienteId = `nuevo-${d.codigoCorto}`;
  const cliente: ClienteFila = {
    id: clienteId,
    codigoCorto: d.codigoCorto,
    razonSocial: d.razonSocial.trim(),
    ruc: d.ruc,
    giro: d.giro,
    ultimoServicio: null,
    proximoVencimiento: null,
    estado: d.estado,
  };
  return {
    clienteId,
    estado: {
      clientes: [...estado.clientes, cliente],
      proyectosPorCliente: { ...estado.proyectosPorCliente, [clienteId]: [] },
      clientesNuevos: [...estado.clientesNuevos, clienteId],
    },
  };
}

export function agregarProyecto(
  estado: CarteraEstado,
  clienteId: string,
  d: DatosProyecto,
): { estado: CarteraEstado; proyectoId: string } {
  const proyectoId = `${clienteId}-${d.nombre}`;
  const proyecto: ProyectoExpediente = {
    id: proyectoId,
    nombre: d.nombre,
    direccion: d.direccion.trim(),
    distrito: d.distrito.trim(),
    estado: d.estado,
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
      tipoId,
      tipo: etiquetaTipoServicio(tipoId),
      frecuencia: d.frecuencia,
      requiereCertificado: d.requiereCertificado === true,
      insumos: d.insumos,
      dosis: d.dosis,
      equipos: d.equipos,
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
