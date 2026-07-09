import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust the first proxy (Render) so req.ip gives real client IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet());
  app.setGlobalPrefix('api/v1');

  const origins = process.env.CORS_ORIGINS ?? '*';
  app.enableCors({
    origin: origins === '*' ? true : origins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 HMS API running on http://localhost:${port}/api/v1`);
}
bootstrap();
