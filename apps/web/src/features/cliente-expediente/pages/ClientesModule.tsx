import { useState } from 'react';
import { ClientesListPage } from './ClientesListPage';
import { ClienteExpedientePage } from './ClienteExpedientePage';
import { NuevoClientePage } from './NuevoClientePage';
import { NuevoProyectoPage } from './NuevoProyectoPage';
import { NuevoServicioPage } from './NuevoServicioPage';
import { useCartera } from '../model/cartera-context';
import { agregarCliente, agregarProyecto, agregarServicio, esClienteNuevo, proyectosDe } from '../model/cartera';
import type { DatosCliente, DatosProyecto, DatosServicio } from '../model/validaciones';
import { CATALOGOS_TEXTO_MOCK, EQUIPOS_MOCK, INSUMOS_MOCK } from '../../mantenimiento/model/mantenimiento-mock';
import { useAuditoria } from '../../auditoria/model/auditoria-context';
import type { Rol } from '../../auth/model/roles';
import { ahora } from '../../../shared/lib/fecha';

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'nuevo-cliente' }
  | { tipo: 'expediente'; clienteId: string; aviso: string | null }
  | { tipo: 'nuevo-proyecto'; clienteId: string }
  | { tipo: 'nuevo-servicio'; clienteId: string; proyectoId: string };

interface ClientesModuleProps {
  usuario: string;
  rol: Rol;
}

const GIROS = CATALOGOS_TEXTO_MOCK.find((c) => c.id === 'giros')?.items ?? [];

/** Jerarquía CLIENTE → PROYECTO (sede) → SERVICIO (§7), sobre la cartera compartida de la app. */
export function ClientesModule({ usuario, rol }: ClientesModuleProps) {
  const { cartera, setCartera } = useCartera();
  const { registrar } = useAuditoria();
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  /** Solo el Administrador da de alta clientes, sedes y servicios (§12, decisión C1). */
  const puedeDarDeAlta = rol === 'ADMINISTRADOR';

  function registrarCliente(d: DatosCliente) {
    const { estado, clienteId } = agregarCliente(cartera, d);
    setCartera(() => estado);
    const fechaHora = ahora();
    registrar({
      id: `${fechaHora}-alta-${d.codigoCorto}`,
      fechaHora,
      usuario,
      rol,
      accion: 'Alta de cliente',
      referencia: d.codigoCorto,
      detalle: `${d.razonSocial.trim()} · RUC ${d.ruc}`,
    });
    setVista({ tipo: 'expediente', clienteId, aviso: `Cliente ${d.codigoCorto} registrado. El siguiente paso es registrar su primera sede.` });
  }

  function registrarProyecto(clienteId: string, d: DatosProyecto) {
    const { estado } = agregarProyecto(cartera, clienteId, d);
    setCartera(() => estado);
    setVista({ tipo: 'expediente', clienteId, aviso: `Sede ${d.nombre} registrada. Ya puede agregarle servicios.` });
  }

  function registrarServicio(clienteId: string, proyectoId: string, nombreSede: string, d: DatosServicio) {
    setCartera(() => agregarServicio(cartera, clienteId, proyectoId, d));
    setVista({ tipo: 'expediente', clienteId, aviso: `Servicio ${d.tipo} (${d.frecuencia.toLowerCase()}) registrado en ${nombreSede}.` });
  }

  const clienteDe = (id: string) => cartera.clientes.find((c) => c.id === id);

  if (vista.tipo === 'nuevo-cliente' && puedeDarDeAlta) {
    return (
      <NuevoClientePage
        giros={GIROS}
        codigosExistentes={cartera.clientes.map((c) => c.codigoCorto)}
        rucsExistentes={cartera.clientes.map((c) => c.ruc)}
        onRegistrar={registrarCliente}
        onCancelar={() => setVista({ tipo: 'lista' })}
      />
    );
  }

  if (vista.tipo === 'nuevo-proyecto' && puedeDarDeAlta) {
    const cliente = clienteDe(vista.clienteId);
    if (cliente) {
      return (
        <NuevoProyectoPage
          cliente={cliente}
          nombresExistentes={proyectosDe(cartera, cliente.id).map((p) => p.nombre)}
          onRegistrar={(d) => registrarProyecto(cliente.id, d)}
          onCancelar={() => setVista({ tipo: 'expediente', clienteId: cliente.id, aviso: null })}
        />
      );
    }
  }

  if (vista.tipo === 'nuevo-servicio' && puedeDarDeAlta) {
    const cliente = clienteDe(vista.clienteId);
    const proyecto = cliente ? proyectosDe(cartera, cliente.id).find((p) => p.id === vista.proyectoId) : undefined;
    if (cliente && proyecto) {
      return (
        <NuevoServicioPage
          cliente={cliente}
          proyecto={proyecto}
          insumos={INSUMOS_MOCK}
          equipos={EQUIPOS_MOCK}
          onRegistrar={(d) => registrarServicio(cliente.id, proyecto.id, proyecto.nombre, d)}
          onCancelar={() => setVista({ tipo: 'expediente', clienteId: cliente.id, aviso: null })}
        />
      );
    }
  }

  if (vista.tipo !== 'lista' && vista.tipo !== 'nuevo-cliente') {
    const cliente = clienteDe(vista.clienteId);
    if (cliente) {
      return (
        <ClienteExpedientePage
          cliente={cliente}
          proyectos={proyectosDe(cartera, cliente.id)}
          sinHistorial={esClienteNuevo(cartera, cliente.id)}
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
      clientes={cartera.clientes}
      onAbrirCliente={(c) => setVista({ tipo: 'expediente', clienteId: c.id, aviso: null })}
      puedeCrearCliente={puedeDarDeAlta}
      onNuevoCliente={() => setVista({ tipo: 'nuevo-cliente' })}
    />
  );
}
