import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseFilters } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { MapaVisita, Plano, VisitaDelPlano } from '@gafer/contracts';
import { Roles } from '../../auth/infrastructure/decorators/roles.decorator';
import { BadRequestErrorDto, NotFoundErrorDto } from '../../shared/infrastructure/dto/error-response.dto';
import { CrearPlanoUseCase } from '../application/crear-plano.usecase';
import { ListarPlanosUseCase } from '../application/listar-planos.usecase';
import { ListarVisitasPlanoUseCase } from '../application/listar-visitas-plano.usecase';
import { ObtenerMapaVisitaUseCase } from '../application/obtener-mapa-visita.usecase';
import { RegistrarVisitaMapaUseCase } from '../application/registrar-visita-mapa.usecase';
import { PlanoMapa } from '../domain/ports/mapa.repository';
import { CrearPlanoDto, RegistrarVisitaMapaDto } from './dto/mapa.dto';
import { MapaErroresFilter } from './mapa-errores.filter';

const aPlano = (p: PlanoMapa): Plano => ({ id: p.id, proyectoId: p.proyectoId, nombre: p.nombre, puntos: p.puntos, cerrado: p.cerrado });

@ApiTags('Fase 3 - Mapa Murino')
@ApiBearerAuth()
@UseFilters(MapaErroresFilter)
@Controller('mapa-murino')
export class PlanosMapaController {
  constructor(
    private readonly crearPlano: CrearPlanoUseCase,
    private readonly listarPlanos: ListarPlanosUseCase,
    private readonly listarVisitas: ListarVisitasPlanoUseCase,
    private readonly obtenerMapa: ObtenerMapaVisitaUseCase,
    private readonly registrarVisita: RegistrarVisitaMapaUseCase,
  ) {}

  @Post('proyectos/:proyectoId/planos')
  @Roles('ADMINISTRADOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Crear un plano del proyecto',
    description: 'Un proyecto admite hasta 20 planos (409 al superarlos) y no repite nombres de plano.',
  })
  @ApiParam({ name: 'proyectoId', description: 'UUID del proyecto' })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: BadRequestErrorDto })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado', type: NotFoundErrorDto })
  @ApiResponse({ status: 409, description: 'El proyecto ya tiene 20 planos o el nombre ya existe' })
  async crear(@Param('proyectoId', new ParseUUIDPipe()) proyectoId: string, @Body() dto: CrearPlanoDto): Promise<Plano> {
    return aPlano(await this.crearPlano.ejecutar(proyectoId, dto));
  }

  @Get('proyectos/:proyectoId/planos')
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
  @ApiOperation({ summary: 'Listar los planos de un proyecto' })
  @ApiParam({ name: 'proyectoId', description: 'UUID del proyecto' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado', type: NotFoundErrorDto })
  async listar(@Param('proyectoId', new ParseUUIDPipe()) proyectoId: string): Promise<Plano[]> {
    return (await this.listarPlanos.ejecutar(proyectoId)).map(aPlano);
  }

  @Get('planos/:planoId/visitas')
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
  @ApiOperation({ summary: 'Visitas con registro de estaciones en el plano, de la más antigua a la más reciente' })
  @ApiParam({ name: 'planoId', description: 'UUID del plano' })
  @ApiResponse({ status: 404, description: 'Plano no encontrado', type: NotFoundErrorDto })
  async visitas(@Param('planoId', new ParseUUIDPipe()) planoId: string): Promise<VisitaDelPlano[]> {
    return this.listarVisitas.ejecutar(planoId);
  }

  @Get('planos/:planoId/visitas/:visitaId')
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
  @ApiOperation({
    summary: 'Mapa del plano tal como se vio en una visita',
    description:
      'Reconstruye el estado de cada estación (ícono, aura, posición, de dónde se reubicó, historial) al cierre de la visita, ' +
      'con la tabla resumen y la irradiación del aura. Una visita pasada da siempre el mismo resultado.',
  })
  @ApiParam({ name: 'planoId', description: 'UUID del plano' })
  @ApiParam({ name: 'visitaId', description: 'UUID de la visita' })
  @ApiOkResponse({ description: 'Mapa de la visita' })
  @ApiResponse({ status: 404, description: 'Plano o visita sin registro', type: NotFoundErrorDto })
  async mapa(
    @Param('planoId', new ParseUUIDPipe()) planoId: string,
    @Param('visitaId', new ParseUUIDPipe()) visitaId: string,
  ): Promise<MapaVisita> {
    return this.obtenerMapa.ejecutar(planoId, visitaId);
  }

  @Put('planos/:planoId/visitas/:visitaId')
  @Roles('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')
  @ApiOperation({
    summary: 'Registrar lo visto en el plano durante la visita',
    description:
      'Reemplaza el registro de la visita en ese plano (hasta 100 estaciones). La estación instalada no se inspecciona hasta la visita siguiente; ' +
      'una reubicada conserva su aura y guarda de dónde vino; una que no figura se considera retirada. ' +
      'Responde 409 si la visita está en revisión o si ya hay visitas posteriores con registro en el plano.',
  })
  @ApiParam({ name: 'planoId', description: 'UUID del plano' })
  @ApiParam({ name: 'visitaId', description: 'UUID de la visita' })
  @ApiOkResponse({ description: 'Mapa resultante de la visita' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o reglas del mapa incumplidas', type: BadRequestErrorDto })
  @ApiResponse({ status: 404, description: 'Plano o visita no encontrados', type: NotFoundErrorDto })
  @ApiResponse({ status: 409, description: 'Límite de 100 estaciones, número ya usado, visita en revisión o visitas posteriores' })
  async registrar(
    @Param('planoId', new ParseUUIDPipe()) planoId: string,
    @Param('visitaId', new ParseUUIDPipe()) visitaId: string,
    @Body() dto: RegistrarVisitaMapaDto,
  ): Promise<MapaVisita> {
    return this.registrarVisita.ejecutar(planoId, visitaId, dto);
  }
}
