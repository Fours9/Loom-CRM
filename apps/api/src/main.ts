import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { getApplicationConfig } from './platform/config/application-config';

/**
 * Env SoT before Nest/ConfigModule: repo-root `.env` first, then `apps/api/.env`.
 * dotenv does not override keys already set (root wins). `quiet` hides
 * «injected env (0)» noise when the parent shell / first file already filled process.env.
 * Paths cover `node dist/main.js` (__dirname = apps/api/dist) and cwd = apps/api.
 */
const quiet = true;
for (const file of [
  resolve(__dirname, '../../../.env'), // repo root from dist/
  resolve(process.cwd(), '../../.env'), // repo root from apps/api cwd
  resolve(__dirname, '../../.env'), // apps/api/.env from dist/
  resolve(process.cwd(), '.env'), // apps/api/.env from cwd
]) {
  loadEnv({ path: file, quiet });
}

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
    exposedHeaders: ['Content-Disposition'],
  });
  await app.listen(config.port);
}

void bootstrap();
