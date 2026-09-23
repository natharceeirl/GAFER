import { useState } from 'react';
import { agruparAlertas, type Alerta, type CategoriaAlerta } from '../model/estadisticas';

interface Props {
  alertas: Alerta[];
  onAbrirDocumento: (id: string) => void;
}

/**
 * Alertas activas (§11) resumidas en cinco tarjetas fijas: el espacio no
 * crece con la cantidad de alertas. Cada tarjeta despliega su lista en filas
 * de una línea, con scroll propio.
 */
export function AlertasResumen({ alertas, onAbrirDocumento }: Props) {
  const grupos = agruparAlertas(alertas);
  const [abierta, setAbierta] = useState<CategoriaAlerta | null>(null);
  const grupo = grupos.find((g) => g.categoria === abierta);

  return (
    <div className="alertas">
      <div className="alertas__tarjetas">
        {grupos.map((g) => {
          const vacia = g.alertas.length === 0;
          const clases = [
            'alertas__tarjeta',
            `alertas__tarjeta--${g.severidad}`,
            vacia ? 'alertas__tarjeta--vacia' : '',
            abierta === g.categoria ? 'alertas__tarjeta--abierta' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={g.categoria}
              type="button"
              className={clases}
              aria-expanded={abierta === g.categoria}
              aria-controls="alertas-detalle"
              disabled={vacia}
              onClick={() => setAbierta((prev) => (prev === g.categoria ? null : g.categoria))}
            >
              <b className="tabular">{g.alertas.length}</b>
              <span>{g.titulo}</span>
            </button>
          );
        })}
      </div>

      {grupo ? (
        <div className={`alertas__detalle alertas__detalle--${grupo.severidad}`} id="alertas-detalle">
          <div className="alertas__detalle-cabecera">
            <h3>
              {grupo.titulo} <span className="tabular">({grupo.alertas.length})</span>
            </h3>
            <button type="button" className="alertas__cerrar" onClick={() => setAbierta(null)}>
              Ocultar
            </button>
          </div>
          <ul className="alertas__lista">
            {grupo.alertas.map((a) => (
              <li key={a.id}>
                {a.documentoId ? (
                  <button type="button" className="alertas__fila alertas__fila--accion" onClick={() => onAbrirDocumento(a.documentoId!)}>
                    <span className="alertas__texto">{a.texto}</span>
                    <span className="alertas__detalle-texto" title={a.detalle}>{a.detalle}</span>
                    <span className="alertas__ir" aria-hidden="true">
                      Abrir →
                    </span>
                  </button>
                ) : (
                  <div className="alertas__fila">
                    <span className="alertas__texto">{a.texto}</span>
                    <span className="alertas__detalle-texto" title={a.detalle}>{a.detalle}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
