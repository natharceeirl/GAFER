import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { KYSELY_DATABASE } from '../../src/database/database.module';
import { DomainExceptionFilter } from '../../src/shared/infrastructure/filters/domain-exception.filter';
import { TEST_DATABASE_URL } from './config';

export interface TestApp {
  app: INestApplication;
  /** URL base del servidor HTTP real (ej. http://127.0.0.1:53211), sin prefijo /api */
  baseUrl: string;
  /** Conexión directa a la base de pruebas para preparar datos o inspeccionar filas */
  db: Pool;
  close(): Promise<void>;
}

/**
 * Levanta la aplicación con la MISMA configuración de main.ts (prefijo /api,
 * filtro de excepciones de dominio y ValidationPipe), escuchando en un puerto real.
 *
 * Se usa un puerto real (listen(0)) en vez de supertest sobre getHttpServer() porque
 * las pruebas de concurrencia (T3.2) disparan muchas peticiones simultáneas y ese modo
 * produce ECONNRESET.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });

  app.setGlobalPrefix('api', { exclude: ['docs', 'docs-json'] });
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));

  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();
  const db = new Pool({ connectionString: TEST_DATABASE_URL });

  return {
    app,
    baseUrl,
    db,
    async close() {
      await db.end();
      // Nest no cierra por sí solo el pool de Postgres que crea DatabaseModule; sin esto Jest queda
      // esperando ~10 s a que expire la conexión ociosa ("Jest did not exit one second after...").
      const kysely = app.get<Kysely<unknown>>(KYSELY_DATABASE);
      await app.close();
      await kysely.destroy();
    },
  };
}
