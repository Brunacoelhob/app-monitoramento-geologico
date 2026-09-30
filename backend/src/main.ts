import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function iniciar() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.disable('x-powered-by');

  // Somente as origens listadas em CORS_ORIGENS podem chamar a API pelo navegador.
  app.enableCors({
    origin: (process.env.CORS_ORIGENS ?? 'http://localhost:8501').split(','),
  });

  // Rejeita campos desconhecidos e converte tipos (query string vem como texto).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORTA_API ?? 3000), '0.0.0.0');
}

iniciar();
