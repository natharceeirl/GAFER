import { useId, useState } from 'react';
import { MOTIVO_MINIMO_CARACTERES } from '@gafer/contracts';
import { Button } from '../../../shared/ui/atoms/Button';
import { Campo, ariaError } from '../../../shared/ui/molecules/FormFields';
import './dialogo-estado-trabajo.css';

interface Props {
  /** Título del diálogo, que también lo nombra para el lector de pantalla (ej. "Cancelar servicio DRT en PLANTA_NORTE"). */
  titulo: string;
  /** Texto del botón que confirma (ej. "Confirmar cancelación"). */
  confirmar: string;
  enviando: boolean;
  /** Error del servidor sobre el motivo. */
  errorMotivo?: string;
  /** Error del servidor que no es del motivo. */
  errorGeneral?: string | null;
  onConfirmar: (motivo: string) => void;
  onVolver: () => void;
}

/**
 * Confirmación con motivo obligatorio para cancelar o reabrir un servicio (GAF-99). Se muestra dentro del
 * servicio, junto a sus botones, para no perder de vista a qué servicio se aplica.
 */
export function DialogoEstadoTrabajo({ titulo, confirmar, enviando, errorMotivo, errorGeneral = null, onConfirmar, onVolver }: Props) {
  const id = useId();
  const [motivo, setMotivo] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | undefined>(undefined);
  const error = errorLocal ?? errorMotivo;

  function enviar() {
    const texto = motivo.trim();
    if (texto.length < MOTIVO_MINIMO_CARACTERES) {
      setErrorLocal(`Indique un motivo de al menos ${MOTIVO_MINIMO_CARACTERES} caracteres.`);
      return;
    }
    setErrorLocal(undefined);
    onConfirmar(texto);
  }

  return (
    <div className="dialogo-estado" role="dialog" aria-labelledby={`${id}-titulo`}>
      <p id={`${id}-titulo`} className="dialogo-estado__titulo">
        {titulo}
      </p>
      {errorGeneral && !error ? (
        <p className="dialogo-estado__error" role="alert">
          {errorGeneral}
        </p>
      ) : null}
      <Campo id={`${id}-motivo`} label="Motivo" error={error} ayuda="Queda registrado en la bitácora de auditoría." ancho="completo">
        <textarea
          {...ariaError(`${id}-motivo`, error)}
          rows={2}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setErrorLocal(undefined);
          }}
        />
      </Campo>
      <div className="dialogo-estado__acciones">
        <Button type="button" onClick={enviar} disabled={enviando}>
          {confirmar}
        </Button>
        <Button type="button" variant="secondary" onClick={onVolver} disabled={enviando}>
          Volver
        </Button>
      </div>
    </div>
  );
}
