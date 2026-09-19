import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. Si ya es una excepción HTTP propia de NestJS (ValidationPipe, NotFoundException, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resBody = exception.getResponse();
      const errorObj =
        typeof resBody === 'object' && resBody !== null
          ? resBody
          : { message: resBody, statusCode: status };

      return response.status(status).json({
        ...errorObj,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    // 2. Si es un error estándar o una excepción de Dominio lanzada por UseCases / Entidades
    if (exception instanceof Error) {
      const message = exception.message;

      // Conflicto de unicidad o bloqueo de estado de negocio -> 409 Conflict
      if (
        message.toLowerCase().includes('ya existe') ||
        message.toLowerCase().includes('duplicado') ||
        message.toLowerCase().includes('ya está cerrada')
      ) {
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message,
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      // Entidad no encontrada -> 404 Not Found
      if (
        message.toLowerCase().includes('no se encontró') ||
        message.toLowerCase().includes('no encontrado') ||
        message.toLowerCase().includes('no existe')
      ) {
        return response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message,
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      // Reglas de formato e invariantes de negocio -> 400 Bad Request
      if (
        message.toLowerCase().includes('debe') ||
        message.toLowerCase().includes('obligatorio') ||
        message.toLowerCase().includes('no válido') ||
        message.toLowerCase().includes('inválido') ||
        message.toLowerCase().includes('no puede') ||
        message.toLowerCase().includes('mayor a 0')
      ) {
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message,
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      // Violaciones a nivel de PostgreSQL / Kysely
      const pgCode = (exception as any).code;
      if (pgCode === '23505') {
        // unique_violation
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'Violación de restricción de unicidad en base de datos',
          detail: (exception as any).detail,
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
      if (pgCode === '23503') {
        // foreign_key_violation
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Referencia a entidad relacionada no válida',
          detail: (exception as any).detail,
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      this.logger.error(`Unhandled Exception: ${message}`, exception.stack);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Ocurrió un error interno en el servidor',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    // 3. Fallback
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Error inesperado',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
