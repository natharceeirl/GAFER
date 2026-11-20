import {
  Body,
  Controller,
  ForbiddenException,
  BadRequestException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  ApiListarMisServiciosDoc,
  ApiSolicitarCorreccionDoc,
} from './operaciones.controller.doc';
import { SincronizarInspeccionUseCase } from '../application/sincronizar-inspeccion.usecase';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';
import { Optional } from '@nestjs/common';
import {
  CerrarInspeccionDto,
  CrearInspeccionDto,
  SincronizarLoteDto,
  SolicitudCorreccionDto,
} from './dto/operaciones.dto';
import { Roles } from '../../auth/infrastructure/decorators/roles.decorator';
import { UsuarioActual } from '../../auth/infrastructure/decorators/usuario-actual.decorator';
import { TokenPayload } from '../../auth/domain/ports/token.service.port';

@ApiTags('Operaciones')
@ApiBearerAuth()
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
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
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
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
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

  @Get('mis-servicios')
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
  @ApiListarMisServiciosDoc()
  async listarMisServicios(@UsuarioActual() user?: TokenPayload) {
    let inspecciones = [];
    if (user?.cargo === 'TECNICO_OPERADOR') {
      inspecciones = await this.obtenerInspeccion.ejecutarPorTecnico(user.id);
    } else {
      inspecciones = await this.obtenerInspeccion.ejecutarTodas();
    }

    return inspecciones.map((insp) => ({
      id: insp.id,
      servicioId: insp.servicioId,
      codigoInspeccion: insp.codigoInspeccion,
      estado: insp.getEstado(),
      versionSync: insp.getVersionSync(),
      fechaEjecucion: insp.fechaEjecucion,
      horaInicio: insp.horaInicio,
      horaFin: insp.horaFin,
      tecnicosParticipantes: insp.tecnicosParticipantes,
      snapshotCatalogos: insp.getSnapshot(),
      puedeSolicitarCorreccion: insp.getEstado() === 'CERRADO',
    }));
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
  @ApiObtenerInspeccionPorIdDoc()
  async obtenerPorId(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UsuarioActual() user?: TokenPayload,
  ) {
    const inspeccion = await this.obtenerInspeccion.ejecutarPorId(id);

    // GAF-104: El técnico operador solo puede ver inspecciones donde participó
    if (user && user.cargo === 'TECNICO_OPERADOR') {
      const esParticipante = inspeccion.tecnicosParticipantes.some(
        (t) => t.id === user.id,
      );
      if (!esParticipante) {
        throw new ForbiddenException(
          'No tiene permisos para consultar servicios de otros técnicos',
        );
      }
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

  @Post(':id/cerrar')
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
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

  @Post(':id/solicitar-correccion')
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
  @ApiSolicitarCorreccionDoc()
  async solicitarCorreccion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SolicitudCorreccionDto,
    @UsuarioActual() user?: TokenPayload,
  ) {
    const inspeccion = await this.obtenerInspeccion.ejecutarPorId(id);

    if (inspeccion.getEstado() !== 'CERRADO') {
      throw new BadRequestException(
        'Solo se pueden solicitar correcciones para servicios cerrados',
      );
    }

    if (user && user.cargo === 'TECNICO_OPERADOR') {
      const esParticipante = inspeccion.tecnicosParticipantes.some(
        (t) => t.id === user.id,
      );
      if (!esParticipante) {
        throw new ForbiddenException(
          'No tiene autorización para solicitar corrección de este servicio',
        );
      }
    }

    const solicitadaEn = new Date().toISOString();

    if (this.auditoriaService) {
      await this.auditoriaService.persistirInspeccionAuditoria({
        inspeccionId: id,
        actorId: user?.id || 'sistema',
        accion: 'SOLICITUD_CORRECCION',
        payloadAnterior: { estado: inspeccion.getEstado() },
        payloadNuevo: {
          motivo: dto.motivo,
          solicitadoPor: user?.nombreCompleto || 'Técnico',
          solicitanteId: user?.id,
          fechaSolicitud: solicitadaEn,
        },
      });

      await this.auditoriaService.registrarEvento({
        actorId: user?.id,
        actorUsuario: user?.usuario || 'TECNICO',
        actorRol: user?.cargo || 'TECNICO_OPERADOR',
        modulo: 'operaciones',
        accion: 'SOLICITAR_CORRECCION',
        entidad: 'inspeccion',
        entidadId: id,
        detalles: {
          motivo: dto.motivo,
          codigoInspeccion: inspeccion.codigoInspeccion,
        },
      });
    }

    return {
      ok: true,
      mensaje: 'Solicitud de corrección enviada a supervisión exitosamente',
      inspeccionId: id,
      solicitadaEn,
    };
  }

  @Get(':id/auditoria')
  @Roles('ADMINISTRADOR')
  @ApiConsultarAuditoriaDoc()
  async consultarAuditoria(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    if (!this.auditoriaService) return [];
    return this.auditoriaService.listarPorInspeccion(id);
  }

  @Post(':id/sincronizar')
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
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
