import type { SemanaServicio } from '../model/dashboard-mock';
import './servicios-por-semana-chart.css';

interface Props {
  datos: SemanaServicio[];
}

const ANCHO = 640;
const ALTO = 220;
const PAD_IZQ = 34;
const PAD_DER = 12;
const PAD_ARRIBA = 16;
const PAD_ABAJO = 28;

/**
 * Barras dobles (programado hueco / ejecutado sólido) a escala real,
 * con eje, ticks y valores rotulados — no un sparkline decorativo.
 */
export function ServiciosPorSemanaChart({ datos }: Props) {
  const maxValor = Math.max(...datos.map((d) => d.programados)) * 1.1;
  const anchoUtil = ANCHO - PAD_IZQ - PAD_DER;
  const altoUtil = ALTO - PAD_ARRIBA - PAD_ABAJO;
  const grupoAncho = anchoUtil / datos.length;
  const barraAncho = grupoAncho * 0.28;

  const y = (valor: number) => PAD_ARRIBA + altoUtil - (valor / maxValor) * altoUtil;
  const ticks = [0, Math.round(maxValor / 2), Math.round(maxValor)];

  return (
    <figure className="semana-chart">
      <figcaption className="semana-chart__title">Servicios ejecutados vs. programados, últimas 6 semanas</figcaption>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Gráfico de barras: servicios ejecutados versus programados por semana">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_IZQ} x2={ANCHO - PAD_DER} y1={y(t)} y2={y(t)} className="semana-chart__gridline" />
            <text x={PAD_IZQ - 8} y={y(t)} className="semana-chart__tick" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        <line x1={PAD_IZQ} x2={PAD_IZQ} y1={PAD_ARRIBA} y2={ALTO - PAD_ABAJO} className="semana-chart__axis" />
        <line x1={PAD_IZQ} x2={ANCHO - PAD_DER} y1={ALTO - PAD_ABAJO} y2={ALTO - PAD_ABAJO} className="semana-chart__axis" />

        {datos.map((d, i) => {
          const cx = PAD_IZQ + grupoAncho * i + grupoAncho / 2;
          const progX = cx - barraAncho - 3;
          const ejecX = cx + 3;
          return (
            <g key={d.semana}>
              <rect
                x={progX}
                y={y(d.programados)}
                width={barraAncho}
                height={ALTO - PAD_ABAJO - y(d.programados)}
                className="semana-chart__barra semana-chart__barra--programado"
              />
              <rect
                x={ejecX}
                y={y(d.ejecutados)}
                width={barraAncho}
                height={ALTO - PAD_ABAJO - y(d.ejecutados)}
                className="semana-chart__barra semana-chart__barra--ejecutado"
              />
              <text x={cx} y={y(d.ejecutados) - 6} className="semana-chart__valor" textAnchor="middle">
                {d.ejecutados}
              </text>
              <text x={cx} y={ALTO - PAD_ABAJO + 16} className="semana-chart__label" textAnchor="middle">
                {d.semana}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="semana-chart__legend">
        <span className="semana-chart__legend-item">
          <i className="semana-chart__swatch semana-chart__swatch--ejecutado" /> Ejecutados
        </span>
        <span className="semana-chart__legend-item">
          <i className="semana-chart__swatch semana-chart__swatch--programado" /> Programados
        </span>
      </div>
    </figure>
  );
}
