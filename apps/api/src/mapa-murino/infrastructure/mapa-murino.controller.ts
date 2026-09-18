import { Body, Controller, Param, Post } from '@nestjs/common';
import { RegistrarInspeccionEstacionUseCase } from '../application/registrar-inspeccion-estacion.usecase';

@Controller('mapa-murino/estaciones')
export class MapaMurinoController {
  constructor(private readonly registrarInspeccion: RegistrarInspeccionEstacionUseCase) {}

  @Post(':id/inspeccion')
  async registrar(@Param('id') id: string, @Body('huboConsumo') huboConsumo: boolean) {
    const estacion = await this.registrarInspeccion.ejecutar(id, huboConsumo);
    return {
      id: estacion.id,
      colorIcono: estacion.getColorIcono(),
      colorAura: estacion.getColorAura(),
    };
  }
}
