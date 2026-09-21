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
import { ActualizarInsumoUseCase } from '../application/actualizar-insumo.usecase';
import { DesactivarInsumoUseCase } from '../application/desactivar-insumo.usecase';
import { ActualizarEstadoEquipoUseCase } from '../application/actualizar-estado-equipo.usecase';
import { DesactivarPersonalUseCase } from '../application/desactivar-personal.usecase';

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

// S3 Storage
import { S3StorageService } from '../../shared/infrastructure/storage/s3-storage.service';

// DTOs Request
import {
  CrearClienteDto,
  ActualizarClienteDto,
  CrearProyectoDto,
  CrearServicioContratadoDto,
  CrearInsumoDto,
  ActualizarInsumoDto,
  CrearEquipoDto,
  CambiarEstadoEquipoDto,
  CrearPersonalDto,
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
  ApiCrearServicioContratadoDoc,
  ApiListarServiciosPorProyectoDoc,
  ApiCrearInsumoDoc,
  ApiListarInsumosDoc,
  ApiActualizarInsumoDoc,
  ApiDesactivarInsumoDoc,
  ApiCrearEquipoDoc,
  ApiListarEquiposDoc,
  ApiCambiarEstadoEquipoDoc,
  ApiCrearPersonalDoc,
  ApiListarPersonalDoc,
  ApiDesactivarPersonalDoc,
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
    private readonly registrarServicioContratadoUseCase: RegistrarServicioContratadoUseCase,
    private readonly registrarInsumoUseCase: RegistrarInsumoUseCase,
    private readonly actualizarInsumoUseCase: ActualizarInsumoUseCase,
    private readonly desactivarInsumoUseCase: DesactivarInsumoUseCase,
    private readonly registrarEquipoUseCase: RegistrarEquipoUseCase,
    private readonly actualizarEstadoEquipoUseCase: ActualizarEstadoEquipoUseCase,
    private readonly registrarPersonalUseCase: RegistrarPersonalUseCase,
    private readonly desactivarPersonalUseCase: DesactivarPersonalUseCase,
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
    return {
      id: proyecto.id,
      clienteId: proyecto.clienteId,
      nombre: proyecto.nombre,
      direccionSede: proyecto.direccionSede,
      distrito: proyecto.distrito,
      provincia: proyecto.provincia,
      departamento: proyecto.departamento,
      contactoNombre: proyecto.contactoNombre,
      contactoTelefono: proyecto.contactoTelefono,
      estado: proyecto.getEstado(),
    };
  }

  @Get('proyectos/cliente/:clienteId')
  @ApiListarProyectosPorClienteDoc()
  async listarProyectosPorCliente(
    @Param('clienteId', new ParseUUIDPipe({ version: '4' })) clienteId: string,
  ): Promise<ProyectoResponseDto[]> {
    const proyectos = await this.proyectoRepo.buscarPorClienteId(clienteId);
    return proyectos.map((p) => ({
      id: p.id,
      clienteId: p.clienteId,
      nombre: p.nombre,
      direccionSede: p.direccionSede,
      distrito: p.distrito,
      provincia: p.provincia,
      departamento: p.departamento,
      contactoNombre: p.contactoNombre,
      contactoTelefono: p.contactoTelefono,
      estado: p.getEstado(),
    }));
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
    return {
      id: servicio.id,
      proyectoId: servicio.proyectoId,
      tipoServicio: servicio.tipoServicio,
      frecuencia: servicio.frecuencia,
      areaTotalM2: servicio.areaTotalM2,
      areaTratarM2: servicio.areaTratarM2,
      requiereCertificado: servicio.requiereCertificado,
      vigenciaDias: servicio.vigenciaDias,
      estado: servicio.getEstado(),
    };
  }

  @Get('servicios-contratados/proyecto/:proyectoId')
  @ApiListarServiciosPorProyectoDoc()
  async listarServiciosPorProyecto(
    @Param('proyectoId', new ParseUUIDPipe({ version: '4' })) proyectoId: string,
  ): Promise<ServicioContratadoResponseDto[]> {
    const servicios = await this.servicioRepo.buscarPorProyectoId(proyectoId);
    return servicios.map((s) => ({
      id: s.id,
      proyectoId: s.proyectoId,
      tipoServicio: s.tipoServicio,
      frecuencia: s.frecuencia,
      areaTotalM2: s.areaTotalM2,
      areaTratarM2: s.areaTratarM2,
      requiereCertificado: s.requiereCertificado,
      vigenciaDias: s.vigenciaDias,
      estado: s.getEstado(),
    }));
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
    let insumos = await this.insumoRepo.listarActivos();

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
        proveedor: i.proveedor,
        estado: i.getEstado(),
      })),
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
    };
  }

  @Get('equipos')
  @ApiListarEquiposDoc()
  async listarEquipos(
    @Query() query?: PaginacionQueryDto,
  ): Promise<EquipoPaginadoResponseDto> {
    const { limit = 20, offset = 0, busqueda } = query ?? {};
    let equipos = await this.equipoRepo.listarOperativos();

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
      })),
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
    let lista = await this.personalRepo.listarActivos();

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

  @Patch('personal/:id/desactivar')
  @ApiDesactivarPersonalDoc()
  async desactivarPersonal(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<EstadoSimpleResponseDto> {
    const personal = await this.desactivarPersonalUseCase.execute(id);
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
