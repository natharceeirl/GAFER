import type { Estacion } from '@gafer/contracts';
import { StationTag } from '../../../shared/ui/molecules/StationTag';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { Button } from '../../../shared/ui/atoms/Button';
import type { RegistroHistorialEstacion, VisitaActualEstacion, PorcentajeConsumo } from '../model/tipos';
import './EstacionDetailSheet.css';

const PORCENTAJES: PorcentajeConsumo[] = ['0', '25', '50', '75', '100'];

interface EstacionDetailSheetProps {
  estacion: Estacion;
  historial: RegistroHistorialEstacion[];
  tiposCebo: string[];
  visitaActual: VisitaActualEstacion;
  onCambiarVisita: (visita: VisitaActualEstacion) => void;
  onGuardarInspeccion: () => void;
  onCerrar: () => void;
}

/**
 * Ficha de una estación durante una inspección de roedores — se abre
 * como una hoja inferior sobre el plano. El ícono de la etiqueta es el
 * estado de la última visita; el aura que inunda la tarjeta es la
 * tendencia de las últimas 4 visitas (ver StationTag).
 */
export function EstacionDetailSheet({
  estacion,
  historial,
  tiposCebo,
  visitaActual,
  onCambiarVisita,
  onGuardarInspeccion,
  onCerrar,
}: EstacionDetailSheetProps) {
  const sinConsumo = visitaActual.porcentajeConsumo === '0';

  return (
    <div className="estacion-hoja">
      <div className="estacion-hoja__cabecera">
        <StationTag estacion={estacion} />
        <button type="button" className="estacion-hoja__cerrar" onClick={onCerrar} aria-label="Cerrar ficha de estación">
          Cerrar
        </button>
      </div>

      <section className="estacion-hoja__seccion">
        <h2 className="estacion-hoja__titulo">Historial (últimas {historial.length} inspecciones)</h2>
        <div className="historial-lista">
          {historial.map((registro, indice) => (
            <div key={registro.fecha}>
              <div className="historial-fila">
                <span className="historial-fila__fecha tabular">{registro.fecha}</span>
                <span>{registro.tipoCebo}</span>
                <span className="tabular">
                  {registro.cantidadConsumida}/{registro.cantidadColocada} consumido
                </span>
                <span className="historial-fila__estado">
                  {registro.estadoFisico === 'BUENAS_CONDICIONES' ? 'buenas condiciones' : 'malas condiciones'}
                </span>
              </div>
              {registro.observaciones ? (
                <p className="historial-fila__obs">{registro.observaciones}</p>
              ) : null}
              {indice < historial.length - 1 ? <PerforatedDivider /> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="estacion-hoja__seccion">
        <h2 className="estacion-hoja__titulo">Visita actual</h2>
        <div className="compartimento">
          <select
            aria-label="Tipo de cebo"
            value={visitaActual.tipoCebo}
            onChange={(event) => onCambiarVisita({ ...visitaActual, tipoCebo: event.target.value })}
          >
            <option value="">Tipo de cebo…</option>
            {tiposCebo.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>

          <fieldset className="estacion-hoja__porcentaje">
            <legend>Porcentaje de consumo</legend>
            <div className="chip-lista">
              {PORCENTAJES.map((valor) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={visitaActual.porcentajeConsumo === valor}
                  onClick={() => onCambiarVisita({ ...visitaActual, porcentajeConsumo: valor })}
                >
                  {valor}%
                </button>
              ))}
            </div>
          </fieldset>

          {sinConsumo ? (
            <div className="estacion-hoja__estado-sin-consumo">
              <fieldset>
                <legend>Estado de la estación</legend>
                <div className="chip-lista">
                  <button
                    type="button"
                    aria-pressed={visitaActual.estadoSiNoConsumo === 'BUENAS_CONDICIONES'}
                    onClick={() => onCambiarVisita({ ...visitaActual, estadoSiNoConsumo: 'BUENAS_CONDICIONES' })}
                  >
                    Buenas condiciones
                  </button>
                  <button
                    type="button"
                    aria-pressed={visitaActual.estadoSiNoConsumo === 'MALAS_CONDICIONES'}
                    onClick={() => onCambiarVisita({ ...visitaActual, estadoSiNoConsumo: 'MALAS_CONDICIONES' })}
                  >
                    Malas condiciones
                  </button>
                </div>
              </fieldset>
              {visitaActual.estadoSiNoConsumo === 'MALAS_CONDICIONES' ? (
                <div className="checkbox-lista">
                  {(['agua', 'polvo', 'calor'] as const).map((problema) => (
                    <label key={problema}>
                      <input
                        type="checkbox"
                        checked={visitaActual.problemas[problema]}
                        onChange={(event) =>
                          onCambiarVisita({
                            ...visitaActual,
                            problemas: { ...visitaActual.problemas, [problema]: event.target.checked },
                          })
                        }
                      />
                      {problema}
                    </label>
                  ))}
                </div>
              ) : null}
              <input
                aria-label="Cantidad repuesta"
                className="tabular"
                inputMode="decimal"
                placeholder="Cantidad repuesta"
                value={visitaActual.cantidadRepuesta}
                onChange={(event) => onCambiarVisita({ ...visitaActual, cantidadRepuesta: event.target.value })}
              />
            </div>
          ) : null}
        </div>
      </section>

      <div className="barra-acciones">
        <Button type="button" variant="primary" onClick={onGuardarInspeccion}>
          Guardar inspección de estación
        </Button>
      </div>
    </div>
  );
}
