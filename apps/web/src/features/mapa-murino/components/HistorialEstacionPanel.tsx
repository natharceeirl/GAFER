import type { Estacion } from '@gafer/contracts';
import { Badge } from '../../../shared/ui/atoms/Badge';
import type { InspeccionRegistrada } from '../model/aura';
import './historial-estacion-panel.css';

interface HistorialEstacionPanelProps {
  estacion: Estacion;
  historial: InspeccionRegistrada[];
  onCerrar: () => void;
}

const TIPO_ESTACION: Record<Estacion['tipoEstacion'], string> = {
  CEBO_RATICIDA: 'Cebo raticida',
  TRAMPA_MECANICA: 'Trampa mecánica',
};

/**
 * Vista digital de una estación (§5.6): últimas 3 inspecciones. En la web
 * es solo consulta; las inspecciones se registran desde la app Android
 * (decisión C11).
 */
export function HistorialEstacionPanel({ estacion, historial, onCerrar }: HistorialEstacionPanelProps) {
  const ultimasTres = historial.slice(-3).reverse();

  return (
    <aside className="historial-panel" aria-label={`Estación número ${estacion.numero}`}>
      <div className="historial-panel__cabecera">
        <div>
          <span className="historial-panel__numero">
            ESTACIÓN N.° {estacion.numero} · {TIPO_ESTACION[estacion.tipoEstacion].toUpperCase()}
          </span>
          <div className="historial-panel__estados">
            <Badge color={estacion.colorAura}>
              {estacion.colorAura === 'SIN_COLOR' ? 'sin aura' : `aura ${estacion.colorAura.toLowerCase()}`}
            </Badge>
            <span className={`historial-panel__icono historial-panel__icono--${estacion.colorIcono.toLowerCase()}`}>
              ícono {estacion.colorIcono.toLowerCase()}
            </span>
          </div>
        </div>
        <button type="button" className="historial-panel__cerrar" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <section className="historial-panel__lista">
        <h3>Últimas inspecciones</h3>
        {ultimasTres.length === 0 ? (
          <p className="historial-panel__vacio">Sin inspecciones registradas todavía en esta estación.</p>
        ) : (
          <ul>
            {ultimasTres.map((insp, i) => (
              <li key={`${insp.fecha}-${i}`}>
                <div className="historial-panel__fila">
                  <span className="tabular">{insp.fecha}</span>
                  <span className={insp.huboConsumo ? 'historial-panel__consumo--si' : 'historial-panel__consumo--no'}>
                    {insp.huboConsumo ? `consumo ${insp.porcentajeConsumo}%` : 'sin consumo'}
                  </span>
                </div>
                <span className="historial-panel__detalle">
                  {insp.tipoCebo} · {insp.cantidadGramos} g · lote {insp.lote}
                  {insp.huboConsumo
                    ? insp.cantidadReposicion !== undefined
                      ? ` · repuso ${insp.cantidadReposicion} g`
                      : ''
                    : ` · ${insp.estadoFisico === 'MALAS_CONDICIONES' ? 'malas condiciones' : 'buenas condiciones'}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="historial-panel__nota">Las inspecciones se registran desde la app Android de los técnicos.</p>
    </aside>
  );
}
