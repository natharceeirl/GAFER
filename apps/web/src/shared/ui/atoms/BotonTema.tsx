import { opuesto, useTema } from '../../lib/tema';
import './boton-tema.css';

/** Cambia entre modo claro y oscuro. La etiqueta dice a qué modo se pasa. */
export function BotonTema() {
  const { tema, alternar } = useTema();
  const destino = opuesto(tema);

  return (
    <button type="button" className="boton-tema" onClick={alternar} aria-label={`Cambiar a modo ${destino}`}>
      {destino === 'claro' ? (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M15.5 12.6A6.6 6.6 0 0 1 7.4 4.5a6.6 6.6 0 1 0 8.1 8.1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )}
      <span>Modo {destino}</span>
    </button>
  );
}
