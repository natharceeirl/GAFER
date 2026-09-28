import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RegistrarInspeccionUseCase } from '../application/registrar-inspeccion.usecase';
import { CerrarInspeccionUseCase } from '../application/cerrar-inspeccion.usecase';
import { ObtenerInspeccionUseCase } from '../application/obtener-inspeccion.usecase';
import {
  ApiCrearInspeccionDoc,
  ApiCerrarInspeccionDoc,
  ApiObtenerInspeccionPorIdDoc,
  ApiConsultarInspeccionDoc,
  ApiConsultarAuditoriaDoc,
  ApiSincronizarInspeccionDoc,
} from './operaciones.controller.doc';
import { SincronizarInspeccionUseCase } from '../application/sincronizar-inspeccion.usecase';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';
import { Optional } from '@nestjs/common';
import { CerrarInspeccionDto, CrearInspeccionDto, SincronizarLoteDto } from './dto/operaciones.dto';

@ApiTags('Operaciones')
@Controller('operaciones/inspecciones')
export class OperacionesController {
  constructor(
    private readonly registrarInspeccion: RegistrarInspeccionUseCase,
    private readonly cerrarInspeccion: CerrarInspeccionUseCase,
    private readonly obtenerInspeccion: ObtenerInspeccionUseCase,
    @Optional()
    private readonly auditoriaService?: AuditoriaService,
    @Optional()
    private readonly sincronizarInspeccion?: SincronizarInspeccionUseCase,
  ) {}

  @Post()
  @ApiCrearInspeccionDoc()
  async crear(@Body() dto: CrearInspeccionDto) {
    const inspeccion = await this.registrarInspeccion.ejecutar(dto.servicioId);
    return {
      id: inspeccion.id,
      servicioId: inspeccion.servicioId,
      codigoInspeccion: inspeccion.codigoInspeccion,
      estado: inspeccion.getEstado(),
      versionSync: inspeccion.getVersionSync(),
    };
  }

  @Get()
  @ApiConsultarInspeccionDoc()
  async consultar(@Query('servicioId') servicioId?: string) {
    if (!servicioId) {
      return null;
    }
    const inspeccion = await this.obtenerInspeccion.ejecutarPorServicioId(servicioId);
    if (!inspeccion) {
      return null;
    }
    return {
      id: inspeccion.id,
      servicioId: inspeccion.servicioId,
      codigoInspeccion: inspeccion.codigoInspeccion,
      estado: inspeccion.getEstado(),
      versionSync: inspeccion.getVersionSync(),
      fechaEjecucion: inspeccion.fechaEjecucion,
      horaInicio: inspeccion.horaInicio,
      horaFin: inspeccion.horaFin,
      tecnicosParticipantes: inspeccion.tecnicosParticipantes,
      snapshotCatalogos: inspeccion.getSnapshot(),
    };
  }

  @Get(':id')
  @ApiObtenerInspeccionPorIdDoc()
  async obtenerPorId(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const inspeccion = await this.obtenerInspeccion.ejecutarPorId(id);
    return {
      id: inspeccion.id,
      servicioId: inspeccion.servicioId,
      codigoInspeccion: inspeccion.codigoInspeccion,
      estado: inspeccion.getEstado(),
      versionSync: inspeccion.getVersionSync(),
      fechaEjecucion: inspeccion.fechaEjecucion,
      horaInicio: inspeccion.horaInicio,
      horaFin: inspeccion.horaFin,
      tecnicosParticipantes: inspeccion.tecnicosParticipantes,
      snapshotCatalogos: inspeccion.getSnapshot(),
    };
  }

  @Post(':id/cerrar')
  @ApiCerrarInspeccionDoc()
  async cerrar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto?: CerrarInspeccionDto,
  ) {
    const inspeccion = await this.cerrarInspeccion.execute({
      inspeccionId: id,
      consumos: dto?.consumos,
      equiposIds: dto?.equiposIds,
      personalIds: dto?.personalIds,
    });
    return {
      id: inspeccion.id,
      estado: inspeccion.getEstado(),
      tecnicosParticipantes: inspeccion.tecnicosParticipantes,
      snapshotCatalogos: inspeccion.getSnapshot(),
      versionSync: inspeccion.getVersionSync(),
    };
  }

  @Get(':id/auditoria')
  @ApiConsultarAuditoriaDoc()
  async consultarAuditoria(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    if (!this.auditoriaService) return [];
    return this.auditoriaService.listarPorInspeccion(id);
  }

  @Post(':id/sincronizar')
  @ApiSincronizarInspeccionDoc()
  async sincronizar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SincronizarLoteDto,
  ) {
    if (!this.sincronizarInspeccion) {
      throw new Error('SincronizarInspeccionUseCase no configurado');
    }
    return this.sincronizarInspeccion.ejecutar(id, dto.operaciones);
  }
}
