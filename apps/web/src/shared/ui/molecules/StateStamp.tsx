import type { EstadoDocumento } from '@gafer/contracts';
import './state-stamp.css';

const ETIQUETA_POR_ESTADO: Record<EstadoDocumento, string> = {
  BORRADOR: 'Borrador',
  CERRADO: 'Cerrado',
  ENVIADO_A_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  ENVIADO: 'Enviado',
};

const CLASE_POR_ESTADO: Record<EstadoDocumento, string> = {
  BORRADOR: 'state-stamp--borrador',
  CERRADO: 'state-stamp--cerrado',
  ENVIADO_A_REVISION: 'state-stamp--revision',
  OBSERVADO: 'state-stamp--observado',
  APROBADO: 'state-stamp--aprobado',
  ENVIADO: 'state-stamp--enviado',
};

interface StateStampProps {
  estado: EstadoDocumento;
  /** Reproduce la animación de golpe de tinta al montar (transición reciente). */
  animate?: boolean;
}

/**
 * El sello grande de un documento — no desaparece cuando el estado
 * cambia, se sobrepone: OBSERVADO se estampa en diagonal sobre el
 * documento en vez de reemplazar su badge, igual que un sello real
 * que anula sin borrar lo anterior.
 */
export function StateStamp({ estado, animate = false }: StateStampProps) {
  return (
    <div
      className={`state-stamp ${CLASE_POR_ESTADO[estado]} ${animate ? 'state-stamp--thud' : ''}`}
      role="status"
    >
      {ETIQUETA_POR_ESTADO[estado]}
    </div>
  );
}
