import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConsultaAuditoriaFiltros } from '@gafer/contracts';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';

export interface ConsultarAuditoriaCommand {
  filtros: ConsultaAuditoriaFiltros;
  actorRol: string;
}

@Injectable()
export class ConsultarAuditoriaUseCase {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  async execute(command: ConsultarAuditoriaCommand) {
    if (command.actorRol !== 'ADMINISTRADOR') {
      throw new ForbiddenException(
        'Solo ADMINISTRADOR puede consultar el registro de auditoría',
      );
    }

    return this.auditoriaService.consultarEventos(command.filtros);
  }
}
