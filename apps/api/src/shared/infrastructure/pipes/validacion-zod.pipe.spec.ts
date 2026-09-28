import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ValidacionZodPipe } from './validacion-zod.pipe';

class ContactoDto extends createZodDto(
  z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio'),
    direccion: z.object({ calle: z.string().min(1, 'La calle es obligatoria') }),
  }),
) {}

class SinEsquemaDto {
  valor!: string;
}

const enBody = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({ type: 'body', metatype });

describe('ValidacionZodPipe', () => {
  const pipe = new ValidacionZodPipe();

  const capturar = (valor: unknown): BadRequestException => {
    try {
      pipe.transform(valor, enBody(ContactoDto));
    } catch (error) {
      return error as BadRequestException;
    }
    throw new Error('El pipe debió rechazar el valor');
  };

  it('devuelve el cuerpo validado sin los campos que el esquema no declara', () => {
    const resultado = pipe.transform({ nombre: 'Ana', direccion: { calle: 'Av. 1' }, extra: 'x' }, enBody(ContactoDto));

    expect(resultado).toEqual({ nombre: 'Ana', direccion: { calle: 'Av. 1' } });
  });

  it('responde 400 con un mensaje por cada campo inválido, con su ruta', () => {
    const error = capturar({ nombre: '', direccion: { calle: '' } });

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: ['nombre: El nombre es obligatorio', 'direccion.calle: La calle es obligatoria'],
      errors: [
        { path: 'nombre', message: 'El nombre es obligatorio' },
        { path: 'direccion.calle', message: 'La calle es obligatoria' },
      ],
    });
  });

  it('indica el campo faltante cuando el cuerpo llega sin él', () => {
    const { errors } = capturar({ direccion: { calle: 'Av. 1' } }).getResponse() as { errors: { path: string }[] };

    expect(errors.map((e) => e.path)).toEqual(['nombre']);
  });

  it('deja pasar los valores cuyo tipo no es un DTO de zod', () => {
    expect(pipe.transform('abc', { type: 'param', metatype: String })).toBe('abc');
    expect(pipe.transform({ valor: 1 }, enBody(SinEsquemaDto))).toEqual({ valor: 1 });
  });
});
