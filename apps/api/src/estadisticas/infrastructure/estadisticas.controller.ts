import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ObtenerResumenClienteUseCase } from '../application/obtener-resumen-cliente.usecase';

@ApiTags('Fase 4 - Estadísticas')
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly obtenerResumenCliente: ObtenerResumenClienteUseCase) {}

  @Get('clientes/:id/resumen')
  @ApiOperation({
    summary: 'Obtener resumen operativo de cliente (Scaffold Fase 4)',
    description: 'Calcula métricas consolidadas de servicios ejecutados para el expediente del cliente.',
  })
  @ApiParam({ name: 'id', description: 'UUID del cliente' })
  async resumen(@Param('id') id: string) {
    return this.obtenerResumenCliente.ejecutar(id);
  }
}
