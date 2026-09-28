/** Metadatos por campo que `@nestjs/swagger` lee de un DTO de zod para armar el documento OpenAPI. */
export type MetadatosCampo = { required: boolean; description?: string; example?: unknown; enum?: string[]; pattern?: string; format?: string };

/** Los campos de tipo objeto guardan lo obligatorio en `selfRequired`; se normaliza a `required` para poder compararlos. */
export function metadatosOpenApi(dto: unknown): Record<string, MetadatosCampo> {
  const fabrica = (dto as { _OPENAPI_METADATA_FACTORY?: () => Record<string, MetadatosCampo & { selfRequired?: boolean }> })._OPENAPI_METADATA_FACTORY;
  if (!fabrica) throw new Error('El DTO no expone metadatos OpenAPI: no se creó con createZodDto');
  const campos = fabrica.call(dto);
  return Object.fromEntries(Object.entries(campos).map(([campo, { selfRequired, ...resto }]) => [campo, { ...resto, required: selfRequired ?? resto.required }]));
}
