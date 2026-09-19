import { BadRequestException, Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EstadoDocumentoSchema, TipoDocumentoSchema } from '@gafer/contracts';
import { CrearDocumentoUseCase } from '../application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from '../application/transicionar-documento.usecase';

@ApiTags('Fase 2 - Documentos')
@Controller('documentos')
export class DocumentosController {
  constructor(
    private readonly crearDocumento: CrearDocumentoUseCase,
    private readonly transicionarDocumento: TransicionarDocumentoUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear documento digital (Scaffold Fase 2)',
    description: 'Endpoint preliminar para creación y numeración de certificados de saneamiento.',
  })
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
  @ApiOperation({
    summary: 'Transicionar estado de documento (Scaffold Fase 2)',
    description: 'Avanza el documento en su máquina de estados (BORRADOR -> EMITIDO -> ANULADO).',
  })
  async transicionar(@Param('id') id: string, @Body('nuevoEstado') nuevoEstado: string) {
    const parseo = EstadoDocumentoSchema.safeParse(nuevoEstado);
    if (!parseo.success) {
      throw new BadRequestException(`Estado desconocido: ${nuevoEstado}`);
    }
    const documento = await this.transicionarDocumento.ejecutar(id, parseo.data);
    return { id: documento.id, estado: documento.getEstado() };
  }
}
