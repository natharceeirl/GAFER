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

  // Especificación OpenAPI con Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('GAFER API')
    .setDescription(
      'API de Saneamiento Ambiental, Mantenimiento y Operaciones de Campo (GAFER v6)',
    )
    .setVersion('1.0')
    .addTag(
      'Mantenimiento',
      'Gestión de clientes, sedes, servicios contratados, insumos y equipos',
    )
    .addTag('Operaciones', 'Inspecciones de campo y snapshot inmutable Sección 13')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

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
}
bootstrap();
