import { useState } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { StationTag } from '../../../shared/ui/molecules/StationTag';
import { FoldPanel } from '../../../shared/ui/molecules/FoldPanel';
import { TerrenoCanvas } from '../components/TerrenoCanvas';
import { InspeccionEstacionPanel } from '../components/InspeccionEstacionPanel';
import { PLANOS_MOCK, ESTACIONES_POR_PLANO, resumenPorAura } from '../model/estaciones-mock';
import { calcularSiguienteAura, estacionInicial, type EstadoPlano, type InspeccionRegistrada, type Punto } from '../model/aura';
import './mapa-murino-page.css';

function planosIniciales(): EstadoPlano[] {
  return PLANOS_MOCK.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    puntos: [],
    cerrado: false,
    estaciones: ESTACIONES_POR_PLANO[p.id].map(estacionInicial),
  }));
}

export function MapaMurinoPage() {
  // Un EstadoPlano por plano del proyecto — terreno y estaciones son
  // independientes entre planos (spec §5.5, "hasta 20 planos por
  // proyecto"; un edificio con pisos/habitaciones es varios planos,
  // no subdivisiones dentro de uno solo).
  const [planos, setPlanos] = useState<EstadoPlano[]>(planosIniciales);
  const [planoActivoId, setPlanoActivoId] = useState(PLANOS_MOCK[0].id);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);

  const planoActivo = planos.find((p) => p.id === planoActivoId)!;
  const resumen = resumenPorAura(planoActivo.estaciones.map((e) => e.estacion));
  const seleccionada = planoActivo.estaciones.find((e) => e.estacion.id === seleccionadaId) ?? null;

  function actualizarPlanoActivo(cambio: Partial<EstadoPlano>) {
    setPlanos((prev) => prev.map((p) => (p.id === planoActivoId ? { ...p, ...cambio } : p)));
  }

  function cambiarPlano(id: string) {
    setPlanoActivoId(id);
    setSeleccionadaId(null);
  }

  function colocarEnPlano(id: string, punto: Punto | null) {
    actualizarPlanoActivo({
      estaciones: planoActivo.estaciones.map((e) => (e.estacion.id === id ? { ...e, posicion: punto } : e)),
    });
  }

  function registrarInspeccion(id: string, inspeccion: InspeccionRegistrada) {
    actualizarPlanoActivo({
      estaciones: planoActivo.estaciones.map((e) => {
        if (e.estacion.id !== id) return e;
        return {
          ...e,
          estacion: {
            ...e.estacion,
            colorIcono: inspeccion.huboConsumo ? 'ROJO' : 'VERDE',
            colorAura: calcularSiguienteAura(e.estacion.colorAura, inspeccion.huboConsumo),
          },
          historial: [...e.historial, inspeccion],
        };
      }),
    });
  }

  return (
    <div className="mapa-page">
      <TicketHeader
        code={`${planoActivo.estaciones.length} estaciones`}
        title={`Plano de KALLPA · ${planoActivo.nombre.toUpperCase()}`}
        meta="Mapa Murino Dinámico — programa quincenal de roedores"
      />

      <div className="mapa-page__body">
        <nav className="mapa-planos" aria-label="Planos del proyecto">
          {planos.map((plano) => (
            <button
              type="button"
              key={plano.id}
              className={plano.id === planoActivoId ? 'mapa-planos__item mapa-planos__item--activo' : 'mapa-planos__item'}
              onClick={() => cambiarPlano(plano.id)}
            >
              {plano.nombre}
              <span className="mapa-planos__conteo tabular">{plano.estaciones.length}</span>
            </button>
          ))}
        </nav>

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

        <FoldPanel label={`Trazar terreno — ${planoActivo.nombre}`} defaultOpen>
          <p className="mapa-terreno__ayuda">
            Marcá el contorno del local punto por punto — cada toque agrega un vértice. Volvé a tocar el primer punto para cerrar el
            terreno. Las estaciones se ubican sobre este plano una vez definido. Cada plano de la lista de arriba tiene su propio
            terreno y sus propias estaciones.
          </p>
          <div className="mapa-page__lienzo-fila">
            <TerrenoCanvas
              puntos={planoActivo.puntos}
              cerrado={planoActivo.cerrado}
              estaciones={planoActivo.estaciones}
              seleccionadaId={seleccionadaId}
              onAgregarPunto={(punto) => actualizarPlanoActivo({ puntos: [...planoActivo.puntos, punto] })}
              onCerrarTerreno={() => actualizarPlanoActivo({ cerrado: true })}
              onDeshacerPunto={() => actualizarPlanoActivo({ puntos: planoActivo.puntos.slice(0, -1) })}
              onReabrirTerreno={() => actualizarPlanoActivo({ cerrado: false })}
              onLimpiarPlano={() =>
                actualizarPlanoActivo({
                  puntos: [],
                  cerrado: false,
                  estaciones: planoActivo.estaciones.map((e) => ({ ...e, posicion: null })),
                })
              }
              onColocar={colocarEnPlano}
              onSeleccionar={setSeleccionadaId}
            />
            {seleccionada ? (
              <InspeccionEstacionPanel
                estacion={seleccionada.estacion}
                historial={seleccionada.historial}
                onRegistrar={(inspeccion) => registrarInspeccion(seleccionada.estacion.id, inspeccion)}
                onCerrar={() => setSeleccionadaId(null)}
              />
            ) : null}
          </div>
        </FoldPanel>

        <section
          className="mapa-grid"
          aria-label={`Estaciones de ${planoActivo.nombre} — tocá una para ver su historial y registrar una inspección`}
        >
          {planoActivo.estaciones.map(({ estacion }) => (
            <button
              type="button"
              key={estacion.id}
              className={estacion.id === seleccionadaId ? 'mapa-grid__item mapa-grid__item--activo' : 'mapa-grid__item'}
              onClick={() => setSeleccionadaId(estacion.id)}
            >
              <StationTag estacion={estacion} />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
