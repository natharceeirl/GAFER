import type { EstadoDocumento } from '@gafer/contracts';
import '../../../shared/ui/atoms/badge.css';

const ETIQUETA: Record<EstadoDocumento, string> = {
  BORRADOR: 'Borrador',
  CERRADO: 'Cerrado',
  ENVIADO_A_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  ENVIADO: 'Enviado',
};

const CLASE: Record<EstadoDocumento, string> = {
  BORRADOR: 'badge badge--sin-color',
  CERRADO: 'badge badge--sin-color',
  ENVIADO_A_REVISION: 'badge badge--amarillo',
  OBSERVADO: 'badge badge--naranja',
  APROBADO: 'badge badge--verde',
  ENVIADO: 'badge badge--verde',
};

/** Insignia de fila (bandeja/listados) para el estado de un Documento — el sello grande vive en StateStamp, en la vista de detalle. */
export function EstadoBadge({ estado }: { estado: EstadoDocumento }) {
  return <span className={CLASE[estado]}>{ETIQUETA[estado]}</span>;
}
