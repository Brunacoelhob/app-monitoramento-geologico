import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarSwagger } from './comum/swagger';
import { configurarApp } from './configurar-app';

async function iniciar() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);

  // Documentacao interativa em /api/docs (desligada em producao).
  if (process.env.NODE_ENV !== 'production') {
    configurarSwagger(app, Number(process.env.PORTA_API ?? 3000));
  }

  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORTA_API ?? 3000), '0.0.0.0');
}

iniciar();
