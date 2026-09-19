import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegistrarInspeccionEstacionUseCase } from '../application/registrar-inspeccion-estacion.usecase';

@ApiTags('Fase 3 - Mapa Murino')
@Controller('mapa-murino/estaciones')
export class MapaMurinoController {
  constructor(private readonly registrarInspeccion: RegistrarInspeccionEstacionUseCase) {}

  @Post(':id/inspeccion')
  @ApiOperation({
    summary: 'Registrar inspección en estación de control murino (Scaffold Fase 3)',
    description: 'Actualiza el estado visual (aura/color) de la trampa según si se detectó consumo de cebo.',
  })
  async registrar(@Param('id') id: string, @Body('huboConsumo') huboConsumo: boolean) {
    const estacion = await this.registrarInspeccion.ejecutar(id, huboConsumo);
    return {
      id: estacion.id,
      colorIcono: estacion.getColorIcono(),
      colorAura: estacion.getColorAura(),
    };
  }
}
