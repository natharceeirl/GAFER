import { ErrorApi } from '../../../shared/api/errores';
import { EstadoError } from '../../cliente-expediente/components/EstadoConsulta';

interface Props {
  error: unknown;
  /** Lo que no se pudo leer, con su artículo ("los insumos"): completa el aviso de permiso. */
  recurso: string;
  onReintentar: () => void;
}

/**
 * Error de lectura de una sección de Mantenimiento. Un 403 no es un fallo que se arregle reintentando: el rol no
 * tiene acceso, y así se dice. El resto de errores ofrece reintentar.
 */
export function ErrorLectura({ error, recurso, onReintentar }: Props) {
  if (error instanceof ErrorApi && error.tipo === 'prohibido') {
    return (
      <p className="mant-aviso mant-aviso--permiso" role="alert">
        No tiene permiso para ver {recurso}. Si lo necesita, pídalo al Administrador.
      </p>
    );
  }
  return <EstadoError mensaje={error instanceof ErrorApi ? error.message : 'No se pudo cargar la información.'} onReintentar={onReintentar} />;
}
