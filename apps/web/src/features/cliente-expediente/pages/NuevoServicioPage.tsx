import { useState } from 'react';
import type { TipoServicio } from '@gafer/contracts';
import { AltaFormLayout, Bloque, Campo, Opciones, ariaError } from '../components/AltaForm';
import { FRECUENCIAS, TIPOS_SERVICIO } from '../model/catalogos-servicio';
import { validarServicio, type DatosServicio } from '../model/validaciones';
import type { ClienteFila } from '../model/clientes-mock';
import type { ProyectoExpediente } from '../model/expediente-mock';
import type { Equipo, Insumo } from '../../mantenimiento/model/tipos';

interface Props {
  cliente: ClienteFila;
  proyecto: ProyectoExpediente;
  insumos: Insumo[];
  equipos: Equipo[];
  onRegistrar: (datos: DatosServicio) => void;
  onCancelar: () => void;
}

const INICIAL: DatosServicio = {
  tipo: '',
  frecuencia: '',
  areaTotal: '',
  areaTratar: '',
  insumos: [],
  dosis: {},
  equipos: [],
  requiereCertificado: null,
  vigenciaDesde: '',
  vigenciaHasta: '',
  observaciones: '',
  estado: 'ACTIVO',
};

const ESTADO_EQUIPO: Record<Equipo['estadoOperativo'], string> = {
  OPERATIVO: 'Operativo',
  EN_MANTENIMIENTO: 'En mantenimiento',
  FUERA_DE_SERVICIO: 'Fuera de servicio — no se puede asignar',
};

/**
 * Alta de servicio por proyecto — spec §7.3. Define qué se hace, con qué
 * frecuencia y con qué insumos y equipos; eso es lo que después se precarga
 * en el formulario de campo del técnico (§8.2).
 */
export function NuevoServicioPage({ cliente, proyecto, insumos, equipos, onRegistrar, onCancelar }: Props) {
  const [datos, setDatos] = useState<DatosServicio>(INICIAL);
  const [intentado, setIntentado] = useState(false);

  const errores = validarServicio(datos);
  const visibles = intentado ? errores : {};
  const insumosActivos = insumos.filter((i) => i.estado === 'ACTIVO');

  function set<K extends keyof DatosServicio>(campo: K, valor: DatosServicio[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
  }

  function alternarInsumo(insumo: Insumo) {
    setDatos((prev) => {
      const elegido = prev.insumos.includes(insumo.id);
      const dosis = { ...prev.dosis };
      if (elegido) delete dosis[insumo.id];
      else dosis[insumo.id] = insumo.dosisReferencial;
      return {
        ...prev,
        insumos: elegido ? prev.insumos.filter((id) => id !== insumo.id) : [...prev.insumos, insumo.id],
        dosis,
      };
    });
  }

  function alternarEquipo(id: string) {
    setDatos((prev) => ({
      ...prev,
      equipos: prev.equipos.includes(id) ? prev.equipos.filter((e) => e !== id) : [...prev.equipos, id],
    }));
  }

  function registrar() {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    onRegistrar(datos);
  }

  return (
    <AltaFormLayout
      code={`ALTA DE SERVICIO · ${cliente.codigoCorto} · ${proyecto.nombre} · §7.3`}
      title="Nuevo servicio"
      meta={`${cliente.razonSocial} · sede ${proyecto.nombre} · cada servicio lleva su propia numeración de documentos`}
      textoConfirmar="Registrar servicio"
      cantidadErrores={Object.keys(errores).length}
      mostrarErrores={intentado}
      onSubmit={registrar}
      onCancelar={onCancelar}
    >
      <Bloque titulo="Servicio contratado">
        <Campo id="ser-tipo" label="Tipo de servicio" error={visibles.tipo}>
          <select
            {...ariaError('ser-tipo', visibles.tipo)}
            value={datos.tipo}
            onChange={(e) => set('tipo', e.target.value as TipoServicio | '')}
          >
            <option value="">Seleccione un tipo…</option>
            {TIPOS_SERVICIO.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} — {t.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="ser-frecuencia" label="Frecuencia" error={visibles.frecuencia}>
          <select
            {...ariaError('ser-frecuencia', visibles.frecuencia)}
            value={datos.frecuencia}
            onChange={(e) => set('frecuencia', e.target.value)}
          >
            <option value="">Seleccione la frecuencia…</option>
            {FRECUENCIAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="ser-area-total" label="Área total del local" error={visibles.areaTotal}>
          <div className="alta-sufijo">
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
          <div className="alta-sufijo">
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
        <Opciones
          nombre="Estado"
          valor={datos.estado}
          opciones={[
            { valor: 'ACTIVO', etiqueta: 'Activo' },
            { valor: 'INACTIVO', etiqueta: 'Inactivo' },
          ]}
          onCambiar={(v) => set('estado', v)}
        />
      </Bloque>

      <Bloque titulo="Insumos autorizados y dosis">
        <div className={visibles.insumos || visibles.dosis ? 'alta-campo alta-campo--completo alta-campo--error' : 'alta-campo alta-campo--completo'}>
          <span className="alta-campo__label">Insumos del catálogo que el técnico verá precargados</span>
          <ul className="alta-checks">
            {insumosActivos.map((i) => {
              const elegido = datos.insumos.includes(i.id);
              return (
                <li key={i.id} className="alta-check">
                  <input
                    type="checkbox"
                    id={`ser-insumo-${i.id}`}
                    checked={elegido}
                    onChange={() => alternarInsumo(i)}
                  />
                  <label htmlFor={`ser-insumo-${i.id}`} className="alta-check__nombre">
                    {i.nombre}
                  </label>
                  <span className="alta-check__detalle">
                    {i.principioActivo} · {i.concentracion} · DIGESA {i.registroDigesa}
                  </span>
                  {elegido ? (
                    <div className="alta-check__dosis">
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
            <span className="alta-campo__error">{visibles.insumos ?? visibles.dosis}</span>
          ) : (
            <span className="alta-campo__ayuda">Solo se listan insumos activos. La dosis se precarga desde el catálogo y se puede ajustar.</span>
          )}
        </div>
      </Bloque>

      <Bloque titulo="Equipos asignados">
        <div className={visibles.equipos ? 'alta-campo alta-campo--completo alta-campo--error' : 'alta-campo alta-campo--completo'}>
          <span className="alta-campo__label">Equipos del catálogo para este servicio</span>
          <ul className="alta-checks">
            {equipos.map((eq) => {
              const deshabilitado = eq.estadoOperativo === 'FUERA_DE_SERVICIO';
              return (
                <li key={eq.id} className={deshabilitado ? 'alta-check alta-check--deshabilitado' : 'alta-check'}>
                  <input
                    type="checkbox"
                    id={`ser-equipo-${eq.id}`}
                    checked={datos.equipos.includes(eq.id)}
                    disabled={deshabilitado}
                    onChange={() => alternarEquipo(eq.id)}
                  />
                  <label htmlFor={`ser-equipo-${eq.id}`} className="alta-check__nombre">
                    {eq.nombre}
                  </label>
                  <span className="alta-check__detalle">
                    {eq.codigoInterno} · {eq.tipo} · {ESTADO_EQUIPO[eq.estadoOperativo]}
                  </span>
                </li>
              );
            })}
          </ul>
          {visibles.equipos ? <span className="alta-campo__error">{visibles.equipos}</span> : null}
        </div>
      </Bloque>

      <Bloque titulo="Certificado y condiciones">
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
        <div />
        {datos.requiereCertificado ? (
          <>
            <Campo id="ser-vigencia-desde" label="Vigencia desde" error={visibles.vigenciaDesde}>
              <input
                {...ariaError('ser-vigencia-desde', visibles.vigenciaDesde)}
                type="date"
                value={datos.vigenciaDesde}
                onChange={(e) => set('vigenciaDesde', e.target.value)}
              />
            </Campo>
            <Campo id="ser-vigencia-hasta" label="Vigencia hasta" error={visibles.vigenciaHasta}>
              <input
                {...ariaError('ser-vigencia-hasta', visibles.vigenciaHasta)}
                type="date"
                value={datos.vigenciaHasta}
                onChange={(e) => set('vigenciaHasta', e.target.value)}
              />
            </Campo>
          </>
        ) : null}
        <Campo
          id="ser-observaciones"
          label="Observaciones del servicio (opcional)"
          ayuda="Restricciones por área o requisitos específicos del cliente."
          ancho="completo"
        >
          <textarea
            id="ser-observaciones"
            value={datos.observaciones}
            onChange={(e) => set('observaciones', e.target.value)}
            placeholder="No aplicar en zona de envasado durante el turno de producción."
          />
        </Campo>
      </Bloque>
    </AltaFormLayout>
  );
}
