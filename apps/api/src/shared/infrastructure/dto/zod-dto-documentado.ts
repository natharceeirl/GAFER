import { createZodDto, type ZodDto } from 'nestjs-zod';
import type { z } from 'zod';

/**
 * Crea un DTO a partir de un esquema de `@gafer/contracts` y le suma los ejemplos que Swagger muestra
 * por campo. El tipo, lo obligatorio, los valores permitidos y la descripción salen del propio esquema
 * (`.describe()`); zod 3 no tiene dónde guardar un ejemplo, y los contratos no deben conocer a Nest.
 */
export function createZodDtoDocumentado<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  ejemplos: { [Campo in keyof z.input<TSchema>]?: unknown },
): ZodDto<TSchema> {
  const dto = createZodDto(schema);
  const metadatosDelEsquema = dto._OPENAPI_METADATA_FACTORY.bind(dto);

  dto._OPENAPI_METADATA_FACTORY = () => {
    const campos = metadatosDelEsquema() as Record<string, object>;
    for (const [campo, example] of Object.entries(ejemplos)) {
      if (!(campo in campos)) throw new Error(`El ejemplo "${campo}" no corresponde a ningún campo del esquema`);
      campos[campo] = { ...campos[campo], example };
    }
    return campos;
  };

  return dto;
}
