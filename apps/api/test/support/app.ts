/**
 * app.ts
 * Enciende la aplicación real en un puerto libre para probarla.
 *
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación del archivo.
 *   v1.1  2026-09-20  ahilacondo  Cierra bien las conexiones al terminar.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { KYSELY_DATABASE } from '../../src/database/database.module';
import { DomainExceptionFilter } from '../../src/shared/infrastructure/filters/domain-exception.filter';
import { ALMACEN_PDF, COLA_PDF } from '../../src/documentos/domain/ports/pdf.ports';
import { AlmacenPdfMemory, ColaPdfMemory } from '../../src/documentos/infrastructure/pdf.memory';
import { TEST_DATABASE_URL } from './config';

export interface TestApp {
  app: INestApplication;
  /** Dirección del servidor de pruebas */
  baseUrl: string;
  /** Conexión directa a la base de pruebas */
  db: Pool;
  /** Cola y almacenamiento del PDF en memoria: las pruebas HTTP no necesitan Redis ni MinIO. */
  cola: ColaPdfMemory;
  almacen: AlmacenPdfMemory;
  close(): Promise<void>;
}

/** Enciende la aplicación con la misma configuración que main.ts, en un puerto libre. */
export async function createTestApp(): Promise<TestApp> {
  const cola = new ColaPdfMemory();
  const almacen = new AlmacenPdfMemory();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(COLA_PDF)
    .useValue(cola)
    .overrideProvider(ALMACEN_PDF)
    .useValue(almacen)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });

  app.setGlobalPrefix('api', { exclude: ['docs', 'docs-json'] });
  app.useGlobalFilters(new DomainExceptionFilter());

  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();
  const db = new Pool({ connectionString: TEST_DATABASE_URL });

  return {
    app,
    baseUrl,
    db,
    cola,
    almacen,
    async close() {
      await db.end();
      // Cierra las conexiones a la base para que Jest termine sin esperar.
      const kysely = app.get<Kysely<unknown>>(KYSELY_DATABASE);
      await app.close();
      await kysely.destroy();
    },
  };
}
