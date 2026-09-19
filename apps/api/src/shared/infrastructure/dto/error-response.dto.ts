import { ApiProperty } from '@nestjs/swagger';

export class BadRequestErrorDto {
  @ApiProperty({ example: 400, description: 'Código de estado HTTP 400 Bad Request' })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request', description: 'Tipo de error HTTP' })
  error!: string;

  @ApiProperty({
    example: [
      'El RUC debe tener exactamente 11 dígitos numéricos',
      'El código corto debe tener entre 3 y 10 caracteres alfanuméricos en mayúsculas',
    ],
    description: 'Lista de errores de validación de sintaxis o mensaje de regla de negocio rechazada',
  })
  message!: string | string[];

  @ApiProperty({ example: '2026-09-19T19:00:00.000Z', description: 'Marca de tiempo ISO del error' })
  timestamp!: string;

  @ApiProperty({ example: '/api/mantenimiento/clientes', description: 'Ruta del endpoint solicitado' })
  path!: string;
}

export class NotFoundErrorDto {
  @ApiProperty({ example: 404, description: 'Código de estado HTTP 404 Not Found' })
  statusCode!: number;

  @ApiProperty({ example: 'Not Found', description: 'Tipo de error HTTP' })
  error!: string;

  @ApiProperty({
    example: 'Cliente c1111111-1111-1111-1111-111111111111 no encontrado',
    description: 'Mensaje indicando el recurso solicitado que no existe en el sistema',
  })
  message!: string;

  @ApiProperty({ example: '2026-09-19T19:00:00.000Z', description: 'Marca de tiempo ISO del error' })
  timestamp!: string;

  @ApiProperty({
    example: '/api/mantenimiento/clientes/c1111111-1111-1111-1111-111111111111',
    description: 'Ruta del endpoint solicitado',
  })
  path!: string;
}

export class ConflictErrorDto {
  @ApiProperty({ example: 409, description: 'Código de estado HTTP 409 Conflict' })
  statusCode!: number;

  @ApiProperty({ example: 'Conflict', description: 'Tipo de error HTTP' })
  error!: string;

  @ApiProperty({
    example: 'Ya existe un cliente registrado con el RUC: 20508565434',
    description: 'Mensaje que describe la colisión de unicidad o bloqueo de estado de negocio',
  })
  message!: string;

  @ApiProperty({ example: '2026-09-19T19:00:00.000Z', description: 'Marca de tiempo ISO del error' })
  timestamp!: string;

  @ApiProperty({ example: '/api/mantenimiento/clientes', description: 'Ruta del endpoint solicitado' })
  path!: string;
}

export class InternalServerErrorDto {
  @ApiProperty({ example: 500, description: 'Código de estado HTTP 500 Internal Server Error' })
  statusCode!: number;

  @ApiProperty({ example: 'Internal Server Error', description: 'Tipo de error HTTP' })
  error!: string;

  @ApiProperty({
    example: 'Ocurrió un error interno en el servidor',
    description: 'Mensaje genérico cuando se produce un error inesperado no controlado',
  })
  message!: string;

  @ApiProperty({ example: '2026-09-19T19:00:00.000Z', description: 'Marca de tiempo ISO del error' })
  timestamp!: string;

  @ApiProperty({ example: '/api/mantenimiento/clientes', description: 'Ruta del endpoint solicitado' })
  path!: string;
}
