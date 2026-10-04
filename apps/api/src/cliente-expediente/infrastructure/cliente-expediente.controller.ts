import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegistrarClienteUseCase } from '../application/registrar-cliente.usecase';
import { Roles } from '../../auth/infrastructure/decorators/roles.decorator';

@ApiTags('Cliente Expediente (Legacy)')
@ApiBearerAuth()
@Controller('cliente-expediente/clientes')
export class ClienteExpedienteController {
  constructor(private readonly registrarCliente: RegistrarClienteUseCase) {}

  @Post()
  @Roles('ADMINISTRADOR')
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
