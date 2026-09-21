import { Button } from '../../../shared/ui/atoms/Button';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { FoldPanel } from '../../../shared/ui/molecules/FoldPanel';
import { StateStamp } from '../../../shared/ui/molecules/StateStamp';
import type { InspeccionBorrador } from '../model/tipos';
import {
  ACCIONES_CORRECTIVAS_MOCK,
  CLIENTES_MOCK,
  EQUIPOS_CATALOGO_MOCK,
  HALLAZGOS_CATALOGO_MOCK,
  METODOS_APLICACION,
  OBSERVACIONES_CATALOGO_MOCK,
  RECOMENDACIONES_CATALOGO_MOCK,
  TIPOS_SERVICIO,
} from '../model/catalogos-mock';
import { BloquePersonal } from './bloques/BloquePersonal';
import { BloqueInsumos } from './bloques/BloqueInsumos';
import { BloqueFirma } from './bloques/BloqueFirma';
import './OperacionesForm.css';

export interface OperacionesFormProps {
  estadoRemoto: 'BORRADOR' | 'CERRADO' | null;
  borrador: InspeccionBorrador;
  onActualizarBloque: <K extends keyof InspeccionBorrador>(bloque: K, valor: InspeccionBorrador[K]) => void;
  onGuardarBorrador: () => void;
  onCerrarInspeccion: () => void;
}

/**
 * Presentacional: solo recibe props, no conoce el store local ni el
 * cache de servidor. Testeable sin mockear red ni IndexedDB.
 * Los 12 bloques de la sección 6.1 de la especificación, cada uno su
 * propio compartimento de ticket.
 */
export function OperacionesForm({
  estadoRemoto,
  borrador,
  onActualizarBloque,
  onGuardarBorrador,
  onCerrarInspeccion,
}: OperacionesFormProps) {
  const { identificacion } = borrador;
  const cerrada = estadoRemoto === 'CERRADO';

  function alternarEnLista(lista: string[], valor: string): string[] {
    return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
  }

  return (
    <div className="formulario-campo">
      <TicketHeader
        code={borrador.servicioId}
        title={identificacion.tipoServicio || 'Formulario de campo'}
        meta={`${identificacion.clienteCodigo || 'Cliente'} · ${identificacion.proyecto || 'Proyecto'}`}
        action={estadoRemoto ? <StateStamp estado={estadoRemoto} /> : null}
      />

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">1 · Identificación</legend>
        <div className="grid-2">
          <select
            aria-label="Cliente"
            value={identificacion.clienteCodigo}
            onChange={(event) =>
              onActualizarBloque('identificacion', { ...identificacion, clienteCodigo: event.target.value })
            }
          >
            <option value="">Cliente…</option>
            {CLIENTES_MOCK.map((cliente) => (
              <option key={cliente.codigo} value={cliente.codigo}>
                {cliente.codigo}
              </option>
            ))}
          </select>
          <select
            aria-label="Tipo de servicio"
            value={identificacion.tipoServicio}
            onChange={(event) =>
              onActualizarBloque('identificacion', { ...identificacion, tipoServicio: event.target.value })
            }
          >
            <option value="">Tipo de servicio…</option>
            {TIPOS_SERVICIO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>
        <input
          aria-label="Proyecto / sede"
          placeholder="Proyecto / sede"
          value={identificacion.proyecto}
          onChange={(event) =>
            onActualizarBloque('identificacion', { ...identificacion, proyecto: event.target.value })
          }
        />
        <input
          aria-label="Fecha y hora"
          type="datetime-local"
          value={identificacion.fechaHora}
          onChange={(event) =>
            onActualizarBloque('identificacion', { ...identificacion, fechaHora: event.target.value })
          }
        />
      </fieldset>

      <FoldPanel label={`2 · Personal (${borrador.personal.length})`} defaultOpen={borrador.personal.length === 0}>
        <BloquePersonal personal={borrador.personal} onCambiar={(v) => onActualizarBloque('personal', v)} />
      </FoldPanel>

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">3 · Herramientas y equipos</legend>
        <div className="checkbox-lista">
          {EQUIPOS_CATALOGO_MOCK.map((nombre) => {
            const existente = borrador.equipos.find((equipo) => equipo.nombre === nombre);
            return (
              <label key={nombre}>
                <input
                  type="checkbox"
                  checked={existente?.usado ?? false}
                  onChange={() => {
                    const otros = borrador.equipos.filter((equipo) => equipo.nombre !== nombre);
                    const usado = !(existente?.usado ?? false);
                    onActualizarBloque('equipos', [...otros, { id: nombre, nombre, usado }]);
                  }}
                />
                {nombre}
              </label>
            );
          })}
        </div>
      </fieldset>

      <FoldPanel label={`4 · Insumos aplicados (${borrador.insumos.length})`} defaultOpen={borrador.insumos.length === 0}>
        <BloqueInsumos insumos={borrador.insumos} onCambiar={(v) => onActualizarBloque('insumos', v)} />
      </FoldPanel>

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">5 · Método de aplicación</legend>
        <select
          aria-label="Método de aplicación"
          value={borrador.metodoAplicacion}
          onChange={(event) => onActualizarBloque('metodoAplicacion', event.target.value as InspeccionBorrador['metodoAplicacion'])}
        >
          <option value="">Seleccionar…</option>
          {METODOS_APLICACION.map((metodo) => (
            <option key={metodo.value} value={metodo.value}>
              {metodo.label}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">6 · Condiciones ambientales</legend>
        <div className="grid-3">
          <input
            aria-label="Temperatura en grados Celsius"
            className="tabular"
            inputMode="decimal"
            placeholder="Temperatura (°C)"
            value={borrador.condicionesAmbientales.temperaturaC}
            onChange={(event) =>
              onActualizarBloque('condicionesAmbientales', {
                ...borrador.condicionesAmbientales,
                temperaturaC: event.target.value,
              })
            }
          />
          <input
            aria-label="Humedad porcentual"
            className="tabular"
            inputMode="decimal"
            placeholder="Humedad (%)"
            value={borrador.condicionesAmbientales.humedadPorc}
            onChange={(event) =>
              onActualizarBloque('condicionesAmbientales', {
                ...borrador.condicionesAmbientales,
                humedadPorc: event.target.value,
              })
            }
          />
          <input
            aria-label="Viento en kilómetros por hora"
            className="tabular"
            inputMode="decimal"
            placeholder="Viento (km/h)"
            value={borrador.condicionesAmbientales.vientoKmh}
            onChange={(event) =>
              onActualizarBloque('condicionesAmbientales', {
                ...borrador.condicionesAmbientales,
                vientoKmh: event.target.value,
              })
            }
          />
        </div>
      </fieldset>

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">7 · Diagnóstico y hallazgos</legend>
        <select
          aria-label="Hallazgo del catálogo"
          value={borrador.diagnostico.hallazgoCatalogo}
          onChange={(event) =>
            onActualizarBloque('diagnostico', { ...borrador.diagnostico, hallazgoCatalogo: event.target.value })
          }
        >
          <option value="">Seleccionar hallazgo…</option>
          {HALLAZGOS_CATALOGO_MOCK.map((hallazgo) => (
            <option key={hallazgo} value={hallazgo}>
              {hallazgo}
            </option>
          ))}
        </select>
        <textarea
          aria-label="Detalle del hallazgo"
          placeholder="Detalle por zona"
          value={borrador.diagnostico.textoLibre}
          onChange={(event) =>
            onActualizarBloque('diagnostico', { ...borrador.diagnostico, textoLibre: event.target.value })
          }
        />
      </fieldset>

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">8 · Acciones correctivas</legend>
        <div className="chip-lista">
          {ACCIONES_CORRECTIVAS_MOCK.map((accion) => {
            const activo = borrador.accionesCorrectivas.includes(accion);
            return (
              <button
                key={accion}
                type="button"
                aria-pressed={activo}
                onClick={() =>
                  onActualizarBloque('accionesCorrectivas', alternarEnLista(borrador.accionesCorrectivas, accion))
                }
              >
                {accion}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">9 · Observaciones técnicas</legend>
        <select
          aria-label="Observación del catálogo"
          value={borrador.observacionesTecnicas.catalogo}
          onChange={(event) =>
            onActualizarBloque('observacionesTecnicas', {
              ...borrador.observacionesTecnicas,
              catalogo: event.target.value,
            })
          }
        >
          <option value="">Seleccionar observación…</option>
          {OBSERVACIONES_CATALOGO_MOCK.map((obs) => (
            <option key={obs} value={obs}>
              {obs}
            </option>
          ))}
        </select>
        <textarea
          aria-label="Observaciones técnicas adicionales"
          placeholder="Observaciones técnicas"
          value={borrador.observacionesTecnicas.textoLibre}
          onChange={(event) =>
            onActualizarBloque('observacionesTecnicas', {
              ...borrador.observacionesTecnicas,
              textoLibre: event.target.value,
            })
          }
        />
      </fieldset>

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">10 · Recomendaciones al cliente</legend>
        <div className="chip-lista">
          {RECOMENDACIONES_CATALOGO_MOCK.map((recomendacion) => {
            const activo = borrador.recomendaciones.includes(recomendacion);
            return (
              <button
                key={recomendacion}
                type="button"
                aria-pressed={activo}
                onClick={() =>
                  onActualizarBloque('recomendaciones', alternarEnLista(borrador.recomendaciones, recomendacion))
                }
              >
                {recomendacion}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">11 · Fotografías</legend>
        <div className="fotos-grid">
          {borrador.fotos.map((foto) => (
            <div key={foto.id} className="fotos-grid__tile">
              foto
            </div>
          ))}
          {borrador.fotos.length < 20 ? (
            <button
              type="button"
              className="fotos-grid__tile fotos-grid__agregar"
              onClick={() =>
                onActualizarBloque('fotos', [...borrador.fotos, { id: `f-${Date.now()}-${borrador.fotos.length}` }])
              }
            >
              + Foto
            </button>
          ) : null}
        </div>
        <p className="fotos-grid__contador">{borrador.fotos.length} / 20 fotos</p>
      </fieldset>

      <fieldset className="compartimento" disabled={cerrada}>
        <legend className="compartimento__titulo">12 · Conformidad del cliente</legend>
        <BloqueFirma conformidad={borrador.conformidad} onCambiar={(v) => onActualizarBloque('conformidad', v)} />
      </fieldset>

      <div className="barra-acciones">
        <Button type="button" variant="secondary" onClick={onGuardarBorrador} disabled={cerrada}>
          Guardar borrador
        </Button>
        <Button type="button" variant="primary" onClick={onCerrarInspeccion} disabled={cerrada}>
          {cerrada ? 'Inspección cerrada' : 'Cerrar inspección'}
        </Button>
      </div>
    </div>
  );
}
