import { Button } from '../../../shared/ui/atoms/Button';

/** Aviso de que una consulta al API está en curso. */
export function EstadoCargando({ mensaje }: { mensaje: string }) {
  return (
    <p className="clientes-page__vacio" role="status">
      {mensaje}
    </p>
  );
}

/** Error de una consulta al API, con la salida de reintentar. */
export function EstadoError({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="clientes-page__error" role="alert">
      <p>{mensaje}</p>
      <Button type="button" variant="secondary" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}
