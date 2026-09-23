import { useState } from 'react';
import type { TipoEstacion } from '@gafer/contracts';
import { Button } from '../../../shared/ui/atoms/Button';
import { TerrenoCanvas } from './TerrenoCanvas';
import { estacionInicial, type EstadoPlano, type Punto } from '../model/aura';
import { LIMITES_MAPA } from '../model/visitas-mapa';

interface Props {
  proyecto: string;
}

function planoVacio(n: number): EstadoPlano {
  return { id: `plano-${n}`, nombre: n === 1 ? 'Planta baja' : `Plano ${n}`, puntos: [], cerrado: false, estaciones: [] };
}

/**
 * Plano base de un proyecto que todavía no tuvo visitas (§5.5): se traza
 * el terreno y se ubican las estaciones que el técnico instalará en la
 * visita 1. Desde la segunda visita, la base es el último plano trabajado.
 */
export function PlanoBaseEditor({ proyecto }: Props) {
  const [planos, setPlanos] = useState<EstadoPlano[]>([planoVacio(1)]);
  const [activoId, setActivoId] = useState('plano-1');
  const activo = planos.find((p) => p.id === activoId)!;

  function actualizar(cambio: Partial<EstadoPlano>) {
    setPlanos((prev) => prev.map((p) => (p.id === activoId ? { ...p, ...cambio } : p)));
  }

  function agregarEstacion(tipo: TipoEstacion) {
    const numero = activo.estaciones.length + 1;
    const estacion = {
      id: `${activo.id}-e${numero}`,
      numero,
      tipoEstacion: tipo,
      colorIcono: 'VERDE' as const,
      colorAura: 'SIN_COLOR' as const,
    };
    actualizar({ estaciones: [...activo.estaciones, estacionInicial(estacion)] });
  }

  function agregarPlano() {
    const plano = planoVacio(planos.length + 1);
    setPlanos((prev) => [...prev, plano]);
    setActivoId(plano.id);
  }

  const llenoDeEstaciones = activo.estaciones.length >= LIMITES_MAPA.estacionesPorPlano;

  return (
    <>
      <p className="mapa-aviso">
        {proyecto} todavía no tiene visitas de desratización. Arme el plano base: la visita 1 instala estas estaciones y el aura se empieza
        a calcular desde la visita 2, cuando el técnico valida el consumo.
      </p>

      <nav className="mapa-planos" aria-label="Planos del proyecto">
        {planos.map((p) => (
          <button
            type="button"
            key={p.id}
            className={p.id === activoId ? 'mapa-planos__item mapa-planos__item--activo' : 'mapa-planos__item'}
            onClick={() => setActivoId(p.id)}
          >
            {p.nombre}
            <span className="mapa-planos__conteo tabular">{p.estaciones.length}</span>
          </button>
        ))}
        <button
          type="button"
          className="mapa-planos__item"
          onClick={agregarPlano}
          disabled={planos.length >= LIMITES_MAPA.planosPorProyecto}
        >
          + Plano
        </button>
      </nav>

      <div className="mapa-base__acciones">
        <Button variant="secondary" onClick={() => agregarEstacion('CEBO_RATICIDA')} disabled={llenoDeEstaciones}>
          + Cebadero (círculo)
        </Button>
        <Button variant="secondary" onClick={() => agregarEstacion('TRAMPA_MECANICA')} disabled={llenoDeEstaciones}>
          + Otra trampa (cuadrado)
        </Button>
        <span className="mapa-base__limite tabular">
          {activo.estaciones.length}/{LIMITES_MAPA.estacionesPorPlano} estaciones · {planos.length}/{LIMITES_MAPA.planosPorProyecto} planos
        </span>
      </div>

      <p className="mapa-terreno__ayuda">
        Marque el contorno del local punto por punto y vuelva a hacer clic en el primer punto para cerrarlo. Después agregue las estaciones
        y ubíquelas haciendo clic dentro del terreno.
      </p>
      <TerrenoCanvas
        puntos={activo.puntos}
        cerrado={activo.cerrado}
        estaciones={activo.estaciones}
        seleccionadaId={null}
        onAgregarPunto={(punto: Punto) => actualizar({ puntos: [...activo.puntos, punto] })}
        onCerrarTerreno={() => actualizar({ cerrado: true })}
        onDeshacerPunto={() => actualizar({ puntos: activo.puntos.slice(0, -1) })}
        onReabrirTerreno={() => actualizar({ cerrado: false })}
        onLimpiarPlano={() =>
          actualizar({ puntos: [], cerrado: false, estaciones: activo.estaciones.map((e) => ({ ...e, posicion: null })) })
        }
        onColocar={(id, punto) =>
          actualizar({ estaciones: activo.estaciones.map((e) => (e.estacion.id === id ? { ...e, posicion: punto } : e)) })
        }
        onSeleccionar={() => {}}
      />
    </>
  );
}
