import type { Rol } from '../../auth/model/roles';

export type AccionAuditoria =
  | 'Aprobación'
  | 'Observación'
  | 'Intervención post-cierre'
  | 'Modificación post-aprobación'
  | 'Envío al cliente'
  | 'Programación de visita'
  | 'Alta de cliente'
  | 'Edición de ficha de cliente'
  | 'Cierre de inspección';

/** Evento del log de auditoría (§8.4): nadie lo modifica ni lo elimina. */
export interface EventoAuditoria {
  id: string;
  fechaHora: string;
  usuario: string;
  rol: Rol | 'TECNICO_OPERADOR';
  accion: AccionAuditoria;
  referencia: string;
  detalle: string;
  campo?: string;
  valorAnterior?: string;
  valorNuevo?: string;
  autorizo?: string;
  ejecuto?: string;
}
