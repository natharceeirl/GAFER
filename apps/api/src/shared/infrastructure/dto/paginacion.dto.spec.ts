import { PaginacionQueryDto } from './paginacion.dto';
import { rutasRechazadas, validarDto } from './validar-dto.spec-helper';
import { metadatosOpenApi } from './metadatos-openapi.spec-helper';

describe('PaginacionQueryDto', () => {
  it('aplica 20 registros desde el inicio cuando la consulta no indica nada', () => {
    expect(validarDto(PaginacionQueryDto, {}, 'query')).toEqual({ limit: 20, offset: 0 });
  });

  it('convierte en número los valores que llegan como texto en la URL', () => {
    expect(validarDto(PaginacionQueryDto, { limit: '50', offset: '100', busqueda: 'KALLPA' }, 'query')).toEqual({
      limit: 50,
      offset: 100,
      busqueda: 'KALLPA',
    });
  });

  it.each([
    [{ limit: '0' }, ['limit']],
    [{ limit: '101' }, ['limit']],
    [{ limit: '1.5' }, ['limit']],
    [{ limit: 'abc' }, ['limit']],
    [{ offset: '-1' }, ['offset']],
  ])('rechaza la consulta %j', (consulta, rutas) => {
    expect(rutasRechazadas(PaginacionQueryDto, consulta, 'query')).toEqual(rutas);
  });

  it('documenta los tres parámetros como opcionales, con descripción, ejemplo y valor por defecto', () => {
    const propiedades = metadatosOpenApi(PaginacionQueryDto);
    expect(Object.keys(propiedades)).toEqual(['limit', 'offset', 'busqueda']);
    for (const propiedad of Object.values(propiedades)) {
      expect(propiedad.required).toBe(false);
      expect(typeof propiedad.description).toBe('string');
      expect(propiedad.example).toBeDefined();
    }
    expect(propiedades.limit).toMatchObject({ default: 20, minimum: 1, maximum: 100 });
    expect(propiedades.offset).toMatchObject({ default: 0, minimum: 0 });
  });
});
