import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DescontarStockUseCase } from '../application/descontar-stock.usecase';
import { Roles } from '../../auth/infrastructure/decorators/roles.decorator';

@ApiTags('Fase 5 - Inventario')
@ApiBearerAuth()
@Controller('inventario')
export class InventarioController {
  constructor(private readonly descontarStock: DescontarStockUseCase) {}

  @Post('insumos/:id/descuento')
  @Roles('ADMINISTRADOR')
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
