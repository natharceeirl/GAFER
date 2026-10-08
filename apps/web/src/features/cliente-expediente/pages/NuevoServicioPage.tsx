import { useEffect, useState } from 'react';
import type { Equipo, FrecuenciaServicio, Insumo, TipoServicio } from '@gafer/contracts';
import { AltaFormLayout } from '../components/AltaForm';
import { EstadoCargando, EstadoError } from '../components/EstadoConsulta';
import { Bloque, Campo, Opciones, ariaError } from '../../../shared/ui/molecules/FormFields';
import { FRECUENCIAS, TIPOS_SERVICIO, etiquetaTipoServicio } from '../model/catalogos-servicio';
import { validarServicio, type DatosServicio, type Errores } from '../model/validaciones';
import type { ClienteFila } from '../model/clientes-mock';
import type { ProyectoExpediente } from '../model/proyecto-mapper';
import { etiquetaEstadoOperativo, etiquetaTipoEquipo } from '../../mantenimiento/model/catalogos-etiquetas';

interface Props {
  cliente: ClienteFila;
  proyecto: ProyectoExpediente;
  insumos: Insumo[];
  equipos: Equipo[];
  /** Con `inicial` el formulario edita un servicio ya contratado: el tipo queda fijo. */
  inicial?: DatosServicio;
  /** Los catálogos de insumos y equipos se están leyendo del API. */
  cargandoCatalogos?: boolean;
  /** Motivo por el que no se pudieron leer los catálogos (por ejemplo, falta de permiso). */
  errorCatalogos?: string | null;
  onReintentarCatalogos?: () => void;
  /** Operación en curso: se deshabilitan los botones. */
  enviando?: boolean;
  /** Errores por campo devueltos por el servidor (400). */
  erroresServidor?: Errores<keyof DatosServicio>;
  /** Error del servidor que no corresponde a un campo. */
  errorGeneral?: string | null;
  onRegistrar: (datos: DatosServicio) => void;
  onCancelar: () => void;
}

const SIN_ERRORES: Errores<keyof DatosServicio> = {};

const INICIAL: DatosServicio = {
  tipo: '',
  frecuencia: '',
  areaTotal: '',
  areaTratar: '',
  insumos: [],
  dosis: {},
  equipos: [],
  requiereCertificado: null,
  vigenciaDias: '',
};

/** Estado del equipo en el listado de selección: uno fuera de servicio se ve, pero no se puede asignar. */
const estadoDeEquipo = (e: Equipo) =>
  e.estadoOperativo === 'FUERA_SERVICIO' ? `${etiquetaEstadoOperativo(e.estadoOperativo)} — no se puede asignar` : etiquetaEstadoOperativo(e.estadoOperativo);

/** Insumo o equipo que se puede marcar; `catalogo` es nulo si el catálogo no lo entregó y solo se conoce su identificador. */
interface Opcion<T> {
  id: string;
  nombre: string;
  catalogo: T | null;
}

/** Nombre corto con el que se identifica un insumo o equipo que el catálogo no entregó. */
const identificador = (id: string) => id.slice(0, 8);

/**
 * Alta y edición de servicio por proyecto — spec §7.3. Define qué se hace, con qué
 * frecuencia y con qué insumos y equipos; eso es lo que después se precarga
 * en el formulario de campo del técnico (§8.2).
 */
export function NuevoServicioPage({
  cliente,
  proyecto,
  insumos,
  equipos,
  inicial,
  cargandoCatalogos = false,
  errorCatalogos = null,
  onReintentarCatalogos = () => {},
  enviando = false,
  erroresServidor = SIN_ERRORES,
  errorGeneral = null,
  onRegistrar,
  onCancelar,
}: Props) {
  const edicion = inicial !== undefined;
  const [datos, setDatos] = useState<DatosServicio>(inicial ?? INICIAL);
  const [intentado, setIntentado] = useState(false);

  /** Campos que se tocaron después del último error del servidor: su error ya no aplica. */
  const [corregidos, setCorregidos] = useState<Array<keyof DatosServicio>>([]);
  useEffect(() => setCorregidos([]), [erroresServidor]);

  const errores = validarServicio(datos);
  const delServidor: Errores<keyof DatosServicio> = {};
  for (const campo of Object.keys(erroresServidor) as Array<keyof DatosServicio>) {
    if (!corregidos.includes(campo)) delServidor[campo] = erroresServidor[campo];
  }
  const visibles = { ...(intentado ? errores : {}), ...delServidor };

  /** Solo se ofrecen insumos activos, más los ya elegidos (aunque se hayan desactivado o el catálogo no los entregue) para poder quitarlos. */
  const insumosVisibles: Opcion<Insumo>[] = [
    ...insumos.filter((i) => i.estado === 'ACTIVO' || datos.insumos.includes(i.id)).map((i) => ({ id: i.id, nombre: i.nombreComercial, catalogo: i })),
    ...datos.insumos
      .filter((id) => !insumos.some((i) => i.id === id))
      .map((id) => ({ id, nombre: `Insumo ${identificador(id)}`, catalogo: null })),
  ];
  const equiposVisibles: Opcion<Equipo>[] = [
    ...equipos.map((e) => ({ id: e.id, nombre: e.nombre, catalogo: e })),
    ...datos.equipos
      .filter((id) => !equipos.some((e) => e.id === id))
      .map((id) => ({ id, nombre: `Equipo ${identificador(id)}`, catalogo: null })),
  ];

  function set<K extends keyof DatosServicio>(campo: K, valor: DatosServicio[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    setCorregidos((prev) => (prev.includes(campo) ? prev : [...prev, campo]));
  }

  function alternarInsumo(id: string, dosisCatalogo: string) {
    setDatos((prev) => {
      const elegido = prev.insumos.includes(id);
      const dosis = { ...prev.dosis };
      if (elegido) delete dosis[id];
      else dosis[id] = dosisCatalogo;
      return { ...prev, insumos: elegido ? prev.insumos.filter((x) => x !== id) : [...prev.insumos, id], dosis };
    });
    setCorregidos((prev) => prev.filter((c) => c !== 'insumos' && c !== 'dosis'));
  }

  function alternarEquipo(id: string) {
    setDatos((prev) => ({
      ...prev,
      equipos: prev.equipos.includes(id) ? prev.equipos.filter((e) => e !== id) : [...prev.equipos, id],
    }));
    setCorregidos((prev) => prev.filter((c) => c !== 'equipos'));
  }

  function registrar() {
    setIntentado(true);
    if (enviando || Object.keys(errores).length > 0) return;
    onRegistrar(datos);
  }

  const catalogos = cargandoCatalogos ? (
    <EstadoCargando mensaje="Cargando el catálogo de insumos y equipos…" />
  ) : errorCatalogos ? (
    <EstadoError mensaje={`No se pudo cargar el catálogo de insumos y equipos. ${errorCatalogos}`} onReintentar={onReintentarCatalogos} />
  ) : null;

  return (
    <AltaFormLayout
      code={
        edicion
          ? `SERVICIO · ${cliente.codigoCorto} · ${proyecto.nombre} · ${inicial.tipo} · §7.3`
          : `ALTA DE SERVICIO · ${cliente.codigoCorto} · ${proyecto.nombre} · §7.3`
      }
      title={edicion ? 'Editar servicio' : 'Nuevo servicio'}
      meta={
        edicion
          ? `${cliente.razonSocial} · sede ${proyecto.nombre} · el tipo de servicio no se puede cambiar`
          : `${cliente.razonSocial} · sede ${proyecto.nombre} · cada servicio lleva su propia numeración de documentos`
      }
      textoConfirmar={edicion ? 'Guardar servicio' : 'Registrar servicio'}
      cantidadErrores={Object.keys(errores).length}
      mostrarErrores={intentado}
      enviando={enviando}
      errorGeneral={errorGeneral}
      onSubmit={registrar}
      onCancelar={onCancelar}
    >
      <Bloque titulo="Servicio contratado">
        <Campo id="ser-tipo" label="Tipo de servicio" error={visibles.tipo}>
          <select
            {...ariaError('ser-tipo', visibles.tipo)}
            value={datos.tipo}
            disabled={edicion}
            onChange={(e) => set('tipo', e.target.value as TipoServicio | '')}
          >
            <option value="">Seleccione un tipo…</option>
            {TIPOS_SERVICIO.map((t) => (
              <option key={t.id} value={t.id}>
                {etiquetaTipoServicio(t.id)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="ser-frecuencia" label="Frecuencia" error={visibles.frecuencia}>
          <select
            {...ariaError('ser-frecuencia', visibles.frecuencia)}
            value={datos.frecuencia}
            onChange={(e) => set('frecuencia', e.target.value as FrecuenciaServicio | '')}
          >
            <option value="">Seleccione la frecuencia…</option>
            {FRECUENCIAS.map((f) => (
              <option key={f.codigo} value={f.codigo}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="ser-area-total" label="Área total del local" error={visibles.areaTotal}>
          <div className="ff-sufijo">
            <input
              {...ariaError('ser-area-total', visibles.areaTotal)}
              type="number"
              min={0}
              inputMode="decimal"
              value={datos.areaTotal}
              onChange={(e) => set('areaTotal', e.target.value)}
              placeholder="1200"
            />
            <span>m²</span>
          </div>
        </Campo>
        <Campo id="ser-area-tratar" label="Área a tratar por visita" error={visibles.areaTratar}>
          <div className="ff-sufijo">
            <input
              {...ariaError('ser-area-tratar', visibles.areaTratar)}
              type="number"
              min={0}
              inputMode="decimal"
              value={datos.areaTratar}
              onChange={(e) => set('areaTratar', e.target.value)}
              placeholder="800"
            />
            <span>m²</span>
          </div>
        </Campo>
      </Bloque>

      <Bloque titulo="Insumos autorizados y dosis">
        {catalogos}
        <div className={visibles.insumos || visibles.dosis ? 'ff-campo ff-campo--completo ff-campo--error' : 'ff-campo ff-campo--completo'}>
          <span className="ff-campo__label">Insumos del catálogo que el técnico verá precargados</span>
          <ul className="ff-checks">
            {insumosVisibles.map((i) => {
              const elegido = datos.insumos.includes(i.id);
              const completo = i.catalogo;
              return (
                <li key={i.id} className="ff-check">
                  <input type="checkbox" id={`ser-insumo-${i.id}`} checked={elegido} onChange={() => alternarInsumo(i.id, completo?.dosisEstandar ?? '')} />
                  <label htmlFor={`ser-insumo-${i.id}`} className="ff-check__nombre">
                    {i.nombre}
                  </label>
                  {completo ? (
                    <span className="ff-check__detalle">
                      {completo.principioActivo} · {completo.concentracion} · DIGESA {completo.registroDigesa}
                      {completo.estado === 'INACTIVO' ? ' · inactivo' : ''}
                    </span>
                  ) : null}
                  {elegido ? (
                    <div className="ff-check__dosis">
                      <label htmlFor={`ser-dosis-${i.id}`}>Dosis referencial para este servicio</label>
                      <input
                        id={`ser-dosis-${i.id}`}
                        type="text"
                        value={datos.dosis[i.id] ?? ''}
                        onChange={(e) => set('dosis', { ...datos.dosis, [i.id]: e.target.value })}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {visibles.insumos || visibles.dosis ? (
            <span className="ff-campo__error">{visibles.insumos ?? visibles.dosis}</span>
          ) : (
            <span className="ff-campo__ayuda">Solo se listan insumos activos. La dosis se precarga desde el catálogo y se puede ajustar.</span>
          )}
        </div>
      </Bloque>

      <Bloque titulo="Equipos asignados">
        <div className={visibles.equipos ? 'ff-campo ff-campo--completo ff-campo--error' : 'ff-campo ff-campo--completo'}>
          <span className="ff-campo__label">Equipos del catálogo para este servicio</span>
          <ul className="ff-checks">
            {equiposVisibles.map((eq) => {
              const elegido = datos.equipos.includes(eq.id);
              const completo = eq.catalogo;
              const deshabilitado = completo?.estadoOperativo === 'FUERA_SERVICIO' && !elegido;
              return (
                <li key={eq.id} className={deshabilitado ? 'ff-check ff-check--deshabilitado' : 'ff-check'}>
                  <input
                    type="checkbox"
                    id={`ser-equipo-${eq.id}`}
                    checked={elegido}
                    disabled={deshabilitado}
                    onChange={() => alternarEquipo(eq.id)}
                  />
                  <label htmlFor={`ser-equipo-${eq.id}`} className="ff-check__nombre">
                    {eq.nombre}
                  </label>
                  {completo ? (
                    <span className="ff-check__detalle">
                      {completo.codigoInterno} · {etiquetaTipoEquipo(completo.tipo)} · {estadoDeEquipo(completo)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {visibles.equipos ? <span className="ff-campo__error">{visibles.equipos}</span> : null}
        </div>
      </Bloque>

      <Bloque titulo="Certificado">
        <Opciones
          nombre="¿Requiere certificado?"
          valor={datos.requiereCertificado}
          opciones={[
            { valor: true, etiqueta: 'Sí' },
            { valor: false, etiqueta: 'No' },
          ]}
          onCambiar={(v) => set('requiereCertificado', v)}
          error={visibles.requiereCertificado}
        />
        {datos.requiereCertificado ? (
          <Campo
            id="ser-vigencia-dias"
            label="Vigencia del certificado"
            error={visibles.vigenciaDias}
            ayuda="Días que el certificado de este servicio se mantiene vigente."
          >
            <div className="ff-sufijo">
              <input
                {...ariaError('ser-vigencia-dias', visibles.vigenciaDias)}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={datos.vigenciaDias}
                onChange={(e) => set('vigenciaDias', e.target.value)}
                placeholder="180"
              />
              <span>días</span>
            </div>
          </Campo>
        ) : null}
      </Bloque>
    </AltaFormLayout>
  );
}
