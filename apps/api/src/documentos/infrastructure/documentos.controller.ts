import { Body, Controller, Get, HttpCode, Inject, Optional, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiCreatedResponse, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrearDocumentoUseCase } from '../application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from '../application/transicionar-documento.usecase';
import { ListarDocumentosUseCase } from '../application/listar-documentos.usecase';
import { ObtenerDocumentoUseCase } from '../application/obtener-documento.usecase';
import { SolicitarPdfDocumentoUseCase } from '../application/solicitar-pdf-documento.usecase';
import { ObtenerPdfDocumentoUseCase } from '../application/obtener-pdf-documento.usecase';
import { ActorDocumento } from '../domain/documento';
import { Roles } from '../../auth/infrastructure/decorators/roles.decorator';
import { UsuarioActual } from '../../auth/infrastructure/decorators/usuario-actual.decorator';
import { TokenPayload } from '../../auth/domain/ports/token.service.port';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';
import { BadRequestErrorDto, NotFoundErrorDto } from '../../shared/infrastructure/dto/error-response.dto';
import { CrearDocumentoDto, ListarDocumentosQueryDto, TransicionarDocumentoDto } from './dto/documentos.dto';
import {
  DocumentoCreadoResponseDto,
  DocumentoDetalleResponseDto,
  DocumentoResumenResponseDto,
  DocumentoTransicionadoResponseDto,
  PdfSolicitadoResponseDto,
} from './dto/documentos-response.dto';

function actorDe(usuario: TokenPayload): ActorDocumento {
  return { id: usuario.id, usuario: usuario.usuario, rol: usuario.cargo };
}

@ApiTags('Fase 2 - Documentos')
@ApiBearerAuth()
@Controller('documentos')
export class DocumentosController {
  constructor(
    private readonly crearDocumento: CrearDocumentoUseCase,
    private readonly transicionarDocumento: TransicionarDocumentoUseCase,
    private readonly listarDocumentos: ListarDocumentosUseCase,
    private readonly obtenerDocumento: ObtenerDocumentoUseCase,
    @Optional() @Inject(AuditoriaService) private readonly auditoria: AuditoriaService | undefined,
    private readonly solicitarPdf: SolicitarPdfDocumentoUseCase,
    private readonly obtenerPdf: ObtenerPdfDocumentoUseCase,
  ) {}

  @Get()
  @Roles('ADMINISTRADOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Listar documentos (cola de revisión del Supervisor)',
    description:
      'Devuelve los documentos, del más reciente al más antiguo. Con `estado=ENVIADO_A_REVISION` es la cola de revisión. ' +
      'El Técnico Operador no tiene acceso: solo trabaja desde la app móvil.',
  })
  @ApiOkResponse({ type: [DocumentoResumenResponseDto] })
  @ApiResponse({ status: 400, description: 'Filtro inválido', type: BadRequestErrorDto })
  async listar(@Query() query: ListarDocumentosQueryDto): Promise<DocumentoResumenResponseDto[]> {
    return this.listarDocumentos.ejecutar({ estado: query.estado, tipo: query.tipo, clienteId: query.clienteId });
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Obtener un documento con su historial de transiciones',
    description: 'Cada cambio de estado queda registrado con quién lo hizo, cuándo y el motivo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del documento' })
  @ApiOkResponse({ type: DocumentoDetalleResponseDto })
  @ApiResponse({ status: 404, description: 'Documento no encontrado', type: NotFoundErrorDto })
  async obtener(@Param('id', new ParseUUIDPipe()) id: string): Promise<DocumentoDetalleResponseDto> {
    return this.obtenerDocumento.ejecutar(id);
  }

  @Get(':id/pdf')
  @Roles('ADMINISTRADOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Descargar el PDF del documento',
    description:
      'Entrega el PDF ya generado (`application/pdf`). Responde 409 mientras no esté generado (o si la generación falló, ' +
      'con el motivo) y 404 si el documento no existe.',
  })
  @ApiParam({ name: 'id', description: 'UUID del documento' })
  @ApiOkResponse({ description: 'Archivo PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 404, description: 'Documento no encontrado', type: NotFoundErrorDto })
  @ApiResponse({ status: 409, description: 'El PDF todavía no está generado' })
  async descargarPdf(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response): Promise<void> {
    const pdf = await this.obtenerPdf.ejecutar(id);
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdf.nombreArchivo}"`,
        'Content-Length': String(pdf.contenido.length),
        'Cache-Control': 'private, no-store',
      })
      .end(pdf.contenido);
  }

  @Post(':id/pdf')
  @HttpCode(202)
  @Roles('ADMINISTRADOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Generar (o reintentar) el PDF del documento',
    description:
      'No renderiza en la petición: deja el PDF en PENDIENTE y encola el trabajo para el worker. Solo para documentos ' +
      'aprobados. Sirve también para reintentar tras un error. Consulte el estado en `GET /documentos/:id` (campo `pdf`).',
  })
  @ApiParam({ name: 'id', description: 'UUID del documento' })
  @ApiResponse({ status: 202, description: 'Trabajo encolado', type: PdfSolicitadoResponseDto })
  @ApiResponse({ status: 404, description: 'Documento no encontrado', type: NotFoundErrorDto })
  @ApiResponse({ status: 409, description: 'El documento aún no está aprobado' })
  @ApiResponse({ status: 503, description: 'No se pudo encolar el trabajo (cola no disponible)' })
  async generarPdf(@Param('id', new ParseUUIDPipe()) id: string, @UsuarioActual() usuario: TokenPayload): Promise<PdfSolicitadoResponseDto> {
    await this.solicitarPdf.ejecutar(id);
    await this.auditoria?.registrarEvento({
      actorId: usuario.id,
      actorUsuario: usuario.usuario,
      actorRol: usuario.cargo,
      modulo: 'DOCUMENTOS',
      accion: 'GENERAR_PDF',
      entidad: 'documento',
      entidadId: id,
      payloadNuevo: { pdfEstado: 'PENDIENTE' },
    });
    return { id, pdfEstado: 'PENDIENTE' };
  }

  @Post()
  @Roles('ADMINISTRADOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Crear documento y asignar su número correlativo',
    description:
      'Informes y reportes se numeran por cliente y tipo; el contador nunca se reinicia por año. ' +
      'El número lo asigna la base de datos de forma atómica.',
  })
  @ApiCreatedResponse({ type: DocumentoCreadoResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: BadRequestErrorDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado', type: NotFoundErrorDto })
  async crear(@Body() dto: CrearDocumentoDto, @UsuarioActual() usuario: TokenPayload): Promise<DocumentoCreadoResponseDto> {
    const documento = await this.crearDocumento.ejecutar(dto.clienteId, dto.tipo, actorDe(usuario), dto.proyectoId ?? null);
    await this.auditoria?.registrarEvento({
      actorId: usuario.id,
      actorUsuario: usuario.usuario,
      actorRol: usuario.cargo,
      modulo: 'DOCUMENTOS',
      accion: 'CREAR',
      entidad: 'documento',
      entidadId: documento.id,
      payloadNuevo: { codigo: documento.codigo, tipo: documento.tipo, estado: documento.getEstado() },
    });
    return {
      id: documento.id,
      codigo: documento.codigo,
      tipo: documento.tipo,
      numeroCorrelativo: documento.numeroCorrelativo,
      estado: documento.getEstado(),
    };
  }

  @Post(':id/transicion')
  @Roles('ADMINISTRADOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Cambiar el estado de un documento',
    description:
      'BORRADOR → CERRADO → ENVIADO_A_REVISION → (OBSERVADO | APROBADO) → ENVIADO. ' +
      'Una transición no permitida responde 400. Cada cambio queda en el historial.',
  })
  @ApiParam({ name: 'id', description: 'UUID del documento' })
  @ApiOkResponse({ type: DocumentoTransicionadoResponseDto })
  @ApiResponse({ status: 400, description: 'Transición no permitida o datos inválidos', type: BadRequestErrorDto })
  @ApiResponse({ status: 404, description: 'Documento no encontrado', type: NotFoundErrorDto })
  async transicionar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: TransicionarDocumentoDto,
    @UsuarioActual() usuario: TokenPayload,
  ): Promise<DocumentoTransicionadoResponseDto> {
    const documento = await this.transicionarDocumento.ejecutar(id, dto.nuevoEstado, actorDe(usuario), dto.motivo);
    await this.auditoria?.registrarEvento({
      actorId: usuario.id,
      actorUsuario: usuario.usuario,
      actorRol: usuario.cargo,
      modulo: 'DOCUMENTOS',
      accion: 'TRANSICION',
      entidad: 'documento',
      entidadId: documento.id,
      payloadNuevo: { estado: documento.getEstado() },
      detalles: dto.motivo ? { motivo: dto.motivo } : {},
    });
    return { id: documento.id, estado: documento.getEstado() };
  }
}
