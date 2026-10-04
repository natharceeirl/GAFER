import { Inject, Injectable } from '@nestjs/common';
import { ConfiguracionSistema } from '../domain/configuracion-sistema';
import {
  CONFIGURACION_REPOSITORY,
  ConfiguracionRepository,
} from '../domain/ports/configuracion.repository';

@Injectable()
export class ObtenerConfiguracionUseCase {
  constructor(
    @Inject(CONFIGURACION_REPOSITORY)
    private readonly repository: ConfiguracionRepository,
  ) {}

  async execute(): Promise<ConfiguracionSistema> {
    return this.repository.obtener();
  }
}
