import { z } from 'zod';

export const EstadoDocumentoSchema = z.enum([
  'BORRADOR',
  'CERRADO',
  'ENVIADO_A_REVISION',
  'OBSERVADO',
  'APROBADO',
  'ENVIADO',
]);
export type EstadoDocumento = z.infer<typeof EstadoDocumentoSchema>;

export const TipoDocumentoSchema = z.enum(['INFORME', 'REPORTE']);
export type TipoDocumento = z.infer<typeof TipoDocumentoSchema>;

export const DocumentoSchema = z.object({
  id: z.string().uuid(),
  clienteId: z.string().uuid(),
  tipo: TipoDocumentoSchema,
  numeroCorrelativo: z.number().int().positive(),
  estado: EstadoDocumentoSchema,
});
export type Documento = z.infer<typeof DocumentoSchema>;
