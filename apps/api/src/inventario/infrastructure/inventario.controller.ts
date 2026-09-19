import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DescontarStockUseCase } from '../application/descontar-stock.usecase';

@ApiTags('Fase 5 - Inventario')
@Controller('inventario')
export class InventarioController {
  constructor(private readonly descontarStock: DescontarStockUseCase) {}

  @Post('insumos/:id/descuento')
  @ApiOperation({
    summary: 'Descontar stock de insumo químico (Scaffold Fase 5)',
    description: 'Actualiza el kardex físico al consumir insumos en una orden de servicio.',
  })
  @ApiParam({ name: 'id', description: 'UUID del insumo' })
  async descontar(@Param('id') insumoId: string, @Body('cantidad') cantidad: number) {
    await this.descontarStock.ejecutar(insumoId, cantidad);
    return { ok: true };
  }
}
