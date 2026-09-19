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
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

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

// DTOs Request
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

// DTOs Response (OpenAPI / Scalar)
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
  BadRequestErrorDto,
  NotFoundErrorDto,
  ConflictErrorDto,
} from './dto/mantenimiento-response.dto';

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
    description: 'Valida RUC exacto de 11 dígitos, unicidad de código corto alfanumérico y formato de correo.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cliente registrado exitosamente',
    type: ClienteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Sintaxis o formato de datos inválido (RUC o correo)', type: BadRequestErrorDto })
  @ApiResponse({ status: 409, description: 'RUC o código corto ya registrado en el sistema', type: ConflictErrorDto })
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
  @ApiOperation({
    summary: 'Listar clientes registrados con paginación y búsqueda',
    description: 'Permite filtrar por razón social, RUC o código corto con paginación (limit/offset).',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de clientes',
    type: ClientePaginadoResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Parámetros de paginación o búsqueda inválidos', type: BadRequestErrorDto })
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
  @ApiOperation({
    summary: 'Obtener detalle completo de un cliente por ID',
    description: 'Devuelve datos fiscales, de contacto y campos personalizados.',
  })
  @ApiParam({ name: 'id', description: 'UUID del cliente', example: 'c1111111-1111-1111-1111-111111111111' })
  @ApiResponse({ status: 200, description: 'Detalle del cliente encontrado', type: ClienteDetalleResponseDto })
  @ApiResponse({ status: 400, description: 'ID de cliente con formato UUID inválido', type: BadRequestErrorDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado', type: NotFoundErrorDto })
  async obtenerCliente(@Param('id') id: string): Promise<ClienteDetalleResponseDto> {
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
  @ApiOperation({
    summary: 'Actualizar datos de un cliente existente',
    description: 'Modifica razón social, dirección fiscal, teléfono, cargo o correo de contacto.',
  })
  @ApiParam({ name: 'id', description: 'UUID del cliente', example: 'c1111111-1111-1111-1111-111111111111' })
  @ApiResponse({ status: 200, description: 'Cliente actualizado exitosamente', type: ClienteDetalleResponseDto })
  @ApiResponse({ status: 400, description: 'Campos de actualización con formato inválido', type: BadRequestErrorDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado', type: NotFoundErrorDto })
  async actualizarCliente(
    @Param('id') id: string,
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
  @ApiOperation({ summary: 'Desactivar un cliente (baja lógica)' })
  @ApiParam({ name: 'id', description: 'UUID del cliente' })
  @ApiResponse({ status: 200, description: 'Cliente desactivado', type: EstadoSimpleResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado', type: NotFoundErrorDto })
  async desactivarCliente(@Param('id') id: string): Promise<EstadoSimpleResponseDto> {
    const cliente = await this.desactivarClienteUseCase.execute(id);
    return { id: cliente.id, estado: cliente.getEstado() };
  }

  @Patch('clientes/:id/activar')
  @ApiOperation({ summary: 'Reactivar un cliente previamente desactivado' })
  @ApiParam({ name: 'id', description: 'UUID del cliente' })
  @ApiResponse({ status: 200, description: 'Cliente reactivado', type: EstadoSimpleResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado', type: NotFoundErrorDto })
  async activarCliente(@Param('id') id: string): Promise<EstadoSimpleResponseDto> {
    const cliente = await this.activarClienteUseCase.execute(id);
    return { id: cliente.id, estado: cliente.getEstado() };
  }

  // ==========================================
  // SEDES / PROYECTOS
  // ==========================================

  @Post('proyectos')
  @ApiOperation({
    summary: 'Registrar una sede o proyecto vinculado a un cliente',
    description: 'Valida nombre único por cliente en mayúsculas sin espacios (ej. PLANTA_SUR).',
  })
  @ApiResponse({ status: 201, description: 'Sede/proyecto registrado exitosamente', type: ProyectoResponseDto })
  @ApiResponse({ status: 400, description: 'Cliente inactivo o datos inválidos', type: BadRequestErrorDto })
  @ApiResponse({ status: 404, description: 'Cliente propietario no encontrado', type: NotFoundErrorDto })
  @ApiResponse({ status: 409, description: 'Nombre de sede duplicado para este cliente', type: ConflictErrorDto })
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
  @ApiOperation({ summary: 'Listar todas las sedes de un cliente' })
  @ApiParam({ name: 'clienteId', description: 'UUID del cliente' })
  @ApiResponse({ status: 200, description: 'Listado de sedes del cliente', type: [ProyectoResponseDto] })
  @ApiResponse({ status: 400, description: 'UUID de cliente inválido', type: BadRequestErrorDto })
  async listarProyectosPorCliente(
    @Param('clienteId') clienteId: string,
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
  @ApiOperation({
    summary: 'Registrar un servicio ambiental contratado para una sede',
    description: 'Valida uno de los 7 tipos oficiales (DSF, DSS, DRT, etc.) y áreas coherentes.',
  })
  @ApiResponse({
    status: 201,
    description: 'Servicio contratado registrado exitosamente',
    type: ServicioContratadoResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Áreas inconsistentes (tratar > total) o tipo no válido', type: BadRequestErrorDto })
  @ApiResponse({ status: 404, description: 'Sede/proyecto no encontrada', type: NotFoundErrorDto })
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
  @ApiOperation({ summary: 'Listar servicios contratados de una sede' })
  @ApiParam({ name: 'proyectoId', description: 'UUID de la sede' })
  @ApiResponse({ status: 200, description: 'Servicios de la sede', type: [ServicioContratadoResponseDto] })
  @ApiResponse({ status: 400, description: 'UUID de sede inválido', type: BadRequestErrorDto })
  async listarServiciosPorProyecto(
    @Param('proyectoId') proyectoId: string,
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
  @ApiOperation({
    summary: 'Registrar insumo químico con registro DIGESA y referencias MinIO S3',
  })
  @ApiResponse({ status: 201, description: 'Insumo registrado exitosamente', type: InsumoResponseDto })
  @ApiResponse({ status: 400, description: 'Campos requeridos faltantes o formato inválido', type: BadRequestErrorDto })
  @ApiResponse({ status: 409, description: 'Registro DIGESA ya existente en el catálogo', type: ConflictErrorDto })
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
  @ApiOperation({ summary: 'Listar catálogo de insumos químicos activos con paginación' })
  @ApiResponse({ status: 200, description: 'Catálogo paginado de insumos', type: InsumoPaginadoResponseDto })
  @ApiResponse({ status: 400, description: 'Parámetros de consulta inválidos', type: BadRequestErrorDto })
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

  @Patch('insumos/:id/desactivar')
  @ApiOperation({ summary: 'Desactivar un insumo del catálogo' })
  @ApiParam({ name: 'id', description: 'UUID del insumo' })
  @ApiResponse({ status: 200, description: 'Insumo desactivado', type: EstadoSimpleResponseDto })
  @ApiResponse({ status: 404, description: 'Insumo no encontrado', type: NotFoundErrorDto })
  async desactivarInsumo(@Param('id') id: string): Promise<EstadoSimpleResponseDto> {
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
  @ApiResponse({ status: 201, description: 'Equipo registrado exitosamente', type: EquipoResponseDto })
  @ApiResponse({ status: 400, description: 'Datos del equipo inválidos', type: BadRequestErrorDto })
  @ApiResponse({ status: 409, description: 'Código interno de equipo duplicado', type: ConflictErrorDto })
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
  @ApiOperation({ summary: 'Listar catálogo de equipos operativos con paginación' })
  @ApiResponse({ status: 200, description: 'Catálogo paginado de equipos', type: EquipoPaginadoResponseDto })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos', type: BadRequestErrorDto })
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
  @ApiOperation({ summary: 'Actualizar estado operativo del equipo (OPERATIVO, MANTENIMIENTO, FUERA_SERVICIO)' })
  @ApiParam({ name: 'id', description: 'UUID del equipo' })
  @ApiResponse({ status: 200, description: 'Estado operativo actualizado', type: EquipoResponseDto })
  @ApiResponse({ status: 400, description: 'Estado operativo no válido', type: BadRequestErrorDto })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado', type: NotFoundErrorDto })
  async cambiarEstadoEquipo(
    @Param('id') id: string,
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
  @ApiOperation({
    summary: 'Registrar personal técnico o supervisor con DNI de 8 dígitos',
  })
  @ApiResponse({ status: 201, description: 'Personal registrado exitosamente', type: PersonalResponseDto })
  @ApiResponse({ status: 400, description: 'DNI no contiene 8 dígitos numéricos o campos inválidos', type: BadRequestErrorDto })
  @ApiResponse({ status: 409, description: 'DNI o nombre de usuario ya registrado', type: ConflictErrorDto })
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
  @ApiOperation({ summary: 'Listar personal técnico y supervisores activos con paginación' })
  @ApiResponse({ status: 200, description: 'Listado de personal activo', type: PersonalPaginadoResponseDto })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos', type: BadRequestErrorDto })
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
  @ApiOperation({ summary: 'Desactivar personal o colaborador (baja lógica)' })
  @ApiParam({ name: 'id', description: 'UUID del colaborador' })
  @ApiResponse({ status: 200, description: 'Personal desactivado', type: EstadoSimpleResponseDto })
  @ApiResponse({ status: 404, description: 'Personal no encontrado', type: NotFoundErrorDto })
  async desactivarPersonal(@Param('id') id: string): Promise<EstadoSimpleResponseDto> {
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
    description: 'Devuelve una URL prefirmada con PUT para subir archivos PDF directamente desde el cliente.',
  })
  @ApiResponse({ status: 200, description: 'URL prefirmada generada exitosamente (PUT)', type: UploadUrlResponseDto })
  @ApiResponse({ status: 400, description: 'Clave de archivo o content-type inválido', type: BadRequestErrorDto })
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
  @ApiOperation({
    summary:
      'Generar URL prefirmada para visualización o descarga segura desde MinIO S3',
    description: 'Devuelve una URL temporal segura (1 hora) con GET para consultar el archivo.',
  })
  @ApiResponse({ status: 200, description: 'URL prefirmada de descarga generada (GET)', type: DownloadUrlResponseDto })
  @ApiResponse({ status: 400, description: 'Clave de archivo requerida', type: BadRequestErrorDto })
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
