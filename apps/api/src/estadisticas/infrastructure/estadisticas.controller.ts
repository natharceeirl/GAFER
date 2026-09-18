import { Controller, Get, Param } from '@nestjs/common';
import { ObtenerResumenClienteUseCase } from '../application/obtener-resumen-cliente.usecase';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly obtenerResumenCliente: ObtenerResumenClienteUseCase) {}

  @Get('clientes/:id/resumen')
  async resumen(@Param('id') id: string) {
    return this.obtenerResumenCliente.ejecutar(id);
  }
}
