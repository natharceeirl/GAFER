import { BadRequestException } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { createZodValidationPipe } from 'nestjs-zod';
import type { ZodError } from 'zod';

/**
 * Pipe de validación de la capa de transporte: valida cada DTO creado con `createZodDto`
 * contra su esquema de `@gafer/contracts` y descarta los campos no declarados.
 *
 * Un cuerpo inválido responde 400 con `message` (un texto "campo: mensaje" por incidencia,
 * como el formato anterior) y `errors` (la misma lista con la ruta y el mensaje por separado).
 */
export const ValidacionZodPipe = createZodValidationPipe({
  createValidationException: (error: unknown) => {
    const errors = (error as ZodError).issues.map((incidencia) => ({
      path: incidencia.path.join('.'),
      message: incidencia.message,
    }));
    return new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: errors.map(({ path, message }) => (path ? `${path}: ${message}` : message)),
      errors,
    });
  },
});

/** Registra la validación con zod para todas las rutas de la aplicación. */
export const PROVEEDOR_VALIDACION_ZOD = { provide: APP_PIPE, useClass: ValidacionZodPipe };
