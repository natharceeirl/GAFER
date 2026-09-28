import { Body, Controller, INestApplication, Post, Query } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { CrearInspeccionDto } from '../../../operaciones/infrastructure/dto/operaciones.dto';
import { PaginacionQueryDto } from '../dto/paginacion.dto';
import { DomainExceptionFilter } from '../filters/domain-exception.filter';
import { PROVEEDOR_VALIDACION_ZOD } from './validacion-zod.pipe';

@Controller('prueba')
class PruebaController {
  @Post()
  crear(@Body() dto: CrearInspeccionDto, @Query() paginacion: PaginacionQueryDto) {
    return { dto, paginacion };
  }
}

describe('Validación de las peticiones HTTP', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [PruebaController], providers: [PROVEEDOR_VALIDACION_ZOD] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(() => app.close());

  it('entrega al controlador el cuerpo y la consulta ya validados y convertidos', async () => {
    const servicioId = 'a1111111-1111-4111-8111-111111111111';
    const res = await request(app.getHttpServer()).post('/prueba?limit=5').send({ servicioId, intruso: true });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ dto: { servicioId }, paginacion: { limit: 5, offset: 0 } });
  });

  it('responde 400 con la lista de campos inválidos, su ruta y el detalle del filtro global', async () => {
    const res = await request(app.getHttpServer()).post('/prueba?limit=5').send({ servicioId: 's1' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: [expect.stringMatching(/^servicioId: /)],
      errors: [{ path: 'servicioId', message: expect.any(String) }],
      path: '/prueba?limit=5',
    });
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('valida la consulta cuando el cuerpo es correcto', async () => {
    const res = await request(app.getHttpServer())
      .post('/prueba?limit=500')
      .send({ servicioId: 'a1111111-1111-4111-8111-111111111111' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ path: 'limit', message: expect.any(String) }]);
  });

  it('la aplicación registra el pipe de zod como validación global', () => {
    expect(Reflect.getMetadata('providers', AppModule)).toContainEqual(PROVEEDOR_VALIDACION_ZOD);
  });
});
