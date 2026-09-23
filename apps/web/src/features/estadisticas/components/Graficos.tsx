import type { ReactNode } from 'react';
import './graficos.css';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/** "2026-09" → "set"; en enero agrega el año para que el cambio de año se lea. */
export function etiquetaMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `ene ${String(a).slice(2)}` : MESES[m - 1];
}

/** Máximo "redondo" del eje (1, 2, 2.5, 5 × 10ⁿ) para que los ticks sean legibles. */
export function escalaMax(valor: number): number {
  if (valor <= 0) return 1;
  const magnitud = 10 ** Math.floor(Math.log10(valor));
  return ([1, 2, 2.5, 5, 10].map((p) => p * magnitud).find((c) => c >= valor) ?? 10 * magnitud);
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

interface TarjetaProps {
  titulo: string;
  ayuda?: string;
  filtros?: ReactNode;
  ancho?: 'completo';
  children: ReactNode;
}

/** Contenedor de cada estadística: título, filtros propios (§11, "filtros interactivos") y contenido. */
export function Tarjeta({ titulo, ayuda, filtros, ancho, children }: TarjetaProps) {
  return (
    <section className={ancho === 'completo' ? 'graf-tarjeta graf-tarjeta--completo' : 'graf-tarjeta'}>
      <header className="graf-tarjeta__cabecera">
        <div>
          <h3>{titulo}</h3>
          {ayuda ? <p>{ayuda}</p> : null}
        </div>
        {filtros ? <div className="graf-filtros">{filtros}</div> : null}
      </header>
      {children}
    </section>
  );
}

interface FiltroProps {
  id: string;
  etiqueta: string;
  valor: string;
  opciones: Array<{ valor: string; texto: string }>;
  onCambiar: (valor: string) => void;
}

export function Filtro({ id, etiqueta, valor, opciones, onCambiar }: FiltroProps) {
  return (
    <label className="graf-filtro" htmlFor={id}>
      <span>{etiqueta}</span>
      <select id={id} value={valor} onChange={(e) => onCambiar(e.target.value)}>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

const W = 640;
const H = 230;
const IZQ = 36;
const DER = 10;
const ARR = 18;
const ABA = 28;

function Eje({ max, children }: { max: number; children: ReactNode }) {
  const alto = H - ARR - ABA;
  const y = (v: number) => ARR + alto - (v / max) * alto;
  const ticks = [0, max / 2, max];
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={IZQ} x2={W - DER} y1={y(t)} y2={y(t)} className="graf-grilla" />
          <text x={IZQ - 6} y={y(t)} className="graf-tick" textAnchor="end" dominantBaseline="middle">
            {fmt(t)}
          </text>
        </g>
      ))}
      <line x1={IZQ} x2={W - DER} y1={H - ABA} y2={H - ABA} className="graf-eje" />
      {children}
    </>
  );
}

interface BarrasAgrupadasProps {
  datos: Array<{ mes: string; programados: number; ejecutados: number }>;
  descripcion: string;
}

/** Programados (hueco, punteado) vs. ejecutados (sólido) por mes (§10.1, barras agrupadas). */
export function BarrasAgrupadas({ datos, descripcion }: BarrasAgrupadasProps) {
  const max = escalaMax(Math.max(1, ...datos.map((d) => d.programados)));
  const alto = H - ARR - ABA;
  const y = (v: number) => ARR + alto - (v / max) * alto;
  const grupo = (W - IZQ - DER) / datos.length;
  const barra = Math.min(22, grupo * 0.3);
  return (
    <figure className="graf">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descripcion}>
        <Eje max={max}>
          {datos.map((d, i) => {
            const cx = IZQ + grupo * i + grupo / 2;
            return (
              <g key={d.mes}>
                <rect x={cx - barra - 2} y={y(d.programados)} width={barra} height={H - ABA - y(d.programados)} className="graf-barra graf-barra--hueca" />
                <rect x={cx + 2} y={y(d.ejecutados)} width={barra} height={H - ABA - y(d.ejecutados)} className="graf-barra graf-barra--marca" />
                <text x={cx + 2 + barra / 2} y={y(d.ejecutados) - 5} className="graf-valor" textAnchor="middle">
                  {d.ejecutados}
                </text>
                <text x={cx} y={H - ABA + 16} className="graf-tick" textAnchor="middle">
                  {etiquetaMes(d.mes)}
                </text>
              </g>
            );
          })}
        </Eje>
      </svg>
      <figcaption className="graf-leyenda">
        <span>
          <i className="graf-muestra graf-muestra--marca" /> Ejecutados
        </span>
        <span>
          <i className="graf-muestra graf-muestra--hueca" /> Programados
        </span>
      </figcaption>
    </figure>
  );
}

interface BarrasHorizontalesProps {
  datos: Array<{ etiqueta: string; detalle?: string; valor: number }>;
  vacio: string;
}

/** Barras horizontales con el valor rotulado (§10.1: servicios por tipo y por técnico). */
export function BarrasHorizontales({ datos, vacio }: BarrasHorizontalesProps) {
  if (datos.length === 0) return <p className="graf-vacio">{vacio}</p>;
  const max = Math.max(...datos.map((d) => d.valor));
  return (
    <ul className="graf-hbarras">
      {datos.map((d) => (
        <li key={d.etiqueta}>
          <span className="graf-hbarras__etiqueta">
            {d.etiqueta}
            {d.detalle ? <small>{d.detalle}</small> : null}
          </span>
          <span className="graf-hbarras__pista">
            <span className="graf-hbarras__barra" style={{ width: `${(d.valor / max) * 100}%` }} />
          </span>
          <span className="graf-hbarras__valor tabular">{d.valor}</span>
        </li>
      ))}
    </ul>
  );
}

const COLORES_SERIE = ['var(--gf-marca)', 'var(--gf-info)', 'var(--gf-hoja)', 'var(--gf-ink-soft)'];

interface BarrasApiladasProps {
  datos: Array<{ mes: string; porTipo: Partial<Record<string, number>> }>;
  unidad: string;
  descripcion: string;
}

/** Consumo por mes apilado por tipo de servicio (§10.1, barras apiladas). */
export function BarrasApiladas({ datos, unidad, descripcion }: BarrasApiladasProps) {
  const series = [...new Set(datos.flatMap((d) => Object.keys(d.porTipo)))].sort();
  const total = (d: (typeof datos)[number]) => series.reduce((s, k) => s + (d.porTipo[k] ?? 0), 0);
  const max = escalaMax(Math.max(0, ...datos.map(total)));
  const alto = H - ARR - ABA;
  const escala = (v: number) => (v / max) * alto;
  const grupo = (W - IZQ - DER) / datos.length;
  const barra = Math.min(34, grupo * 0.5);
  return (
    <figure className="graf">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descripcion}>
        <Eje max={max}>
          {datos.map((d, i) => {
            const cx = IZQ + grupo * i + grupo / 2;
            let base = H - ABA;
            const suma = total(d);
            return (
              <g key={d.mes}>
                {series.map((s, k) => {
                  const h = escala(d.porTipo[s] ?? 0);
                  base -= h;
                  return h > 0 ? <rect key={s} x={cx - barra / 2} y={base} width={barra} height={h} style={{ fill: COLORES_SERIE[k % COLORES_SERIE.length] }} /> : null;
                })}
                {suma > 0 ? (
                  <text x={cx} y={H - ABA - escala(suma) - 5} className="graf-valor" textAnchor="middle">
                    {fmt(suma)}
                  </text>
                ) : null}
                <text x={cx} y={H - ABA + 16} className="graf-tick" textAnchor="middle">
                  {etiquetaMes(d.mes)}
                </text>
              </g>
            );
          })}
        </Eje>
      </svg>
      <figcaption className="graf-leyenda">
        {series.length === 0 ? <span>Sin consumo en el período.</span> : null}
        {series.map((s, k) => (
          <span key={s}>
            <i className="graf-muestra" style={{ background: COLORES_SERIE[k % COLORES_SERIE.length] }} /> {s}
          </span>
        ))}
        <span className="graf-leyenda__unidad">Cantidades en {unidad}</span>
      </figcaption>
    </figure>
  );
}
