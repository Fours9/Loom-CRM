import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getApplicationConfig } from './platform/config/application-config';

async function bootstrap() {
  const config = getApplicationConfig();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: config.corsOrigin,
    credentials: true,
  });
  await app.listen(config.port);
}

void bootstrap();
