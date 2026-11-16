import type { ReactNode } from 'react';
import './pasos-alta-rapida.css';

const PASOS = ['Cliente', 'Sede', 'Servicio'] as const;

interface Props {
  /** Paso actual, de 1 a 3. */
  paso: 1 | 2 | 3;
  /** Confirmación de lo que se acaba de guardar en el paso anterior. */
  aviso?: string | null;
  /** Salir del alta: lo ya guardado queda guardado. */
  onSalir: () => void;
  /** Formulario del paso (los mismos de alta de cliente, sede y servicio). */
  children: ReactNode;
}

/** Alta rápida encadenada (GAF-99): indicador de paso sobre el formulario de cada etapa, con salida en cualquier momento. */
export function PasosAltaRapida({ paso, aviso = null, onSalir, children }: Props) {
  return (
    <div className="alta-rapida">
      <nav className="alta-rapida__pasos" aria-label="Alta rápida de cliente">
        <span className="alta-rapida__contador">
          Paso {paso} de {PASOS.length}
        </span>
        <ol className="alta-rapida__lista">
          {PASOS.map((nombre, i) => {
            const numero = i + 1;
            const estado = numero < paso ? 'hecho' : numero === paso ? 'actual' : 'pendiente';
            return (
              <li key={nombre} className={`alta-rapida__paso alta-rapida__paso--${estado}`} aria-current={estado === 'actual' ? 'step' : undefined}>
                {nombre}
              </li>
            );
          })}
        </ol>
        <button type="button" className="alta-rapida__salir" onClick={onSalir}>
          Salir del alta rápida
        </button>
      </nav>
      {aviso ? (
        <p className="alta-rapida__aviso" role="status">
          {aviso}
        </p>
      ) : null}
      {children}
    </div>
  );
}
