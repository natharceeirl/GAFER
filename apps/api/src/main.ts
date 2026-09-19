import 'reflect-metadata';
import { config } from 'dotenv';

config();

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Especificación OpenAPI con Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('GAFER API')
    .setDescription(
      'API de Saneamiento Ambiental, Mantenimiento y Operaciones de Campo (GAFER v6)',
    )
    .setVersion('1.0')
    .addTag(
      'mantenimiento',
      'Gestión de clientes, sedes, servicios contratados e insumos',
    )
    .addTag('operaciones', 'Inspecciones de campo y colaboración offline-first')
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
