import { BadRequestException } from '@nestjs/common';
import { MontoMonedaError } from '../domain/monto-moneda';

/**
 * Ejecuta una actualización de dominio y traduce un incumplimiento de monto/moneda a un 400
 * con la misma forma que la validación del contrato: `message` ("campo: texto") y `errors` (ruta y texto).
 * Se usa aquí porque en un PATCH parcial el contrato no conoce los valores guardados y no puede decidir el par.
 */
export function actualizarConCamposMonto<T>(accion: () => T): T {
  try {
    return accion();
  } catch (error) {
    if (error instanceof MontoMonedaError) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: [`${error.campo}: ${error.message}`],
        errors: [{ path: error.campo, message: error.message }],
      });
    }
    throw error;
  }
}
