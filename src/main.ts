import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  if (config.get<string>('APP_ENV') !== 'production') {
    SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
  }

  const port = config.get<number>('PORT') ?? 3002;
  await app.listen(port);
  new Logger('Bootstrap').log(`listening on ${port} — APP_ENV=${config.get<string>('APP_ENV') ?? 'unset'}`);
}

bootstrap();
