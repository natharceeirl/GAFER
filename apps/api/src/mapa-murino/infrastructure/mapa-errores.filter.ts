import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConflictoMapaError, LimiteMapaExcedidoError, ReglaMapaError } from '../domain/registro-visita';

/** Traduce los errores del dominio del mapa a la respuesta HTTP: reglas incumplidas 400, límites y choques de estado 409. */
@Catch(ReglaMapaError, LimiteMapaExcedidoError, ConflictoMapaError)
export class MapaErroresFilter implements ExceptionFilter {
  catch(error: ReglaMapaError | LimiteMapaExcedidoError | ConflictoMapaError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = error instanceof ReglaMapaError ? HttpStatus.BAD_REQUEST : HttpStatus.CONFLICT;

    response.status(statusCode).json({
      statusCode,
      error: statusCode === HttpStatus.BAD_REQUEST ? 'Bad Request' : 'Conflict',
      message: error.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
