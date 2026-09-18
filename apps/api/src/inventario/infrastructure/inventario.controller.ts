import { Body, Controller, Param, Post } from '@nestjs/common';
import { DescontarStockUseCase } from '../application/descontar-stock.usecase';

@Controller('inventario')
export class InventarioController {
  constructor(private readonly descontarStock: DescontarStockUseCase) {}

  @Post('insumos/:id/descuento')
  async descontar(@Param('id') insumoId: string, @Body('cantidad') cantidad: number) {
    await this.descontarStock.ejecutar(insumoId, cantidad);
    return { ok: true };
  }
}
