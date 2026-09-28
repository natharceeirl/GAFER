import type { EstadoDocumento } from '@gafer/contracts';

export type { DocumentoDetalle, DocumentoResumen, InsumoUsado, PersonalInterviniente } from '@gafer/contracts';

export const SIGUIENTE_ESTADO: Partial<Record<EstadoDocumento, EstadoDocumento>> = {
  ENVIADO_A_REVISION: 'APROBADO',
  OBSERVADO: 'ENVIADO_A_REVISION',
  APROBADO: 'ENVIADO',
};
