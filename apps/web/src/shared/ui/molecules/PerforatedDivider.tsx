import './perforated-divider.css';

/**
 * Línea de perforación entre filas de una lista — "aquí se separa un
 * pase del siguiente", como una hoja de tickets pre-cortados.
 */
export function PerforatedDivider() {
  return <div className="perforated-divider" role="separator" aria-hidden="true" />;
}
