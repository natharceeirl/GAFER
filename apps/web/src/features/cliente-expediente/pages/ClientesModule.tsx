import { useMemo, useState } from 'react';
import { ClientesListPage } from './ClientesListPage';
import { ClienteExpedientePage } from './ClienteExpedientePage';
import { NuevoClientePage } from './NuevoClientePage';
import { NuevoProyectoPage } from './NuevoProyectoPage';
import { NuevoServicioPage } from './NuevoServicioPage';
import { useCartera } from '../model/cartera-context';
import { actualizarCliente, agregarCliente, agregarProyecto, agregarServicio, esClienteNuevo, proyectosDe } from '../model/cartera';
import type { ClienteFila } from '../model/clientes-mock';
import type { DatosCliente, DatosProyecto, DatosServicio } from '../model/validaciones';
import { CATALOGOS_TEXTO_MOCK, EQUIPOS_MOCK, INSUMOS_MOCK, PERSONAL_MOCK } from '../../mantenimiento/model/mantenimiento-mock';
import { useProgramacion } from '../../programacion/model/programacion-context';
import { vistaTecnico } from '../model/vista-tecnico';
import { generarHistorial, tiposContratadosDe } from '../../estadisticas/model/historial-mock';
import { estacionesRojoDe } from '../../mapa-murino/model/mapas-mock';
import { useAuditoria } from '../../auditoria/model/auditoria-context';
import type { AccionAuditoria } from '../../auditoria/model/evento';
import type { Rol } from '../../auth/model/roles';
import { ahora, fechaLocal } from '../../../shared/lib/fecha';

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'nuevo-cliente' }
  | { tipo: 'editar-cliente'; clienteId: string }
  | { tipo: 'expediente'; clienteId: string; aviso: string | null }
  | { tipo: 'nuevo-proyecto'; clienteId: string }
  | { tipo: 'nuevo-servicio'; clienteId: string; proyectoId: string };

interface ClientesModuleProps {
  usuario: string;
  rol: Rol;
  onAbrirMapaMurino: (clienteId: string) => void;
}

/** Técnico con el que se muestra la maqueta de la app. */
const TECNICO_DEMO = PERSONAL_MOCK.find((p) => p.cargo === 'Técnico Operador' && p.estado === 'ACTIVO')?.nombre ?? 'Técnico operador';

const GIROS = CATALOGOS_TEXTO_MOCK.find((c) => c.id === 'giros')?.items ?? [];

function datosDe(c: ClienteFila): DatosCliente {
  return {
    razonSocial: c.razonSocial,
    ruc: c.ruc,
    codigoCorto: c.codigoCorto,
    direccionFiscal: c.direccionFiscal,
    giro: c.giro,
    contactoNombre: c.contacto.nombre,
    contactoCargo: c.contacto.cargo,
    contactoTelefono: c.contacto.telefono,
    contactoCorreo: c.contacto.correo,
    estado: c.estado,
  };
}

/** Jerarquía CLIENTE → PROYECTO (sede) → SERVICIO (§7), sobre la cartera compartida de la app. */
export function ClientesModule({ usuario, rol, onAbrirMapaMurino }: ClientesModuleProps) {
  const { cartera, setCartera } = useCartera();
  const { registrar } = useAuditoria();
  const { visitas } = useProgramacion();
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const hoy = fechaLocal();
  const historial = useMemo(() => generarHistorial(hoy), [hoy]);
  const estacionesRojo = useMemo(() => estacionesRojoDe(historial, cartera.clientes), [historial, cartera.clientes]);
  /** Solo el Administrador da de alta clientes, sedes y servicios (§12, decisión C1). */
  const puedeDarDeAlta = rol === 'ADMINISTRADOR';

  function auditar(accion: AccionAuditoria, referencia: string, detalle: string) {
    const fechaHora = ahora();
    registrar({ id: `${fechaHora}-${accion}-${referencia}`, fechaHora, usuario, rol, accion, referencia, detalle });
  }

  function registrarCliente(d: DatosCliente, anticipacion: number) {
    const { estado, clienteId } = agregarCliente(cartera, d, anticipacion);
    setCartera(() => estado);
    auditar('Alta de cliente', d.codigoCorto, `${d.razonSocial.trim()} · RUC ${d.ruc}`);
    setVista({ tipo: 'expediente', clienteId, aviso: `Cliente ${d.codigoCorto} registrado. El siguiente paso es registrar su primera sede.` });
  }

  function guardarFicha(cliente: ClienteFila, d: DatosCliente, anticipacion: number) {
    setCartera(() => actualizarCliente(cartera, cliente.id, d, anticipacion));
    auditar('Edición de ficha de cliente', cliente.codigoCorto, d.razonSocial.trim());
    setVista({ tipo: 'expediente', clienteId: cliente.id, aviso: 'Ficha del cliente actualizada.' });
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

  if (vista.tipo === 'editar-cliente' && puedeDarDeAlta) {
    const cliente = clienteDe(vista.clienteId);
    if (cliente) {
      const otros = cartera.clientes.filter((c) => c.id !== cliente.id);
      return (
        <NuevoClientePage
          giros={GIROS}
          codigosExistentes={otros.map((c) => c.codigoCorto)}
          rucsExistentes={otros.map((c) => c.ruc)}
          inicial={datosDe(cliente)}
          anticipacionInicial={cliente.anticipacionAlertaDias}
          onRegistrar={(d, anticipacion) => guardarFicha(cliente, d, anticipacion)}
          onCancelar={() => setVista({ tipo: 'expediente', clienteId: cliente.id, aviso: null })}
        />
      );
    }
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
      const proyectos = proyectosDe(cartera, cliente.id);
      /** Los clientes de ejemplo comparten sedes de muestra: su contrato real sale del historial. */
      const contrataDesratizacion = esClienteNuevo(cartera, cliente.id)
        ? proyectos.some((p) => p.servicios.some((s) => s.tipoId === 'DRT'))
        : tiposContratadosDe(cliente.codigoCorto).includes('DRT');
      return (
        <ClienteExpedientePage
          cliente={cliente}
          proyectos={proyectos}
          historial={historial}
          hoy={hoy}
          programaRoedores={
            contrataDesratizacion ? { estacionesRojo: estacionesRojo.filter((e) => e.cliente === cliente.codigoCorto) } : null
          }
          vistaApp={{
            tecnico: TECNICO_DEMO,
            sedes: vistaTecnico({
              cliente,
              proyectos,
              historial,
              visitas,
              hoy,
              insumos: INSUMOS_MOCK,
              equipos: EQUIPOS_MOCK,
              estacionesRojo,
            }).sedes,
          }}
          puedeDarDeAlta={puedeDarDeAlta}
          aviso={vista.tipo === 'expediente' ? vista.aviso : null}
          onVolver={() => setVista({ tipo: 'lista' })}
          onEditarFicha={() => setVista({ tipo: 'editar-cliente', clienteId: cliente.id })}
          onNuevoProyecto={() => setVista({ tipo: 'nuevo-proyecto', clienteId: cliente.id })}
          onNuevoServicio={(proyectoId) => setVista({ tipo: 'nuevo-servicio', clienteId: cliente.id, proyectoId })}
          onAbrirMapaMurino={() => onAbrirMapaMurino(cliente.id)}
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
