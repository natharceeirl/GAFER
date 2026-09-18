import { BadRequestException, Body, Controller, Param, Post } from '@nestjs/common';
import { EstadoDocumentoSchema, TipoDocumentoSchema } from '@gafer/contracts';
import { CrearDocumentoUseCase } from '../application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from '../application/transicionar-documento.usecase';

/**
 * Los esquemas de @gafer/contracts se usan acá para validar en el borde
 * de la API (el mismo tipo que consume apps/web), en vez de reimplementar
 * la lista de estados/tipos válidos en el backend.
 */
@Controller('documentos')
export class DocumentosController {
  constructor(
    private readonly crearDocumento: CrearDocumentoUseCase,
    private readonly transicionarDocumento: TransicionarDocumentoUseCase,
  ) {}

  @Post()
  async crear(@Body('clienteId') clienteId: string, @Body('tipo') tipo: string) {
    const tipoValidado = TipoDocumentoSchema.parse(tipo);
    const documento = await this.crearDocumento.ejecutar(clienteId, tipoValidado);
    return {
      id: documento.id,
      numeroCorrelativo: documento.numeroCorrelativo,
      estado: documento.getEstado(),
    };
  }

  @Post(':id/transicion')
  async transicionar(@Param('id') id: string, @Body('nuevoEstado') nuevoEstado: string) {
    const parseo = EstadoDocumentoSchema.safeParse(nuevoEstado);
    if (!parseo.success) {
      throw new BadRequestException(`Estado desconocido: ${nuevoEstado}`);
    }
    const documento = await this.transicionarDocumento.ejecutar(id, parseo.data);
    return { id: documento.id, estado: documento.getEstado() };
  }
}
