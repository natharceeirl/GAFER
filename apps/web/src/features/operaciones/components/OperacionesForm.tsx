import { Button } from '../../../shared/ui/atoms/Button';
import { Badge } from '../../../shared/ui/atoms/Badge';

export interface OperacionesFormProps {
  estadoRemoto: 'BORRADOR' | 'CERRADO' | null;
  observaciones: string;
  onIniciar: () => void;
  onCambiarObservaciones: (valor: string) => void;
}

/**
 * Presentacional: solo recibe props, no conoce el store local ni el
 * cache de servidor. Testeable sin mockear red ni IndexedDB.
 */
export function OperacionesForm({
  estadoRemoto,
  observaciones,
  onIniciar,
  onCambiarObservaciones,
}: OperacionesFormProps) {
  return (
    <section>
      <h2>Formulario de campo — Operaciones</h2>
      {estadoRemoto ? (
        <Badge color={estadoRemoto === 'CERRADO' ? 'ROJO' : 'VERDE'}>{estadoRemoto}</Badge>
      ) : null}
      <div>
        <Button type="button" onClick={onIniciar}>
          Iniciar inspección
        </Button>
      </div>
      <textarea
        value={observaciones}
        onChange={(event) => onCambiarObservaciones(event.target.value)}
        placeholder="Observaciones técnicas"
      />
    </section>
  );
}
