import type { Estacion } from '@gafer/contracts';
import './station-tag.css';

const AURA_A_CLASE: Record<Estacion['colorAura'], string> = {
  SIN_COLOR: 'station-tag--sin-color',
  VERDE: 'station-tag--verde',
  AMARILLO: 'station-tag--amarillo',
  NARANJA: 'station-tag--naranja',
  ROJO: 'station-tag--rojo',
};

interface StationTagProps {
  estacion: Estacion;
}

/**
 * La estación de campo, como la etiqueta física numerada de un
 * cebadero: el ícono es el estado de la última visita (VERDE/ROJO),
 * el aura de tendencia inunda toda la tarjeta en un color sólido —
 * nunca un acento tenue — para que una escalada se note sin leer texto.
 */
export function StationTag({ estacion }: StationTagProps) {
  const formaClase = estacion.tipoEstacion === 'CEBO_RATICIDA' ? '' : ' station-tag__icono--cuadrado';

  return (
    <div className={`station-tag ${AURA_A_CLASE[estacion.colorAura]}`}>
      <span className={`station-tag__icono station-tag__icono--${estacion.colorIcono.toLowerCase()}${formaClase}`}>
        {estacion.numero}
      </span>
      <span className="station-tag__label">
        {estacion.colorAura === 'SIN_COLOR' ? 'sin tendencia' : `aura ${estacion.colorAura.toLowerCase()}`}
      </span>
    </div>
  );
}
