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
import { camposDeError, datosDeFila } from '../model/cliente-mapper';
import { camposDeErrorProyecto, datosDeProyecto } from '../model/proyecto-mapper';
import { camposDeErrorServicio, datosDeServicio } from '../model/servicio-mapper';
import { etiquetaFrecuencia } from '../model/catalogos-servicio';
import { mensajeDeError } from '../../../shared/api/errores';
import type { DatosCliente, DatosProyecto, DatosServicio } from '../model/validaciones';
import { useActivarCliente, useActualizarCliente, useCliente, useClientes, useCrearCliente, useDesactivarCliente } from '../api/use-clientes';
import {
  useActivarSede,
  useActivarServicio,
  useActualizarSede,
  useActualizarServicio,
  useCrearSede,
  useCrearServicio,
  useDesactivarSede,
  useDesactivarServicio,
  useSedes,
} from '../api/use-sedes';
import { useEquipos } from '../../mantenimiento/api/use-equipos';
import { useInsumos } from '../../mantenimiento/api/use-insumos';
import { useCatalogosTexto } from '../../mantenimiento/api/use-catalogos-texto';
import { PERSONAL_MOCK } from '../../mantenimiento/model/mantenimiento-mock';
import { nombreCompleto } from '../../mantenimiento/model/personal-mapper';
import { useProgramacion } from '../../programacion/model/programacion-context';
import { vistaTecnico } from '../model/vista-tecnico';
import { generarHistorial } from '../../estadisticas/model/historial-mock';
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
  | { tipo: 'editar-proyecto'; clienteId: string; proyectoId: string }
  | { tipo: 'nuevo-servicio'; clienteId: string; proyectoId: string }
  | { tipo: 'editar-servicio'; clienteId: string; proyectoId: string; servicioId: string };

interface ClientesModuleProps {
  usuario: string;
  rol: Rol;
  onAbrirMapaMurino: (clienteId: string) => void;
}

/** Técnico con el que se muestra la maqueta de la app. */
const TECNICO_DEMO_PERSONAL = PERSONAL_MOCK.find((p) => p.cargo === 'TECNICO_OPERADOR' && p.estado === 'ACTIVO');
const TECNICO_DEMO = TECNICO_DEMO_PERSONAL ? nombreCompleto(TECNICO_DEMO_PERSONAL) : 'Técnico operador';

/** Jerarquía CLIENTE → PROYECTO (sede) → SERVICIO (§7); clientes, sedes y servicios vienen del API. */
export function ClientesModule({ usuario, rol, onAbrirMapaMurino }: ClientesModuleProps) {
  const { cartera } = useCartera();
  /** Giros del negocio: salen del catálogo de texto editable (§7.7), de modo que un cambio en Mantenimiento se ve aquí. */
  const giros = useCatalogosTexto().data?.find((c) => c.id === 'giros')?.items ?? [];
  const { registrar } = useAuditoria();
  const { visitas } = useProgramacion();
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const hoy = fechaLocal();
  const historial = useMemo(() => generarHistorial(hoy), [hoy]);
  const estacionesRojo = useMemo(() => estacionesRojoDe(historial, cartera.clientes), [historial, cartera.clientes]);
  /** Solo el Administrador da de alta clientes, sedes y servicios (§12, decisión C1). */
  const puedeDarDeAlta = rol === 'ADMINISTRADOR';
  /** El API entrega insumos y equipos solo a Administrador y Técnico: el Supervisor no los consulta. */
  const puedeLeerCatalogos = rol === 'ADMINISTRADOR';

  const lista = useClientes();
  const clienteIdAbierto = vista.tipo === 'lista' || vista.tipo === 'nuevo-cliente' ? null : vista.clienteId;
  const ficha = useCliente(clienteIdAbierto);
  const sedes = useSedes(clienteIdAbierto);
  const insumos = useInsumos(puedeLeerCatalogos && clienteIdAbierto !== null);
  const equipos = useEquipos(puedeLeerCatalogos && clienteIdAbierto !== null);
  const crear = useCrearCliente();
  const actualizar = useActualizarCliente();
  const activar = useActivarCliente();
  const desactivar = useDesactivarCliente();
  const crearSede = useCrearSede();
  const actualizarSede = useActualizarSede();
  const activarSede = useActivarSede();
  const desactivarSede = useDesactivarSede();
  const crearServicio = useCrearServicio();
  const actualizarServicio = useActualizarServicio();
  const activarServicio = useActivarServicio();
  const desactivarServicio = useDesactivarServicio();

  const erroresAlta = useMemo(() => (crear.error ? camposDeError(crear.error) : null), [crear.error]);
  const errorEdicion = actualizar.error ?? activar.error ?? desactivar.error;
  const erroresEdicion = useMemo(() => (errorEdicion ? camposDeError(errorEdicion) : null), [errorEdicion]);
  const guardandoFicha = actualizar.isPending || activar.isPending || desactivar.isPending;

  const errorSede = crearSede.error ?? actualizarSede.error;
  const erroresSede = useMemo(() => (errorSede ? camposDeErrorProyecto(errorSede) : null), [errorSede]);
  const errorServicio = crearServicio.error ?? actualizarServicio.error;
  const erroresServicio = useMemo(() => (errorServicio ? camposDeErrorServicio(errorServicio) : null), [errorServicio]);
  const cambiandoEstado = activarSede.isPending || desactivarSede.isPending || activarServicio.isPending || desactivarServicio.isPending;
  const errorEstado = activarSede.error ?? desactivarSede.error ?? activarServicio.error ?? desactivarServicio.error;
  const errorCatalogos = insumos.error ?? equipos.error;

  function auditar(accion: AccionAuditoria, referencia: string, detalle: string) {
    const fechaHora = ahora();
    registrar({ id: `${fechaHora}-${accion}-${referencia}`, fechaHora, usuario, rol, accion, referencia, detalle });
  }

  function irA(siguiente: Vista) {
    for (const mutacion of [
      crear,
      actualizar,
      activar,
      desactivar,
      crearSede,
      actualizarSede,
      activarSede,
      desactivarSede,
      crearServicio,
      actualizarServicio,
      activarServicio,
      desactivarServicio,
    ]) {
      mutacion.reset();
    }
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

  async function registrarProyecto(clienteId: string, d: DatosProyecto) {
    try {
      await crearSede.mutateAsync({ clienteId, datos: d });
      irA({ tipo: 'expediente', clienteId, aviso: `Sede ${d.nombre} registrada. Ya puede agregarle servicios.` });
    } catch {
      // El error queda en la mutación y el formulario lo muestra por campo.
    }
  }

  async function guardarProyecto(clienteId: string, proyectoId: string, d: DatosProyecto) {
    try {
      await actualizarSede.mutateAsync({ id: proyectoId, datos: d });
      irA({ tipo: 'expediente', clienteId, aviso: `Sede ${d.nombre} actualizada.` });
    } catch {
      // El error queda en la mutación y el formulario lo muestra por campo.
    }
  }

  async function registrarServicio(clienteId: string, proyectoId: string, nombreSede: string, d: DatosServicio) {
    try {
      await crearServicio.mutateAsync({ proyectoId, datos: d });
      const frecuencia = etiquetaFrecuencia(d.frecuencia as Exclude<DatosServicio['frecuencia'], ''>).toLowerCase();
      irA({ tipo: 'expediente', clienteId, aviso: `Servicio ${d.tipo} (${frecuencia}) registrado en ${nombreSede}.` });
    } catch {
      // El error queda en la mutación y el formulario lo muestra por campo.
    }
  }

  async function guardarServicio(clienteId: string, servicioId: string, tipo: string, d: DatosServicio) {
    try {
      await actualizarServicio.mutateAsync({ id: servicioId, datos: d });
      irA({ tipo: 'expediente', clienteId, aviso: `Servicio ${tipo} actualizado.` });
    } catch {
      // El error queda en la mutación y el formulario lo muestra por campo.
    }
  }

  function cambiarEstadoProyecto(proyectoId: string, activa: boolean) {
    activarSede.reset();
    desactivarSede.reset();
    (activa ? activarSede : desactivarSede).mutate(proyectoId);
  }

  function cambiarEstadoServicio(servicioId: string, activa: boolean) {
    activarServicio.reset();
    desactivarServicio.reset();
    (activa ? activarServicio : desactivarServicio).mutate(servicioId);
  }

  const cliente = ficha.data;
  const proyectos = sedes.data ?? [];

  if (vista.tipo === 'nuevo-cliente' && puedeDarDeAlta) {
    return (
      <NuevoClientePage
        giros={giros}
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
        giros={giros}
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
        nombresExistentes={proyectos.map((p) => p.nombre)}
        enviando={crearSede.isPending}
        erroresServidor={erroresSede?.campos}
        errorGeneral={erroresSede?.general}
        onRegistrar={(d) => void registrarProyecto(cliente.id, d)}
        onCancelar={() => irA({ tipo: 'expediente', clienteId: cliente.id, aviso: null })}
      />
    );
  }

  if (vista.tipo === 'editar-proyecto' && puedeDarDeAlta && cliente) {
    const proyecto = proyectos.find((p) => p.id === vista.proyectoId);
    if (proyecto) {
      return (
        <NuevoProyectoPage
          cliente={cliente}
          nombresExistentes={proyectos.filter((p) => p.id !== proyecto.id).map((p) => p.nombre)}
          inicial={datosDeProyecto(proyecto)}
          enviando={actualizarSede.isPending}
          erroresServidor={erroresSede?.campos}
          errorGeneral={erroresSede?.general}
          onRegistrar={(d) => void guardarProyecto(cliente.id, proyecto.id, d)}
          onCancelar={() => irA({ tipo: 'expediente', clienteId: cliente.id, aviso: null })}
        />
      );
    }
  }

  if ((vista.tipo === 'nuevo-servicio' || vista.tipo === 'editar-servicio') && puedeDarDeAlta && cliente) {
    const proyecto = proyectos.find((p) => p.id === vista.proyectoId);
    const servicio = vista.tipo === 'editar-servicio' ? proyecto?.servicios.find((s) => s.id === vista.servicioId) : undefined;
    if (proyecto && (vista.tipo === 'nuevo-servicio' || servicio)) {
      return (
        <NuevoServicioPage
          cliente={cliente}
          proyecto={proyecto}
          insumos={insumos.data ?? []}
          equipos={equipos.data ?? []}
          inicial={servicio ? datosDeServicio(servicio) : undefined}
          cargandoCatalogos={insumos.isPending || equipos.isPending}
          errorCatalogos={errorCatalogos ? mensajeDeError(errorCatalogos) : null}
          onReintentarCatalogos={() => {
            if (insumos.isError) void insumos.refetch();
            if (equipos.isError) void equipos.refetch();
          }}
          enviando={crearServicio.isPending || actualizarServicio.isPending}
          erroresServidor={erroresServicio?.campos}
          errorGeneral={erroresServicio?.general}
          onRegistrar={(d) =>
            servicio
              ? void guardarServicio(cliente.id, servicio.id, servicio.tipoServicio, d)
              : void registrarServicio(cliente.id, proyecto.id, proyecto.nombre, d)
          }
          onCancelar={() => irA({ tipo: 'expediente', clienteId: cliente.id, aviso: null })}
        />
      );
    }
  }

  if (vista.tipo !== 'lista' && vista.tipo !== 'nuevo-cliente' && cliente) {
    const contrataDesratizacion = proyectos.some((p) =>
      p.estado === 'ACTIVO' && p.servicios.some((s) => s.estado === 'ACTIVO' && s.tipoServicio === 'DRT'),
    );
    return (
      <ClienteExpedientePage
        cliente={cliente}
        proyectos={proyectos}
        cargandoProyectos={sedes.isPending}
        errorProyectos={sedes.isError ? mensajeDeError(sedes.error) : null}
        onReintentarProyectos={() => void sedes.refetch()}
        cambiandoEstado={cambiandoEstado}
        errorEstado={errorEstado ? mensajeDeError(errorEstado) : null}
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
            insumos: insumos.data ?? [],
            equipos: equipos.data ?? [],
            estacionesRojo,
          }).sedes,
        }}
        puedeDarDeAlta={puedeDarDeAlta}
        aviso={vista.tipo === 'expediente' ? vista.aviso : null}
        onVolver={() => irA({ tipo: 'lista' })}
        onEditarFicha={() => irA({ tipo: 'editar-cliente', clienteId: cliente.id })}
        onNuevoProyecto={() => irA({ tipo: 'nuevo-proyecto', clienteId: cliente.id })}
        onEditarProyecto={(proyectoId) => irA({ tipo: 'editar-proyecto', clienteId: cliente.id, proyectoId })}
        onCambiarEstadoProyecto={cambiarEstadoProyecto}
        onNuevoServicio={(proyectoId) => irA({ tipo: 'nuevo-servicio', clienteId: cliente.id, proyectoId })}
        onEditarServicio={(proyectoId, servicioId) => irA({ tipo: 'editar-servicio', clienteId: cliente.id, proyectoId, servicioId })}
        onCambiarEstadoServicio={cambiarEstadoServicio}
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
