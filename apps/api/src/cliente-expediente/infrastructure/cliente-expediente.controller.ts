import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegistrarClienteUseCase } from '../application/registrar-cliente.usecase';

@ApiTags('Cliente Expediente (Legacy)')
@Controller('cliente-expediente/clientes')
export class ClienteExpedienteController {
  constructor(private readonly registrarCliente: RegistrarClienteUseCase) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar cliente (Prototipo memoria - Deprecado)',
    description: 'Prototipo en memoria inicial. Usar /mantenimiento/clientes para la persistencia real en PostgreSQL.',
    deprecated: true,
  })
  async crear(@Body('codigoCorto') codigoCorto: string, @Body('razonSocial') razonSocial: string) {
    const cliente = await this.registrarCliente.ejecutar(codigoCorto, razonSocial);
    return { id: cliente.id, codigoCorto: cliente.codigoCorto, estado: cliente.getEstado() };
  }
}
