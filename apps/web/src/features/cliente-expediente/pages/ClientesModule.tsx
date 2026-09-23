import { useState } from 'react';
import { ClientesListPage } from './ClientesListPage';
import { ClienteExpedientePage } from './ClienteExpedientePage';
import { NuevoClientePage } from './NuevoClientePage';
import { NuevoProyectoPage } from './NuevoProyectoPage';
import { NuevoServicioPage } from './NuevoServicioPage';
import { CLIENTES_MOCK, type ClienteFila } from '../model/clientes-mock';
import { PROYECTOS_MOCK, type ProyectoExpediente } from '../model/expediente-mock';
import { etiquetaTipoServicio } from '../model/catalogos-servicio';
import type { DatosCliente, DatosProyecto, DatosServicio } from '../model/validaciones';
import { CATALOGOS_TEXTO_MOCK, EQUIPOS_MOCK, INSUMOS_MOCK } from '../../mantenimiento/model/mantenimiento-mock';

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'nuevo-cliente' }
  | { tipo: 'expediente'; clienteId: string; aviso: string | null }
  | { tipo: 'nuevo-proyecto'; clienteId: string }
  | { tipo: 'nuevo-servicio'; clienteId: string; proyectoId: string };

interface ClientesModuleProps {
  /** Spec §12: solo el Administrador da de alta clientes, proyectos y servicios. */
  puedeDarDeAlta: boolean;
}

const GIROS = CATALOGOS_TEXTO_MOCK.find((c) => c.id === 'giros')?.items ?? [];

/**
 * Jerarquía CLIENTE → PROYECTO (sede) → SERVICIO (§7). Todo queda en
 * memoria: es un mockup, lo registrado se pierde al recargar.
 */
export function ClientesModule({ puedeDarDeAlta }: ClientesModuleProps) {
  const [clientes, setClientes] = useState<ClienteFila[]>(CLIENTES_MOCK);
  // Los clientes de ejemplo comparten PROYECTOS_MOCK; un cliente nuevo arranca sin sedes.
  const [proyectosPorCliente, setProyectosPorCliente] = useState<Record<string, ProyectoExpediente[]>>({});
  const [clientesNuevos, setClientesNuevos] = useState<Set<string>>(new Set());
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });

  function proyectosDe(clienteId: string) {
    return proyectosPorCliente[clienteId] ?? (clientesNuevos.has(clienteId) ? [] : PROYECTOS_MOCK);
  }

  function registrarCliente(d: DatosCliente) {
    const id = `nuevo-${d.codigoCorto}`;
    const nuevo: ClienteFila = {
      id,
      codigoCorto: d.codigoCorto,
      razonSocial: d.razonSocial,
      ruc: d.ruc,
      giro: d.giro,
      ultimoServicio: null,
      proximoVencimiento: null,
      estado: d.estado,
    };
    setClientes((prev) => [...prev, nuevo]);
    setClientesNuevos((prev) => new Set(prev).add(id));
    setProyectosPorCliente((prev) => ({ ...prev, [id]: [] }));
    setVista({ tipo: 'expediente', clienteId: id, aviso: `Cliente ${d.codigoCorto} registrado. El siguiente paso es registrar su primera sede.` });
  }

  function registrarProyecto(clienteId: string, d: DatosProyecto) {
    const proyecto: ProyectoExpediente = {
      id: `${clienteId}-${d.nombre}`,
      nombre: d.nombre,
      direccion: d.direccion.trim(),
      distrito: d.distrito.trim(),
      estado: d.estado,
      servicios: [],
    };
    setProyectosPorCliente((prev) => ({ ...prev, [clienteId]: [...proyectosDe(clienteId), proyecto] }));
    setVista({ tipo: 'expediente', clienteId, aviso: `Sede ${d.nombre} registrada. Ya puede agregarle servicios.` });
  }

  function registrarServicio(clienteId: string, proyectoId: string, d: DatosServicio) {
    if (d.tipo === '') return;
    const tipo = etiquetaTipoServicio(d.tipo);
    const actualizados = proyectosDe(clienteId).map((p) =>
      p.id === proyectoId
        ? { ...p, servicios: [...p.servicios, { tipo, frecuencia: d.frecuencia, requiereCertificado: d.requiereCertificado === true }] }
        : p,
    );
    const nombreSede = actualizados.find((p) => p.id === proyectoId)?.nombre ?? '';
    setProyectosPorCliente((prev) => ({ ...prev, [clienteId]: actualizados }));
    setVista({ tipo: 'expediente', clienteId, aviso: `Servicio ${d.tipo} (${d.frecuencia.toLowerCase()}) registrado en ${nombreSede}.` });
  }

  const clienteDe = (id: string) => clientes.find((c) => c.id === id);

  if (vista.tipo === 'nuevo-cliente' && puedeDarDeAlta) {
    return (
      <NuevoClientePage
        giros={GIROS}
        codigosExistentes={clientes.map((c) => c.codigoCorto)}
        rucsExistentes={clientes.map((c) => c.ruc)}
        onRegistrar={registrarCliente}
        onCancelar={() => setVista({ tipo: 'lista' })}
      />
    );
  }

  if (vista.tipo === 'nuevo-proyecto' && puedeDarDeAlta) {
    const cliente = clienteDe(vista.clienteId);
    if (cliente) {
      const volver = () => setVista({ tipo: 'expediente', clienteId: cliente.id, aviso: null });
      return (
        <NuevoProyectoPage
          cliente={cliente}
          nombresExistentes={proyectosDe(cliente.id).map((p) => p.nombre)}
          onRegistrar={(d) => registrarProyecto(cliente.id, d)}
          onCancelar={volver}
        />
      );
    }
  }

  if (vista.tipo === 'nuevo-servicio' && puedeDarDeAlta) {
    const cliente = clienteDe(vista.clienteId);
    const proyecto = cliente ? proyectosDe(cliente.id).find((p) => p.id === vista.proyectoId) : undefined;
    if (cliente && proyecto) {
      return (
        <NuevoServicioPage
          cliente={cliente}
          proyecto={proyecto}
          insumos={INSUMOS_MOCK}
          equipos={EQUIPOS_MOCK}
          onRegistrar={(d) => registrarServicio(cliente.id, proyecto.id, d)}
          onCancelar={() => setVista({ tipo: 'expediente', clienteId: cliente.id, aviso: null })}
        />
      );
    }
  }

  if (vista.tipo === 'expediente' || vista.tipo === 'nuevo-proyecto' || vista.tipo === 'nuevo-servicio') {
    const cliente = clienteDe(vista.clienteId);
    if (cliente) {
      return (
        <ClienteExpedientePage
          cliente={cliente}
          proyectos={proyectosDe(cliente.id)}
          sinHistorial={clientesNuevos.has(cliente.id)}
          puedeDarDeAlta={puedeDarDeAlta}
          aviso={vista.tipo === 'expediente' ? vista.aviso : null}
          onVolver={() => setVista({ tipo: 'lista' })}
          onNuevoProyecto={() => setVista({ tipo: 'nuevo-proyecto', clienteId: cliente.id })}
          onNuevoServicio={(proyectoId) => setVista({ tipo: 'nuevo-servicio', clienteId: cliente.id, proyectoId })}
        />
      );
    }
  }

  return (
    <ClientesListPage
      clientes={clientes}
      onAbrirCliente={(c) => setVista({ tipo: 'expediente', clienteId: c.id, aviso: null })}
      puedeCrearCliente={puedeDarDeAlta}
      onNuevoCliente={() => setVista({ tipo: 'nuevo-cliente' })}
    />
  );
}
