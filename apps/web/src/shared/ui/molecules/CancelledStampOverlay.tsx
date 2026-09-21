import './cancelled-stamp-overlay.css';

interface CancelledStampOverlayProps {
  texto?: string;
}

/**
 * El sello diagonal de "OBSERVADO" — atraviesa todo el documento sin
 * ocultarlo, como un sello real que anula sin borrar lo que está
 * debajo. Se monta absoluto sobre un contenedor con position:relative.
 */
export function CancelledStampOverlay({ texto = 'OBSERVADO' }: CancelledStampOverlayProps) {
  return (
    <div className="cancelled-stamp-overlay" aria-hidden="true">
      <span className="cancelled-stamp-overlay__banda">
        {texto} · {texto} · {texto}
      </span>
    </div>
  );
}
