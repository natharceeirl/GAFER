import { useMemo, useState } from 'react';
import { StationTag } from '../../../shared/ui/molecules/StationTag';
import { TerrenoCanvas } from './TerrenoCanvas';
import { HistorialEstacionPanel } from './HistorialEstacionPanel';
import { estadoDelMapa, resumenDelMapa } from '../model/visitas-mapa';
import type { MapaProyecto } from '../model/mapas-mock';

interface Props {
  mapa: MapaProyecto;
}

const fechaCorta = (f: string) =>
  new Date(`${f}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

const AURAS = [
  { clave: 'SIN_COLOR', texto: 'sin aura' },
  { clave: 'VERDE', texto: 'aura verde' },
  { clave: 'AMARILLO', texto: 'aura amarilla' },
  { clave: 'NARANJA', texto: 'aura naranja' },
  { clave: 'ROJO', texto: 'aura roja' },
] as const;

/**
 * Mapa murino de un proyecto a lo largo de sus visitas (§5). Cada visita
 * muestra el estado con que quedaron las estaciones: la posición la decide
 * el técnico en campo y el aura acompaña a la estación si se reubica.
 */
export function MapaConVisitas({ mapa }: Props) {
  const ultima = mapa.visitas.length - 1;
  const [indice, setIndice] = useState(ultima);
  const [planoId, setPlanoId] = useState(mapa.planos[0].id);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);

  const visita = mapa.visitas[indice];
  const estado = useMemo(() => estadoDelMapa(mapa.visitas, indice), [mapa.visitas, indice]);
  const plano = mapa.planos.find((p) => p.id === planoId) ?? mapa.planos[0];
  const delPlano = estado.filter((e) => e.planoId === plano.id).sort((a, b) => a.estacion.numero - b.estacion.numero);
  const resumen = resumenDelMapa(delPlano, mapa.visitas, indice);
  const seleccionada = delPlano.find((e) => e.estacion.id === seleccionadaId) ?? null;
  const reubicadas = estado.filter((e) => e.reubicadaDesde !== null);
  const nuevas = indice === 0 ? [] : estado.filter((e) => e.instaladaEnVisita);

  function irA(i: number) {
    setIndice(Math.min(ultima, Math.max(0, i)));
  }

  return (
    <>
      <section className="mapa-visitas" aria-label="Visitas del proyecto">
        <div className="mapa-visitas__control">
          <button
            type="button"
            className="mapa-visitas__paso"
            onClick={() => irA(indice - 1)}
            disabled={indice === 0}
            aria-label="Visita anterior"
          >
            ◀
          </button>
          <input
            type="range"
            min={1}
            max={mapa.visitas.length}
            value={indice + 1}
            onChange={(e) => irA(Number(e.target.value) - 1)}
            aria-label="Visita"
            className="mapa-visitas__rango"
          />
          <button
            type="button"
            className="mapa-visitas__paso"
            onClick={() => irA(indice + 1)}
            disabled={indice === ultima}
            aria-label="Visita siguiente"
          >
            ▶
          </button>
        </div>
        <p className="mapa-visitas__actual">
          <strong>
            Visita {indice + 1} de {mapa.visitas.length}
          </strong>{' '}
          · {fechaCorta(visita.fecha)} · {visita.tecnico}
          {indice === 0 ? <span className="mapa-visitas__marca">Instalación: sin evaluación de consumo</span> : null}
          {indice === ultima ? <span className="mapa-visitas__marca mapa-visitas__marca--ultima">Última visita</span> : null}
        </p>
        {indice > 0 ? (
          <p className="mapa-visitas__cambios">
            {reubicadas.length === 0 && nuevas.length === 0
              ? 'Las estaciones quedaron donde estaban.'
              : [
                  reubicadas.length > 0
                    ? `${reubicadas.length} ${reubicadas.length === 1 ? 'estación reubicada' : 'estaciones reubicadas'}`
                    : '',
                  nuevas.length > 0 ? `${nuevas.length} ${nuevas.length === 1 ? 'estación nueva' : 'estaciones nuevas'}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ') + ' en esta visita (todos los planos).'}
          </p>
        ) : null}
      </section>

      <nav className="mapa-planos" aria-label="Planos del proyecto">
        {mapa.planos.map((p) => (
          <button
            type="button"
            key={p.id}
            className={p.id === plano.id ? 'mapa-planos__item mapa-planos__item--activo' : 'mapa-planos__item'}
            onClick={() => {
              setPlanoId(p.id);
              setSeleccionadaId(null);
            }}
          >
            {p.nombre}
            <span className="mapa-planos__conteo tabular">{estado.filter((e) => e.planoId === p.id).length}</span>
          </button>
        ))}
      </nav>

      <section className="mapa-leyenda">
        <p>
          <strong>Ícono</strong> = estado de esta visita (verde sin consumo, rojo con consumo). <strong>Aura</strong> = tendencia de las
          últimas 4 inspecciones: sube o baja un nivel por visita y se cuenta desde la visita siguiente a la instalación. En azul punteado:{' '}
          <strong>flecha</strong> desde donde se reubicó una estación y <strong>anillo</strong> en las instaladas en esta visita.
        </p>
      </section>

      <div className="mapa-page__lienzo-fila">
        <TerrenoCanvas
          puntos={plano.puntos}
          cerrado
          estaciones={delPlano.map((e) => ({ estacion: e.estacion, historial: e.historial, posicion: e.posicion }))}
          seleccionadaId={seleccionadaId}
          soloLectura
          reubicaciones={delPlano.flatMap((e) => (e.reubicadaDesde ? [{ id: e.estacion.id, desde: e.reubicadaDesde }] : []))}
          nuevas={indice === 0 ? [] : delPlano.filter((e) => e.instaladaEnVisita).map((e) => e.estacion.id)}
          onAgregarPunto={() => {}}
          onCerrarTerreno={() => {}}
          onDeshacerPunto={() => {}}
          onReabrirTerreno={() => {}}
          onLimpiarPlano={() => {}}
          onColocar={() => {}}
          onSeleccionar={setSeleccionadaId}
        />
        {seleccionada ? (
          <HistorialEstacionPanel
            estacion={seleccionada.estacion}
            historial={seleccionada.historial}
            reubicaciones={seleccionada.reubicaciones}
            instaladaEnVisita={seleccionada.instaladaEnVisita}
            onCerrar={() => setSeleccionadaId(null)}
          />
        ) : null}
      </div>

      <section className="mapa-tabla" aria-label={`Resumen de ${plano.nombre}`}>
        <dl className="mapa-tabla__datos">
          <div>
            <dt>Estaciones</dt>
            <dd className="tabular">{resumen.estaciones}</dd>
          </div>
          <div>
            <dt>Círculos · cebo raticida</dt>
            <dd className="tabular">{resumen.circulos}</dd>
          </div>
          <div>
            <dt>Cuadrados · otra trampa</dt>
            <dd className="tabular">{resumen.cuadrados}</dd>
          </div>
          <div>
            <dt>Ícono verde / rojo</dt>
            <dd className="tabular">
              {resumen.icono.VERDE} / {resumen.icono.ROJO}
            </dd>
          </div>
          <div>
            <dt>Período de la data</dt>
            <dd className="tabular">
              {fechaCorta(resumen.desde)} – {fechaCorta(resumen.hasta)}
            </dd>
          </div>
        </dl>
        <div className="mapa-resumen">
          {AURAS.map((a) => (
            <div
              key={a.clave}
              className={`mapa-resumen__item mapa-resumen__item--${a.clave === 'SIN_COLOR' ? 'sin-color' : a.clave.toLowerCase()}`}
            >
              <span className="tabular">{resumen.aura[a.clave]}</span>
              <small>{a.texto}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="mapa-grid" aria-label={`Estaciones de ${plano.nombre}: seleccione una para ver su historial`}>
        {delPlano.map((e) => (
          <button
            type="button"
            key={e.estacion.id}
            className={e.estacion.id === seleccionadaId ? 'mapa-grid__item mapa-grid__item--activo' : 'mapa-grid__item'}
            onClick={() => setSeleccionadaId(e.estacion.id)}
          >
            <StationTag estacion={e.estacion} />
            {e.reubicadaDesde ? <span className="mapa-grid__marca">reubicada</span> : null}
            {indice > 0 && e.instaladaEnVisita ? <span className="mapa-grid__marca">nueva</span> : null}
          </button>
        ))}
      </section>
    </>
  );
}
