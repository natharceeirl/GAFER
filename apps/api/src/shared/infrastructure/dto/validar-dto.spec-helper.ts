import { ArgumentMetadata, BadRequestException, Type } from '@nestjs/common';
import { ValidacionZodPipe } from '../pipes/validacion-zod.pipe';

const pipe = new ValidacionZodPipe();

/** Pasa un valor por el pipe de validación como si llegara en el cuerpo (o la consulta) de una petición. */
export function validarDto<T>(dto: Type<T>, valor: unknown, type: ArgumentMetadata['type'] = 'body'): T {
  return pipe.transform(valor, { type, metatype: dto }) as T;
}

/** Rutas de los campos que rechazó el pipe; vacío si el valor es válido. */
export function rutasRechazadas(dto: Type<unknown>, valor: unknown, type: ArgumentMetadata['type'] = 'body'): string[] {
  try {
    validarDto(dto, valor, type);
    return [];
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    return (error.getResponse() as { errors: { path: string }[] }).errors.map((e) => e.path);
  }
}
