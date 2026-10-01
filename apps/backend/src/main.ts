import * as dotenv from 'dotenv';
import * as path from 'path';
// Load .env from monorepo root before any other imports
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * The tracking page may be hosted (Vercel) while the kiosk, staff and admin
   * apps stay on localhost, so allow both. CORS_ORIGIN accepts a comma
   * separated list; anything unlisted is rejected.
   */
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
