import { useMemo, useState } from 'react';
import { ClientesListPage } from './ClientesListPage';
import { ClienteExpedientePage } from './ClienteExpedientePage';
import { NuevoClientePage } from './NuevoClientePage';
import { NuevoProyectoPage } from './NuevoProyectoPage';
import { NuevoServicioPage } from './NuevoServicioPage';
import { EstadoCargando, EstadoError } from '../components/EstadoConsulta';
import type { ClienteFila } from '../model/clientes-mock';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { useCartera } from '../model/cartera-context';
import { agregarProyecto, agregarServicio, esClienteDeEjemplo, proyectosDe } from '../model/cartera';
import { camposDeError, datosDeFila } from '../model/cliente-mapper';
import { mensajeDeError } from '../../../shared/api/errores';
import type { DatosCliente, DatosProyecto, DatosServicio } from '../model/validaciones';
import { useActivarCliente, useActualizarCliente, useCliente, useClientes, useCrearCliente, useDesactivarCliente } from '../api/use-clientes';
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

  const lista = useClientes();
  const clienteIdAbierto = vista.tipo === 'lista' || vista.tipo === 'nuevo-cliente' ? null : vista.clienteId;
  const ficha = useCliente(clienteIdAbierto);
  const crear = useCrearCliente();
  const actualizar = useActualizarCliente();
  const activar = useActivarCliente();
  const desactivar = useDesactivarCliente();

  const erroresAlta = useMemo(() => (crear.error ? camposDeError(crear.error) : null), [crear.error]);
  const errorEdicion = actualizar.error ?? activar.error ?? desactivar.error;
  const erroresEdicion = useMemo(() => (errorEdicion ? camposDeError(errorEdicion) : null), [errorEdicion]);
  const guardandoFicha = actualizar.isPending || activar.isPending || desactivar.isPending;

  function auditar(accion: AccionAuditoria, referencia: string, detalle: string) {
    const fechaHora = ahora();
    registrar({ id: `${fechaHora}-${accion}-${referencia}`, fechaHora, usuario, rol, accion, referencia, detalle });
  }

  function irA(siguiente: Vista) {
    crear.reset();
    actualizar.reset();
    activar.reset();
    desactivar.reset();
    setVista(siguiente);
  }

  async function registrarCliente(d: DatosCliente, anticipacion: number) {
    try {
      const creado = await crear.mutateAsync({ datos: d, anticipacionAlertaDias: anticipacion });
      auditar('Alta de cliente', d.codigoCorto, `${d.razonSocial.trim()} · RUC ${d.ruc}`);
      irA({ tipo: 'expediente', clienteId: creado.id, aviso: `Cliente ${d.codigoCorto} registrado. El siguiente paso es registrar su primera sede.` });
    } catch {
      // El error queda en la mutación y el formulario lo muestra por campo.
    }
  }

  async function guardarFicha(cliente: ClienteFila, d: DatosCliente, anticipacion: number) {
    try {
      await actualizar.mutateAsync({ id: cliente.id, datos: d, anticipacionAlertaDias: anticipacion });
      if (d.estado !== cliente.estado) await (d.estado === 'ACTIVO' ? activar : desactivar).mutateAsync(cliente.id);
      auditar('Edición de ficha de cliente', cliente.codigoCorto, d.razonSocial.trim());
      irA({ tipo: 'expediente', clienteId: cliente.id, aviso: 'Ficha del cliente actualizada.' });
    } catch {
      // El error queda en la mutación y el formulario lo muestra por campo.
    }
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

  const cliente = ficha.data;

  if (vista.tipo === 'nuevo-cliente' && puedeDarDeAlta) {
    return (
      <NuevoClientePage
        giros={GIROS}
        enviando={crear.isPending}
        erroresServidor={erroresAlta?.campos}
        errorGeneral={erroresAlta?.general}
        onRegistrar={registrarCliente}
        onCancelar={() => irA({ tipo: 'lista' })}
      />
    );
  }

  if (vista.tipo !== 'lista' && vista.tipo !== 'nuevo-cliente' && !cliente) {
    return (
      <div className="clientes-page">
        <TicketHeader
          code="FICHA DE CLIENTE"
          title="Cliente"
          meta="Expediente digital"
          action={
            <button type="button" className="expediente-page__volver" onClick={() => irA({ tipo: 'lista' })}>
              ← Volver a la cartera
            </button>
          }
        />
        <div className="clientes-page__body">
          {ficha.isError ? (
            <EstadoError mensaje={mensajeDeError(ficha.error)} onReintentar={() => void ficha.refetch()} />
          ) : (
            <EstadoCargando mensaje="Cargando la ficha del cliente…" />
          )}
        </div>
      </div>
    );
  }

  if (vista.tipo === 'editar-cliente' && puedeDarDeAlta && cliente) {
    return (
      <NuevoClientePage
        giros={GIROS}
        inicial={datosDeFila(cliente)}
        anticipacionInicial={cliente.anticipacionAlertaDias}
        enviando={guardandoFicha}
        erroresServidor={erroresEdicion?.campos}
        errorGeneral={erroresEdicion?.general}
        onRegistrar={(d, anticipacion) => void guardarFicha(cliente, d, anticipacion)}
        onCancelar={() => irA({ tipo: 'expediente', clienteId: cliente.id, aviso: null })}
      />
    );
  }

  if (vista.tipo === 'nuevo-proyecto' && puedeDarDeAlta && cliente) {
    return (
      <NuevoProyectoPage
        cliente={cliente}
        nombresExistentes={proyectosDe(cartera, cliente.id).map((p) => p.nombre)}
        onRegistrar={(d) => registrarProyecto(cliente.id, d)}
        onCancelar={() => setVista({ tipo: 'expediente', clienteId: cliente.id, aviso: null })}
      />
    );
  }

  if (vista.tipo === 'nuevo-servicio' && puedeDarDeAlta && cliente) {
    const proyecto = proyectosDe(cartera, cliente.id).find((p) => p.id === vista.proyectoId);
    if (proyecto) {
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

  if (vista.tipo !== 'lista' && vista.tipo !== 'nuevo-cliente' && cliente) {
    const proyectos = proyectosDe(cartera, cliente.id);
    /** Los clientes de ejemplo comparten sedes de muestra: su contrato real sale del historial. */
    const contrataDesratizacion = esClienteDeEjemplo(cartera, cliente.id)
      ? tiposContratadosDe(cliente.codigoCorto).includes('DRT')
      : proyectos.some((p) => p.servicios.some((s) => s.tipoId === 'DRT'));
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

  return (
    <ClientesListPage
      clientes={lista.data ?? []}
      cargando={lista.isPending}
      error={lista.isError ? mensajeDeError(lista.error) : null}
      onReintentar={() => void lista.refetch()}
      onAbrirCliente={(c) => irA({ tipo: 'expediente', clienteId: c.id, aviso: null })}
      puedeCrearCliente={puedeDarDeAlta}
      onNuevoCliente={() => irA({ tipo: 'nuevo-cliente' })}
    />
  );
}
