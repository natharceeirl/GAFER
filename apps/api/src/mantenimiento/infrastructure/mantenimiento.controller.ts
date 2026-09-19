import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

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

// DTOs
import {
  CrearClienteDto,
  ActualizarClienteDto,
  CrearProyectoDto,
  CrearServicioContratadoDto,
  CrearInsumoDto,
  CrearEquipoDto,
  CambiarEstadoEquipoDto,
  CrearPersonalDto,
  GenerarUploadUrlDto,
  GenerarDownloadUrlDto,
} from './dto/mantenimiento.dto';
import { PaginacionQueryDto } from '../../shared/infrastructure/dto/paginacion.dto';

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
  @ApiOperation({
    summary: 'Registrar nuevo cliente corporativo con RUC y código corto',
  })
  @ApiResponse({ status: 201, description: 'Cliente registrado exitosamente' })
  async crearCliente(@Body() dto: CrearClienteDto) {
    const cliente = await this.registrarClienteUseCase.execute(dto);
    return {
      id: cliente.id,
      razonSocial: cliente.razonSocial,
      ruc: cliente.ruc,
      codigoCorto: cliente.codigoCorto,
      estado: cliente.getEstado(),
    };
  }

  @Get('clientes')
  @ApiOperation({ summary: 'Listar clientes registrados con paginación' })
  async listarClientes(@Query() query?: PaginacionQueryDto) {
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
  @ApiOperation({ summary: 'Obtener detalle de un cliente por ID' })
  async obtenerCliente(@Param('id') id: string) {
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
  @ApiOperation({ summary: 'Actualizar datos de un cliente existente' })
  @ApiResponse({ status: 200, description: 'Cliente actualizado exitosamente' })
  async actualizarCliente(
    @Param('id') id: string,
    @Body() dto: ActualizarClienteDto,
  ) {
    const cliente = await this.actualizarClienteUseCase.execute({
      id,
      ...dto,
    });
    return {
      id: cliente.id,
      razonSocial: cliente.razonSocial,
      direccionFiscal: cliente.direccionFiscal,
      giroNegocio: cliente.giroNegocio,
      contactoNombre: cliente.contactoNombre,
      contactoCargo: cliente.contactoCargo,
      contactoTelefono: cliente.contactoTelefono,
      contactoCorreo: cliente.contactoCorreo,
      estado: cliente.getEstado(),
    };
  }

  @Patch('clientes/:id/desactivar')
  @ApiOperation({ summary: 'Desactivar un cliente (baja lógica)' })
  @ApiResponse({ status: 200, description: 'Cliente desactivado' })
  async desactivarCliente(@Param('id') id: string) {
    const cliente = await this.desactivarClienteUseCase.execute(id);
    return { id: cliente.id, estado: cliente.getEstado() };
  }

  @Patch('clientes/:id/activar')
  @ApiOperation({ summary: 'Reactivar un cliente previamente desactivado' })
  @ApiResponse({ status: 200, description: 'Cliente reactivado' })
  async activarCliente(@Param('id') id: string) {
    const cliente = await this.activarClienteUseCase.execute(id);
    return { id: cliente.id, estado: cliente.getEstado() };
  }

  // ==========================================
  // SEDES / PROYECTOS
  // ==========================================

  @Post('proyectos')
  @ApiOperation({
    summary: 'Registrar una sede o proyecto vinculado a un cliente',
  })
  @ApiResponse({ status: 201, description: 'Sede/proyecto registrado exitosamente' })
  async crearProyecto(@Body() dto: CrearProyectoDto) {
    const proyecto = await this.registrarProyectoUseCase.execute(dto);
    return {
      id: proyecto.id,
      clienteId: proyecto.clienteId,
      nombre: proyecto.nombre,
      direccionSede: proyecto.direccionSede,
      distrito: proyecto.distrito,
      estado: proyecto.getEstado(),
    };
  }

  @Get('proyectos/cliente/:clienteId')
  @ApiOperation({ summary: 'Listar todas las sedes de un cliente' })
  async listarProyectosPorCliente(@Param('clienteId') clienteId: string) {
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
  @ApiOperation({
    summary: 'Registrar un servicio ambiental contratado para una sede',
  })
  @ApiResponse({
    status: 201,
    description: 'Servicio contratado registrado exitosamente',
  })
  async crearServicioContratado(@Body() dto: CrearServicioContratadoDto) {
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
  @ApiOperation({ summary: 'Listar servicios contratados de una sede' })
  async listarServiciosPorProyecto(@Param('proyectoId') proyectoId: string) {
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
  @ApiOperation({
    summary: 'Registrar insumo químico con registro DIGESA y referencias MinIO S3',
  })
  @ApiResponse({ status: 201, description: 'Insumo registrado exitosamente' })
  async crearInsumo(@Body() dto: CrearInsumoDto) {
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
      estado: insumo.getEstado(),
    };
  }

  @Get('insumos')
  @ApiOperation({ summary: 'Listar catálogo de insumos químicos activos' })
  async listarInsumos(@Query() query?: PaginacionQueryDto) {
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

  @Patch('insumos/:id/desactivar')
  @ApiOperation({ summary: 'Desactivar un insumo del catálogo' })
  @ApiResponse({ status: 200, description: 'Insumo desactivado' })
  async desactivarInsumo(@Param('id') id: string) {
    const insumo = await this.desactivarInsumoUseCase.execute(id);
    return { id: insumo.id, estado: insumo.getEstado() };
  }

  // ==========================================
  // EQUIPOS OPERATIVOS
  // ==========================================

  @Post('equipos')
  @ApiOperation({
    summary: 'Registrar equipo operativo con código interno GAFER',
  })
  @ApiResponse({ status: 201, description: 'Equipo registrado exitosamente' })
  async crearEquipo(@Body() dto: CrearEquipoDto) {
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
  @ApiOperation({ summary: 'Listar catálogo de equipos operativos' })
  async listarEquipos(@Query() query?: PaginacionQueryDto) {
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
  @ApiOperation({ summary: 'Actualizar estado operativo del equipo (OPERATIVO, MANTENIMIENTO, FUERA_SERVICIO)' })
  @ApiResponse({ status: 200, description: 'Estado de equipo actualizado' })
  async cambiarEstadoEquipo(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoEquipoDto,
  ) {
    const equipo = await this.actualizarEstadoEquipoUseCase.execute(
      id,
      dto.estadoOperativo,
    );
    return {
      id: equipo.id,
      codigoInterno: equipo.codigoInterno,
      estadoOperativo: equipo.getEstadoOperativo(),
    };
  }

  // ==========================================
  // PERSONAL TÉCNICO Y SUPERVISORES
  // ==========================================

  @Post('personal')
  @ApiOperation({
    summary: 'Registrar personal técnico o supervisor con DNI',
  })
  @ApiResponse({ status: 201, description: 'Personal registrado exitosamente' })
  async crearPersonal(@Body() dto: CrearPersonalDto) {
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
  @ApiOperation({ summary: 'Listar personal técnico y supervisores activos' })
  async listarPersonal(@Query() query?: PaginacionQueryDto) {
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
  @ApiOperation({ summary: 'Desactivar personal o colaborador (baja lógica)' })
  @ApiResponse({ status: 200, description: 'Personal desactivado' })
  async desactivarPersonal(@Param('id') id: string) {
    const personal = await this.desactivarPersonalUseCase.execute(id);
    return { id: personal.id, estado: personal.getEstado() };
  }

  // ==========================================
  // STORAGE S3 (MINIO)
  // ==========================================

  @Post('storage/upload-url')
  @ApiOperation({
    summary:
      'Generar URL prefirmada para subida directa de fichas técnicas o MSDS a MinIO S3',
  })
  @ApiResponse({ status: 200, description: 'URL prefirmada generada con éxito' })
  async generarUploadUrl(@Body() dto: GenerarUploadUrlDto) {
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
  @ApiOperation({
    summary:
      'Generar URL prefirmada para visualización o descarga segura desde MinIO S3',
  })
  @ApiResponse({ status: 200, description: 'URL prefirmada de descarga generada' })
  async generarDownloadUrl(@Body() dto: GenerarDownloadUrlDto) {
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
