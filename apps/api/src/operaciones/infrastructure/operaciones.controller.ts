import { Body, Controller, Param, Post } from '@nestjs/common';
import { RegistrarInspeccionUseCase } from '../application/registrar-inspeccion.usecase';
import { CerrarInspeccionUseCase } from '../application/cerrar-inspeccion.usecase';

@Controller('operaciones/inspecciones')
export class OperacionesController {
  constructor(
    private readonly registrarInspeccion: RegistrarInspeccionUseCase,
    private readonly cerrarInspeccion: CerrarInspeccionUseCase,
  ) {}

  @Post()
  async crear(@Body('servicioId') servicioId: string) {
    const inspeccion = await this.registrarInspeccion.ejecutar(servicioId);
    return { id: inspeccion.id, estado: inspeccion.getEstado() };
  }

  @Post(':id/cerrar')
  async cerrar(@Param('id') id: string) {
    const inspeccion = await this.cerrarInspeccion.ejecutar(id);
    return { id: inspeccion.id, estado: inspeccion.getEstado() };
  }
}
