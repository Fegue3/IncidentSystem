import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // prefixo /api -> fica /api/auth/register
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: 'http://localhost:5173',                    // onde corre o front
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',  // inclui OPTIONS (preflight)
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,                                  // se um dia usares cookies
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}
bootstrap();
