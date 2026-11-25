import { Button } from '../../../shared/ui/atoms/Button';
import { ErrorApi } from '../../../shared/api/errores';
import './estado-consulta-documentos.css';

/** Aviso de que una consulta de documentos está en curso. */
export function CargandoDocumentos({ mensaje }: { mensaje: string }) {
  return (
    <p className="documento-estado-consulta" role="status">
      {mensaje}
    </p>
  );
}

interface ErrorLecturaProps {
  error: unknown;
  /** Lo que no se pudo leer, con su artículo ("los documentos"): completa el aviso de permiso. */
  recurso: string;
  onReintentar: () => void;
}

/** Error de lectura: un 403 no se arregla reintentando, así que solo se explica; el resto ofrece reintentar. */
export function ErrorLecturaDocumentos({ error, recurso, onReintentar }: ErrorLecturaProps) {
  if (error instanceof ErrorApi && error.tipo === 'prohibido') {
    return (
      <p className="documento-estado-consulta" role="alert">
        No tiene permiso para ver {recurso}. Si lo necesita, pídalo al Administrador.
      </p>
    );
  }
  return (
    <div className="documento-estado-consulta" role="alert">
      <p>{error instanceof ErrorApi ? error.message : 'No se pudo cargar la información.'}</p>
      <Button type="button" variant="secondary" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}
