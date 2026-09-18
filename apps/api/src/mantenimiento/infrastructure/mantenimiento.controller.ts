import { Body, Controller, Post } from '@nestjs/common';
import { RegistrarInsumoUseCase } from '../application/registrar-insumo.usecase';

@Controller('mantenimiento/insumos')
export class MantenimientoController {
  constructor(private readonly registrarInsumo: RegistrarInsumoUseCase) {}

  @Post()
  async crear(
    @Body('nombreProducto') nombreProducto: string,
    @Body('registroDigesa') registroDigesa: string,
    @Body('dosisReferencial') dosisReferencial: string,
  ) {
    const insumo = await this.registrarInsumo.ejecutar(nombreProducto, registroDigesa, dosisReferencial);
    return { id: insumo.id, nombreProducto: insumo.nombreProducto };
  }
}
