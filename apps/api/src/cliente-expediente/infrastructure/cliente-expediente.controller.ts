import { Body, Controller, Post } from '@nestjs/common';
import { RegistrarClienteUseCase } from '../application/registrar-cliente.usecase';

@Controller('cliente-expediente/clientes')
export class ClienteExpedienteController {
  constructor(private readonly registrarCliente: RegistrarClienteUseCase) {}

  @Post()
  async crear(@Body('codigoCorto') codigoCorto: string, @Body('razonSocial') razonSocial: string) {
    const cliente = await this.registrarCliente.ejecutar(codigoCorto, razonSocial);
    return { id: cliente.id, codigoCorto: cliente.codigoCorto, estado: cliente.getEstado() };
  }
}
