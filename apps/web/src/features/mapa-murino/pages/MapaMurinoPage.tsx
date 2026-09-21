import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { StationTag } from '../../../shared/ui/molecules/StationTag';
import { ESTACIONES_PLANTA_KALLPA, resumenPorAura } from '../model/estaciones-mock';
import './mapa-murino-page.css';

export function MapaMurinoPage() {
  const estaciones = ESTACIONES_PLANTA_KALLPA;
  const resumen = resumenPorAura(estaciones);

  return (
    <div className="mapa-page">
      <TicketHeader
        code={`${estaciones.length} estaciones`}
        title="Plano de KALLPA · PLANTA"
        meta="Mapa Murino Dinámico — programa quincenal de roedores"
      />

      <div className="mapa-page__body">
        <section className="mapa-resumen" aria-label="Resumen por color de aura">
          <div className="mapa-resumen__item mapa-resumen__item--sin-color">
            <span className="tabular">{resumen.SIN_COLOR}</span>
            <small>sin aura</small>
          </div>
          <div className="mapa-resumen__item mapa-resumen__item--verde">
            <span className="tabular">{resumen.VERDE}</span>
            <small>aura verde</small>
          </div>
          <div className="mapa-resumen__item mapa-resumen__item--amarillo">
            <span className="tabular">{resumen.AMARILLO}</span>
            <small>aura amarilla</small>
          </div>
          <div className="mapa-resumen__item mapa-resumen__item--naranja">
            <span className="tabular">{resumen.NARANJA}</span>
            <small>aura naranja</small>
          </div>
          <div className="mapa-resumen__item mapa-resumen__item--rojo">
            <span className="tabular">{resumen.ROJO}</span>
            <small>aura roja</small>
          </div>
        </section>

        <section className="mapa-leyenda">
          <p>
            <strong>Ícono</strong> = estado de la última inspección (verde sin consumo, rojo con consumo). <strong>Aura</strong> = tendencia
            acumulada de las últimas 4 inspecciones — sube o baja exactamente un nivel por visita. Son dos capas independientes.
          </p>
        </section>

        <section className="mapa-grid" aria-label="Estaciones del plano">
          {estaciones.map((estacion) => (
            <StationTag key={estacion.id} estacion={estacion} />
          ))}
        </section>
      </div>
    </div>
  );
}
