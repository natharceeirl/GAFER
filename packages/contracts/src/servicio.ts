import { z } from 'zod';
import { EstadoActivoInactivoSchema } from './cliente';

export const TipoServicioSchema = z.enum(['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM']);
export type TipoServicio = z.infer<typeof TipoServicioSchema>;

export const ServicioSchema = z.object({
  id: z.string().uuid(),
  proyectoId: z.string().uuid(),
  tipo: TipoServicioSchema,
  estado: EstadoActivoInactivoSchema,
});
export type Servicio = z.infer<typeof ServicioSchema>;
