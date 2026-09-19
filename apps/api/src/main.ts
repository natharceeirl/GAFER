import 'reflect-metadata';
import { config } from 'dotenv';

config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/infrastructure/filters/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para integración con apps/web y apps/mobile
  app.enableCors();

  // Prefijo global de la API REST (/api), preservando /docs y /docs-json en la raíz
  app.setGlobalPrefix('api', {
    exclude: ['docs', 'docs-json'],
  });

  // Filtro Global de Excepciones de Dominio (mapea invariantes de negocio a HTTP 400/404/409)
  app.useGlobalFilters(new DomainExceptionFilter());

  // Validación estricta y transformación de payloads en la capa de transporte
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Especificación OpenAPI 3.0 con Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('GAFER Saneamiento Ambiental — Core API')
    .setDescription(
      `### Sistema de Gestión de Operaciones de Campo y Certificación Ambiental (v6)

Este backend implementa la **Fase 1: Mantenimiento y Operaciones** conforme a la especificación técnica GAFER v6:
- **Mantenimiento**: Catálogos maestros de Clientes, Sedes (Proyectos), Servicios Contratados, Insumos químicos (DIGESA), Equipos operativos y Personal técnico.
- **Operaciones**: Flujo de inspecciones de campo con congelamiento de catálogos en JSONB (**Regla de Inmutabilidad Contractual — Sección 13**).
- **Almacenamiento S3**: Integración con MinIO para carga y descarga de fichas técnicas y hojas MSDS mediante URLs prefirmadas.
- **Arquitectura**: Arquitectura Hexagonal con Kysely + PostgreSQL 16 y validación estricta en el transporte.`,
    )
    .setVersion('1.0.0')
    .setContact(
      'Equipo de Ingeniería GAFER',
      'https://gafer.pe',
      'soporte@gafer.pe',
    )
    .addServer('http://localhost:3000', 'Servidor Local de Desarrollo')
    .addTag(
      'Mantenimiento',
      '[FASE 1] Catálogos maestros: Clientes, Sedes, Servicios, Insumos, Equipos, Personal y MinIO S3.',
    )
    .addTag(
      'Operaciones',
      '[FASE 1] Inspecciones de campo, registro de consumos y snapshot inmutable Sección 13.',
    )
    .addTag(
      'Fase 2 - Documentos',
      '[FASE 2 - EN DESARROLLO] Generación y máquina de estados de documentos y certificados.',
    )
    .addTag(
      'Fase 3 - Mapa Murino',
      '[FASE 3 - EN DESARROLLO] Monitoreo de trampas y estaciones murinas.',
    )
    .addTag(
      'Fase 4 - Estadísticas',
      '[FASE 4 - EN DESARROLLO] Resumen operativo y métricas para expedientes de clientes.',
    )
    .addTag(
      'Fase 5 - Inventario',
      '[FASE 5 - EN DESARROLLO] Kardex y control de consumo físico de insumos.',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Endpoint para exponer el OpenAPI en formato JSON crudo
  app.getHttpAdapter().get('/docs-json', (_req, res) => {
    res.json(document);
  });

  // Montar interfaz interactiva de Scalar en /docs
  app.use(
    '/docs',
    apiReference({
      content: document,
      theme: 'purple',
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[GAFER-API] Servidor corriendo en http://localhost:${port}`);
  console.log(
    `[GAFER-API] Documentación interactiva Scalar en http://localhost:${port}/docs`,
  );
  console.log(
    `[GAFER-API] Especificación OpenAPI JSON en http://localhost:${port}/docs-json`,
  );
}
bootstrap();
