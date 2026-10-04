import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

// Use Cases - Creación
import { RegistrarClienteUseCase } from '../application/registrar-cliente.usecase';
import { RegistrarProyectoUseCase } from '../application/registrar-proyecto.usecase';
import { RegistrarServicioContratadoUseCase } from '../application/registrar-servicio-contratado.usecase';
import { RegistrarInsumoUseCase } from '../application/registrar-insumo.usecase';
import { RegistrarEquipoUseCase } from '../application/registrar-equipo.usecase';
import { RegistrarPersonalUseCase } from '../application/registrar-personal.usecase';

// Use Cases - Ciclo de Vida y Actualización
import { ActualizarClienteUseCase } from '../application/actualizar-cliente.usecase';
import { DesactivarClienteUseCase } from '../application/desactivar-cliente.usecase';
import { ActivarClienteUseCase } from '../application/activar-cliente.usecase';
import { ActualizarProyectoUseCase } from '../application/actualizar-proyecto.usecase';
import { ActivarProyectoUseCase } from '../application/activar-proyecto.usecase';
import { DesactivarProyectoUseCase } from '../application/desactivar-proyecto.usecase';
import { ActualizarServicioContratadoUseCase } from '../application/actualizar-servicio-contratado.usecase';
import { ActivarServicioContratadoUseCase } from '../application/activar-servicio-contratado.usecase';
import { DesactivarServicioContratadoUseCase } from '../application/desactivar-servicio-contratado.usecase';
import { ActualizarInsumoUseCase } from '../application/actualizar-insumo.usecase';
import { DesactivarInsumoUseCase } from '../application/desactivar-insumo.usecase';
import { ActivarInsumoUseCase } from '../application/activar-insumo.usecase';
import { ActualizarEquipoUseCase } from '../application/actualizar-equipo.usecase';
import { ActualizarEstadoEquipoUseCase } from '../application/actualizar-estado-equipo.usecase';
import { ActualizarPersonalUseCase } from '../application/actualizar-personal.usecase';
import { DesactivarPersonalUseCase } from '../application/desactivar-personal.usecase';
import { ActivarPersonalUseCase } from '../application/activar-personal.usecase';

// Ports
import {
  CLIENTE_REPOSITORY,
  ClienteRepository,
} from '../domain/ports/cliente.repository';
import {
  PROYECTO_REPOSITORY,
  ProyectoRepository,
} from '../domain/ports/proyecto.repository';
import {
  SERVICIO_CONTRATADO_REPOSITORY,
  ServicioContratadoRepository,
} from '../domain/ports/servicio-contratado.repository';
import {
  INSUMO_REPOSITORY,
  InsumoRepository,
} from '../domain/ports/insumo.repository';
import {
  EQUIPO_REPOSITORY,
  EquipoRepository,
} from '../domain/ports/equipo.repository';
import {
  PERSONAL_REPOSITORY,
  PersonalRepository,
} from '../domain/ports/personal.repository';
import { ServicioContratado } from '../domain/servicio-contratado';

// S3 Storage
import { S3StorageService } from '../../shared/infrastructure/storage/s3-storage.service';

// DTOs Request
import {
  CrearClienteDto,
  ActualizarClienteDto,
  CrearProyectoDto,
  ActualizarProyectoDto,
  CrearServicioContratadoDto,
  ActualizarServicioContratadoDto,
  CrearInsumoDto,
  ActualizarInsumoDto,
  CrearEquipoDto,
  ActualizarEquipoDto,
  CambiarEstadoEquipoDto,
  CrearPersonalDto,
  ActualizarPersonalDto,
  GenerarUploadUrlDto,
  GenerarDownloadUrlDto,
} from './dto/mantenimiento.dto';
import { PaginacionQueryDto } from '../../shared/infrastructure/dto/paginacion.dto';

// DTOs Response
import {
  ClienteResponseDto,
  ClienteDetalleResponseDto,
  ClientePaginadoResponseDto,
  ProyectoResponseDto,
  ServicioContratadoResponseDto,
  InsumoResponseDto,
  InsumoPaginadoResponseDto,
  EquipoResponseDto,
  EquipoPaginadoResponseDto,
  PersonalResponseDto,
  PersonalPaginadoResponseDto,
  UploadUrlResponseDto,
  DownloadUrlResponseDto,
  EstadoSimpleResponseDto,
} from './dto/mantenimiento-response.dto';

// Documentation Decorators (applyDecorators)
import {
  ApiCrearClienteDoc,
  ApiListarClientesDoc,
  ApiObtenerClienteDoc,
  ApiActualizarClienteDoc,
  ApiDesactivarClienteDoc,
  ApiActivarClienteDoc,
  ApiCrearProyectoDoc,
  ApiListarProyectosPorClienteDoc,
  ApiObtenerProyectoDoc,
  ApiActualizarProyectoDoc,
  ApiDesactivarProyectoDoc,
  ApiActivarProyectoDoc,
  ApiCrearServicioContratadoDoc,
  ApiListarServiciosPorProyectoDoc,
  ApiObtenerServicioContratadoDoc,
  ApiActualizarServicioContratadoDoc,
  ApiDesactivarServicioContratadoDoc,
  ApiActivarServicioContratadoDoc,
  ApiCrearInsumoDoc,
  ApiListarInsumosDoc,
  ApiObtenerInsumoDoc,
  ApiActualizarInsumoDoc,
  ApiDesactivarInsumoDoc,
  ApiActivarInsumoDoc,
  ApiCrearEquipoDoc,
  ApiListarEquiposDoc,
  ApiObtenerEquipoDoc,
  ApiActualizarEquipoDoc,
  ApiCambiarEstadoEquipoDoc,
  ApiCrearPersonalDoc,
  ApiListarPersonalDoc,
  ApiObtenerPersonalDoc,
  ApiActualizarPersonalDoc,
  ApiDesactivarPersonalDoc,
  ApiActivarPersonalDoc,
  ApiGenerarUploadUrlDoc,
  ApiGenerarDownloadUrlDoc,
} from './mantenimiento.controller.doc';

@ApiTags('Mantenimiento')
@Controller('mantenimiento')
export class MantenimientoController {
  constructor(
    private readonly registrarClienteUseCase: RegistrarClienteUseCase,
    private readonly actualizarClienteUseCase: ActualizarClienteUseCase,
    private readonly desactivarClienteUseCase: DesactivarClienteUseCase,
    private readonly activarClienteUseCase: ActivarClienteUseCase,
    private readonly registrarProyectoUseCase: RegistrarProyectoUseCase,
    private readonly actualizarProyectoUseCase: ActualizarProyectoUseCase,
    private readonly activarProyectoUseCase: ActivarProyectoUseCase,
    private readonly desactivarProyectoUseCase: DesactivarProyectoUseCase,
    private readonly registrarServicioContratadoUseCase: RegistrarServicioContratadoUseCase,
    private readonly actualizarServicioContratadoUseCase: ActualizarServicioContratadoUseCase,
    private readonly activarServicioContratadoUseCase: ActivarServicioContratadoUseCase,
    private readonly desactivarServicioContratadoUseCase: DesactivarServicioContratadoUseCase,
    private readonly registrarInsumoUseCase: RegistrarInsumoUseCase,
    private readonly actualizarInsumoUseCase: ActualizarInsumoUseCase,
    private readonly desactivarInsumoUseCase: DesactivarInsumoUseCase,
    private readonly activarInsumoUseCase: ActivarInsumoUseCase,
    private readonly registrarEquipoUseCase: RegistrarEquipoUseCase,
    private readonly actualizarEquipoUseCase: ActualizarEquipoUseCase,
    private readonly actualizarEstadoEquipoUseCase: ActualizarEstadoEquipoUseCase,
    private readonly registrarPersonalUseCase: RegistrarPersonalUseCase,
    private readonly actualizarPersonalUseCase: ActualizarPersonalUseCase,
    private readonly desactivarPersonalUseCase: DesactivarPersonalUseCase,
    private readonly activarPersonalUseCase: ActivarPersonalUseCase,
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepo: ClienteRepository,
    @Inject(PROYECTO_REPOSITORY)
    private readonly proyectoRepo: ProyectoRepository,
    @Inject(SERVICIO_CONTRATADO_REPOSITORY)
    private readonly servicioRepo: ServicioContratadoRepository,
    @Inject(INSUMO_REPOSITORY)
    private readonly insumoRepo: InsumoRepository,
    @Inject(EQUIPO_REPOSITORY)
    private readonly equipoRepo: EquipoRepository,
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepo: PersonalRepository,
    private readonly storageService: S3StorageService,
  ) {}

  // ==========================================
  // CLIENTES
  // ==========================================

  @Post('clientes')
  @ApiCrearClienteDoc()
  async crearCliente(@Body() dto: CrearClienteDto): Promise<ClienteResponseDto> {
    const cliente = await this.registrarClienteUseCase.execute(dto);
    return {
      id: cliente.id,
      razonSocial: cliente.razonSocial,
      ruc: cliente.ruc,
      codigoCorto: cliente.codigoCorto,
      estado: cliente.getEstado(),
      giroNegocio: cliente.giroNegocio,
      contactoNombre: cliente.contactoNombre,
      contactoTelefono: cliente.contactoTelefono,
      contactoCorreo: cliente.contactoCorreo,
    };
  }

  @Get('clientes')
  @ApiListarClientesDoc()
  async listarClientes(
    @Query() query?: PaginacionQueryDto,
  ): Promise<ClientePaginadoResponseDto> {
    const { limit = 20, offset = 0, busqueda } = query ?? {};
    let clientes = await this.clienteRepo.listarTodos();

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      clientes = clientes.filter(
        (c) =>
          c.razonSocial.toLowerCase().includes(q) ||
          c.ruc.includes(q) ||
          c.codigoCorto.toLowerCase().includes(q),
      );
    }

    const total = clientes.length;
    const paginados = clientes.slice(offset, offset + limit);

    return {
      total,
      limit,
      offset,
      items: paginados.map((c) => ({
        id: c.id,
        razonSocial: c.razonSocial,
        ruc: c.ruc,
        codigoCorto: c.codigoCorto,
        estado: c.getEstado(),
        giroNegocio: c.giroNegocio,
        contactoNombre: c.contactoNombre,
        contactoTelefono: c.contactoTelefono,
        contactoCorreo: c.contactoCorreo,
      })),
    };
  }

  @Get('clientes/:id')
  @ApiObtenerClienteDoc()
  async obtenerCliente(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ClienteDetalleResponseDto> {
    const cliente = await this.clienteRepo.buscarPorId(id);
    if (!cliente) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }
    return {
      id: cliente.id,
      razonSocial: cliente.razonSocial,
      ruc: cliente.ruc,
      codigoCorto: cliente.codigoCorto,
      direccionFiscal: cliente.direccionFiscal,
      giroNegocio: cliente.giroNegocio,
      contactoNombre: cliente.contactoNombre,
      contactoCargo: cliente.contactoCargo,
      contactoTelefono: cliente.contactoTelefono,
      contactoCorreo: cliente.contactoCorreo,
      estado: cliente.getEstado(),
      camposExtra: cliente.camposExtra,
    };
  }

  @Patch('clientes/:id')
  @ApiActualizarClienteDoc()
  async actualizarCliente(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActualizarClienteDto,
  ): Promise<ClienteDetalleResponseDto> {
    const cliente = await this.actualizarClienteUseCase.execute({
      id,
      ...dto,
    });
    return {
      id: cliente.id,
      razonSocial: cliente.razonSocial,
      ruc: cliente.ruc,
      codigoCorto: cliente.codigoCorto,
      direccionFiscal: cliente.direccionFiscal,
      giroNegocio: cliente.giroNegocio,
      contactoNombre: cliente.contactoNombre,
      contactoCargo: cliente.contactoCargo,
      contactoTelefono: cliente.contactoTelefono,
      contactoCorreo: cliente.contactoCorreo,
      estado: cliente.getEstado(),
      camposExtra: cliente.camposExtra,
    };
  }

  @Patch('clientes/:id/desactivar')
  @ApiDesactivarClienteDoc()
  async desactivarCliente(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const cliente = await this.desactivarClienteUseCase.execute(id);
    return { id: cliente.id, estado: cliente.getEstado() };
  }

  @Patch('clientes/:id/activar')
  @ApiActivarClienteDoc()
  async activarCliente(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const cliente = await this.activarClienteUseCase.execute(id);
    return { id: cliente.id, estado: cliente.getEstado() };
  }

  // ==========================================
  // SEDES / PROYECTOS
  // ==========================================

  @Post('proyectos')
  @ApiCrearProyectoDoc()
  async crearProyecto(@Body() dto: CrearProyectoDto): Promise<ProyectoResponseDto> {
    const proyecto = await this.registrarProyectoUseCase.execute(dto);
    return this.mapProyectoResponse(proyecto);
  }

  @Get('proyectos/cliente/:clienteId')
  @ApiListarProyectosPorClienteDoc()
  async listarProyectosPorCliente(
    @Param('clienteId', new ParseUUIDPipe({ version: '4' })) clienteId: string,
  ): Promise<ProyectoResponseDto[]> {
    const proyectos = await this.proyectoRepo.buscarPorClienteId(clienteId);
    return proyectos.map((p) => this.mapProyectoResponse(p));
  }

  @Get('proyectos/:id')
  @ApiObtenerProyectoDoc()
  async obtenerProyecto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ProyectoResponseDto> {
    const proyecto = await this.proyectoRepo.buscarPorId(id);
    if (!proyecto) {
      throw new NotFoundException(`Sede/Proyecto ${id} no encontrado`);
    }
    return this.mapProyectoResponse(proyecto);
  }

  @Patch('proyectos/:id')
  @ApiActualizarProyectoDoc()
  async actualizarProyecto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActualizarProyectoDto,
  ): Promise<ProyectoResponseDto> {
    const proyecto = await this.actualizarProyectoUseCase.execute({
      id,
      ...dto,
    });
    return this.mapProyectoResponse(proyecto);
  }

  @Patch('proyectos/:id/desactivar')
  @ApiDesactivarProyectoDoc()
  async desactivarProyecto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const proyecto = await this.desactivarProyectoUseCase.execute(id);
    return { id: proyecto.id, estado: proyecto.getEstado() };
  }

  @Patch('proyectos/:id/activar')
  @ApiActivarProyectoDoc()
  async activarProyecto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const proyecto = await this.activarProyectoUseCase.execute(id);
    return { id: proyecto.id, estado: proyecto.getEstado() };
  }

  private mapProyectoResponse(p: {
    id: string;
    clienteId: string;
    nombre: string;
    direccionSede: string;
    distrito: string;
    provincia: string;
    departamento: string;
    contactoNombre: string;
    contactoCargo: string;
    contactoTelefono: string;
    getEstado: () => 'ACTIVO' | 'INACTIVO';
    observaciones: string | null;
  }): ProyectoResponseDto {
    return {
      id: p.id,
      clienteId: p.clienteId,
      nombre: p.nombre,
      direccionSede: p.direccionSede,
      distrito: p.distrito,
      provincia: p.provincia,
      departamento: p.departamento,
      contactoNombre: p.contactoNombre,
      contactoCargo: p.contactoCargo,
      contactoTelefono: p.contactoTelefono,
      estado: p.getEstado(),
      observaciones: p.observaciones,
    };
  }

  // ==========================================
  // SERVICIOS CONTRATADOS
  // ==========================================

  @Post('servicios-contratados')
  @ApiCrearServicioContratadoDoc()
  async crearServicioContratado(
    @Body() dto: CrearServicioContratadoDto,
  ): Promise<ServicioContratadoResponseDto> {
    const servicio = await this.registrarServicioContratadoUseCase.execute(dto);
    return this.mapServicioResponse(servicio);
  }

  @Get('servicios-contratados/proyecto/:proyectoId')
  @ApiListarServiciosPorProyectoDoc()
  async listarServiciosPorProyecto(
    @Param('proyectoId', new ParseUUIDPipe({ version: '4' })) proyectoId: string,
  ): Promise<ServicioContratadoResponseDto[]> {
    const servicios = await this.servicioRepo.buscarPorProyectoId(proyectoId);
    return servicios.map((s) => this.mapServicioResponse(s));
  }

  @Get('servicios-contratados/:id')
  @ApiObtenerServicioContratadoDoc()
  async obtenerServicioContratado(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ServicioContratadoResponseDto> {
    const servicio = await this.servicioRepo.buscarPorId(id);
    if (!servicio) {
      throw new NotFoundException(`Servicio contratado ${id} no encontrado`);
    }
    return this.mapServicioResponse(servicio);
  }

  @Patch('servicios-contratados/:id')
  @ApiActualizarServicioContratadoDoc()
  async actualizarServicioContratado(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActualizarServicioContratadoDto,
  ): Promise<ServicioContratadoResponseDto> {
    const servicio = await this.actualizarServicioContratadoUseCase.execute({
      id,
      ...dto,
    });
    return this.mapServicioResponse(servicio);
  }

  @Patch('servicios-contratados/:id/desactivar')
  @ApiDesactivarServicioContratadoDoc()
  async desactivarServicioContratado(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const servicio = await this.desactivarServicioContratadoUseCase.execute(id);
    return { id: servicio.id, estado: servicio.getEstado() };
  }

  @Patch('servicios-contratados/:id/activar')
  @ApiActivarServicioContratadoDoc()
  async activarServicioContratado(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const servicio = await this.activarServicioContratadoUseCase.execute(id);
    return { id: servicio.id, estado: servicio.getEstado() };
  }

  private mapServicioResponse(s: ServicioContratado): ServicioContratadoResponseDto {
    return {
      id: s.id,
      proyectoId: s.proyectoId,
      tipoServicio: s.tipoServicio,
      frecuencia: s.frecuencia,
      areaTotalM2: s.areaTotalM2,
      areaTratarM2: s.areaTratarM2,
      insumosAutorizados: s.insumosAutorizados,
      equiposAutorizados: s.equiposAutorizados,
      dosisReferencial: s.dosisReferencial,
      requiereCertificado: s.requiereCertificado,
      vigenciaDias: s.vigenciaDias,
      estado: s.getEstado(),
    };
  }

  // ==========================================
  // INSUMOS QUÍMICOS
  // ==========================================

  @Post('insumos')
  @ApiCrearInsumoDoc()
  async crearInsumo(@Body() dto: CrearInsumoDto): Promise<InsumoResponseDto> {
    const insumo = await this.registrarInsumoUseCase.execute(dto);
    return {
      id: insumo.id,
      nombreComercial: insumo.nombreComercial,
      registroDigesa: insumo.registroDigesa,
      principioActivo: insumo.principioActivo,
      presentacion: insumo.presentacion,
      unidadMedida: insumo.unidadMedida,
      concentracion: insumo.concentracion,
      dosisEstandar: insumo.dosisEstandar,
      fichaTecnicaKey: insumo.fichaTecnicaKey,
      hojaMsdsKey: insumo.hojaMsdsKey,
      proveedor: insumo.proveedor,
      estado: insumo.getEstado(),
    };
  }

  @Get('insumos')
  @ApiListarInsumosDoc()
  async listarInsumos(
    @Query() query?: PaginacionQueryDto,
  ): Promise<InsumoPaginadoResponseDto> {
    const { limit = 20, offset = 0, busqueda } = query ?? {};
    let insumos = await this.insumoRepo.listarTodos();

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      insumos = insumos.filter(
        (i) =>
          i.nombreComercial.toLowerCase().includes(q) ||
          i.principioActivo.toLowerCase().includes(q) ||
          i.registroDigesa.toLowerCase().includes(q),
      );
    }

    const total = insumos.length;
    const paginados = insumos.slice(offset, offset + limit);

    return {
      total,
      limit,
      offset,
      items: paginados.map((i) => ({
        id: i.id,
        nombreComercial: i.nombreComercial,
        principioActivo: i.principioActivo,
        presentacion: i.presentacion,
        unidadMedida: i.unidadMedida,
        registroDigesa: i.registroDigesa,
        concentracion: i.concentracion,
        dosisEstandar: i.dosisEstandar,
        fichaTecnicaKey: i.fichaTecnicaKey,
        hojaMsdsKey: i.hojaMsdsKey,
        resolucionKey: i.resolucionKey,
        proveedor: i.proveedor,
        estado: i.getEstado(),
      })),
    };
  }

  @Get('insumos/:id')
  @ApiObtenerInsumoDoc()
  async obtenerInsumo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<InsumoResponseDto> {
    const insumo = await this.insumoRepo.buscarPorId(id);
    if (!insumo) {
      throw new NotFoundException(`Insumo con ID ${id} no encontrado`);
    }
    return {
      id: insumo.id,
      nombreComercial: insumo.nombreComercial,
      registroDigesa: insumo.registroDigesa,
      principioActivo: insumo.principioActivo,
      presentacion: insumo.presentacion,
      unidadMedida: insumo.unidadMedida,
      concentracion: insumo.concentracion,
      dosisEstandar: insumo.dosisEstandar,
      fichaTecnicaKey: insumo.fichaTecnicaKey,
      hojaMsdsKey: insumo.hojaMsdsKey,
      resolucionKey: insumo.resolucionKey,
      proveedor: insumo.proveedor,
      estado: insumo.getEstado(),
    };
  }

  @Patch('insumos/:id')
  @ApiActualizarInsumoDoc()
  async actualizarInsumo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActualizarInsumoDto,
  ): Promise<InsumoResponseDto> {
    const insumo = await this.actualizarInsumoUseCase.execute({
      id,
      ...dto,
    });
    return {
      id: insumo.id,
      nombreComercial: insumo.nombreComercial,
      registroDigesa: insumo.registroDigesa,
      principioActivo: insumo.principioActivo,
      presentacion: insumo.presentacion,
      unidadMedida: insumo.unidadMedida,
      concentracion: insumo.concentracion,
      dosisEstandar: insumo.dosisEstandar,
      fichaTecnicaKey: insumo.fichaTecnicaKey,
      hojaMsdsKey: insumo.hojaMsdsKey,
      resolucionKey: insumo.resolucionKey,
      proveedor: insumo.proveedor,
      estado: insumo.getEstado(),
    };
  }

  @Patch('insumos/:id/desactivar')
  @ApiDesactivarInsumoDoc()
  async desactivarInsumo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const insumo = await this.desactivarInsumoUseCase.execute(id);
    return { id: insumo.id, estado: insumo.getEstado() };
  }

  @Patch('insumos/:id/activar')
  @ApiActivarInsumoDoc()
  async activarInsumo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const insumo = await this.activarInsumoUseCase.execute(id);
    return { id: insumo.id, estado: insumo.getEstado() };
  }

  // ==========================================
  // EQUIPOS OPERATIVOS
  // ==========================================

  @Post('equipos')
  @ApiCrearEquipoDoc()
  async crearEquipo(@Body() dto: CrearEquipoDto): Promise<EquipoResponseDto> {
    const equipo = await this.registrarEquipoUseCase.execute(dto);
    return {
      id: equipo.id,
      codigoInterno: equipo.codigoInterno,
      nombre: equipo.nombre,
      tipo: equipo.tipo,
      marcaModelo: equipo.marcaModelo,
      estadoOperativo: equipo.getEstadoOperativo(),
      fechaAdquisicion: equipo.fechaAdquisicion,
      ultimoMantenimiento: equipo.ultimoMantenimiento,
      proximoMantenimiento: equipo.proximoMantenimiento,
    };
  }

  @Get('equipos')
  @ApiListarEquiposDoc()
  async listarEquipos(
    @Query() query?: PaginacionQueryDto,
  ): Promise<EquipoPaginadoResponseDto> {
    const { limit = 20, offset = 0, busqueda } = query ?? {};
    let equipos = await this.equipoRepo.listarTodos();

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      equipos = equipos.filter(
        (e) =>
          e.nombre.toLowerCase().includes(q) ||
          e.codigoInterno.toLowerCase().includes(q) ||
          e.tipo.toLowerCase().includes(q),
      );
    }

    const total = equipos.length;
    const paginados = equipos.slice(offset, offset + limit);

    return {
      total,
      limit,
      offset,
      items: paginados.map((e) => ({
        id: e.id,
        codigoInterno: e.codigoInterno,
        nombre: e.nombre,
        tipo: e.tipo,
        marcaModelo: e.marcaModelo,
        estadoOperativo: e.getEstadoOperativo(),
        fechaAdquisicion: e.fechaAdquisicion,
        ultimoMantenimiento: e.ultimoMantenimiento,
        proximoMantenimiento: e.proximoMantenimiento,
      })),
    };
  }

  @Get('equipos/:id')
  @ApiObtenerEquipoDoc()
  async obtenerEquipo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EquipoResponseDto> {
    const equipo = await this.equipoRepo.buscarPorId(id);
    if (!equipo) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }
    return {
      id: equipo.id,
      codigoInterno: equipo.codigoInterno,
      nombre: equipo.nombre,
      tipo: equipo.tipo,
      marcaModelo: equipo.marcaModelo,
      estadoOperativo: equipo.getEstadoOperativo(),
      fechaAdquisicion: equipo.fechaAdquisicion,
      ultimoMantenimiento: equipo.ultimoMantenimiento,
      proximoMantenimiento: equipo.proximoMantenimiento,
    };
  }

  @Patch('equipos/:id')
  @ApiActualizarEquipoDoc()
  async actualizarEquipo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActualizarEquipoDto,
  ): Promise<EquipoResponseDto> {
    const equipo = await this.actualizarEquipoUseCase.execute({
      id,
      ...dto,
    });
    return {
      id: equipo.id,
      codigoInterno: equipo.codigoInterno,
      nombre: equipo.nombre,
      tipo: equipo.tipo,
      marcaModelo: equipo.marcaModelo,
      estadoOperativo: equipo.getEstadoOperativo(),
      fechaAdquisicion: equipo.fechaAdquisicion,
      ultimoMantenimiento: equipo.ultimoMantenimiento,
      proximoMantenimiento: equipo.proximoMantenimiento,
    };
  }

  @Patch('equipos/:id/estado')
  @ApiCambiarEstadoEquipoDoc()
  async cambiarEstadoEquipo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CambiarEstadoEquipoDto,
  ): Promise<EquipoResponseDto> {
    const equipo = await this.actualizarEstadoEquipoUseCase.execute(
      id,
      dto.estadoOperativo,
    );
    return {
      id: equipo.id,
      codigoInterno: equipo.codigoInterno,
      nombre: equipo.nombre,
      tipo: equipo.tipo,
      marcaModelo: equipo.marcaModelo,
      estadoOperativo: equipo.getEstadoOperativo(),
      fechaAdquisicion: equipo.fechaAdquisicion,
      ultimoMantenimiento: equipo.ultimoMantenimiento,
      proximoMantenimiento: equipo.proximoMantenimiento,
    };
  }

  // ==========================================
  // PERSONAL TÉCNICO Y SUPERVISORES
  // ==========================================

  @Post('personal')
  @ApiCrearPersonalDoc()
  async crearPersonal(@Body() dto: CrearPersonalDto): Promise<PersonalResponseDto> {
    const personal = await this.registrarPersonalUseCase.execute(dto);
    return {
      id: personal.id,
      dni: personal.dni,
      nombres: personal.nombres,
      apellidos: personal.apellidos,
      cargo: personal.cargo,
      telefono: personal.telefono,
      usuario: personal.usuario,
      estado: personal.getEstado(),
    };
  }

  @Get('personal')
  @ApiListarPersonalDoc()
  async listarPersonal(
    @Query() query?: PaginacionQueryDto,
  ): Promise<PersonalPaginadoResponseDto> {
    const { limit = 20, offset = 0, busqueda } = query ?? {};
    let lista = await this.personalRepo.listarTodos();

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter(
        (p) =>
          p.nombres.toLowerCase().includes(q) ||
          p.apellidos.toLowerCase().includes(q) ||
          p.dni.includes(q),
      );
    }

    const total = lista.length;
    const paginados = lista.slice(offset, offset + limit);

    return {
      total,
      limit,
      offset,
      items: paginados.map((p) => ({
        id: p.id,
        dni: p.dni,
        nombres: p.nombres,
        apellidos: p.apellidos,
        cargo: p.cargo,
        telefono: p.telefono,
        usuario: p.usuario,
        estado: p.getEstado(),
      })),
    };
  }

  @Get('personal/:id')
  @ApiObtenerPersonalDoc()
  async obtenerPersonal(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PersonalResponseDto> {
    const personal = await this.personalRepo.buscarPorId(id);
    if (!personal) {
      throw new NotFoundException(`Personal con ID ${id} no encontrado`);
    }
    return {
      id: personal.id,
      dni: personal.dni,
      nombres: personal.nombres,
      apellidos: personal.apellidos,
      cargo: personal.cargo,
      telefono: personal.telefono,
      usuario: personal.usuario,
      estado: personal.getEstado(),
    };
  }

  @Patch('personal/:id')
  @ApiActualizarPersonalDoc()
  async actualizarPersonal(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActualizarPersonalDto,
  ): Promise<PersonalResponseDto> {
    const personal = await this.actualizarPersonalUseCase.execute({
      id,
      ...dto,
    });
    return {
      id: personal.id,
      dni: personal.dni,
      nombres: personal.nombres,
      apellidos: personal.apellidos,
      cargo: personal.cargo,
      telefono: personal.telefono,
      usuario: personal.usuario,
      estado: personal.getEstado(),
    };
  }

  @Patch('personal/:id/desactivar')
  @ApiDesactivarPersonalDoc()
  async desactivarPersonal(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const personal = await this.desactivarPersonalUseCase.execute(id);
    return { id: personal.id, estado: personal.getEstado() };
  }

  @Patch('personal/:id/activar')
  @ApiActivarPersonalDoc()
  async activarPersonal(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const personal = await this.activarPersonalUseCase.execute(id);
    return { id: personal.id, estado: personal.getEstado() };
  }

  // ==========================================
  // STORAGE S3 (MINIO)
  // ==========================================

  @Post('storage/upload-url')
  @ApiGenerarUploadUrlDoc()
  async generarUploadUrl(@Body() dto: GenerarUploadUrlDto): Promise<UploadUrlResponseDto> {
    const uploadUrl = await this.storageService.generarPresignedUploadUrl(
      dto.key,
      dto.contentType,
    );
    return {
      key: dto.key,
      uploadUrl,
      bucket: this.storageService.getBucketName(),
      expiresInSeconds: 900,
    };
  }

  @Post('storage/download-url')
  @ApiGenerarDownloadUrlDoc()
  async generarDownloadUrl(@Body() dto: GenerarDownloadUrlDto): Promise<DownloadUrlResponseDto> {
    const downloadUrl = await this.storageService.generarPresignedDownloadUrl(
      dto.key,
    );
    return {
      key: dto.key,
      downloadUrl,
      expiresInSeconds: 3600,
    };
  }
}
